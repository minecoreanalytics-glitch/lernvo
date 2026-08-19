import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { prisma } from '../utils/prisma'
import { authenticate } from '../middleware/auth'
import { validate } from '../middleware/validate'
import { logger } from '../utils/logger'
import { getTenantId } from '../utils/tenantContext'
import type { Request } from 'express'

const router = Router()
router.use(authenticate)

const PLATFORM_NAME = process.env.PLATFORM_NAME || 'Lernvo'

// 20 messages per user per 15 minutes — more generous than AI generation
const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req as Request & { user?: { userId: string } }).user?.userId || req.ip || 'unknown',
  message: { error: 'Trop de messages. Réessayez dans 15 minutes.' }
})

const MessageSchema = z.object({
  message: z.string().min(1).max(600),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(2000)
  })).max(10).default([])
})

// ─── KB retrieval for chat ───────────────────────────────────────────────────

type KbArticleForChat = {
  id: string
  title: string
  tags: string[]
  body: string
  score: number
}

const QUERY_SYNONYMS: Record<string, string[]> = {
  tarif: ['prix', 'cout', 'coût', 'forfait', 'plan', 'abonnement', 'frais', 'montant'],
  forfait: ['plan', 'tarif', 'pack', 'bundle', 'abonnement', 'offre'],
  produit: ['service', 'offre', 'pack', 'bundle', 'solution'],
  installation: ['deploiement', 'déploiement', 'mise en service', 'deploy'],
  internet: ['fibre', 'ftth', 'adsl', 'broadband', 'connexion'],
  mobile: ['4g', 'lte', 'cellulaire', 'telephonie'],
}

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function extractQueryWords(message: string): string[] {
  const stopwords = new Set([
    'les', 'des', 'une', 'pour', 'dans', 'sur', 'est', 'qui', 'que', 'quoi', 'comment',
    'quel', 'quelle', 'je', 'tu', 'il', 'nous', 'vous', 'ils', 'avec', 'par', 'de', 'du',
    'le', 'la', 'et', 'en', 'au', 'aux', 'un', 'ce', 'se', 'son', 'sa', 'ses', 'ou',
    'où', 'quels', 'quelles', 'ont', 'a', 'y', 'ne', 'pas', 'plus', 'très', 'aussi',
    'mais', 'si', 'car', 'donc', 'or', 'sont', 'mes', 'mon', 'ma', 'été', 'être', 'avoir',
  ])
  return normalizeText(message)
    .split(/\W+/)
    .filter(w => (w.length >= 2 || /\d/.test(w)) && !stopwords.has(w))
}

function expandQueryWords(words: string[]): string[] {
  const expanded = new Set(words)
  for (const w of words) {
    for (const [key, synonyms] of Object.entries(QUERY_SYNONYMS)) {
      if (w === key || synonyms.includes(w)) {
        expanded.add(key)
        synonyms.forEach(s => expanded.add(s))
      }
    }
  }
  return [...expanded]
}

function isKbRelatedQuestion(message: string): boolean {
  return /tarif|prix|forfait|plan|produit|service|pack|bundle|installation|procédure|procedure|sla|add-?on|ip statique|wifi|4g|lte|fibre|internet|télé|tele|promo|offre|contrat|dépannage|depannage|support|client|vente|commercial/i
    .test(message)
}

async function findRelevantKbArticles(
  message: string,
  limit = 5
): Promise<KbArticleForChat[]> {
  const msgWords = extractQueryWords(message)
  const expandedWords = expandQueryWords(msgWords)
  const searchTerms = [...new Set([...expandedWords, ...msgWords])].slice(0, 10)

  let candidates = searchTerms.length > 0
    ? await prisma.kbArticle.findMany({
        where: {
          isPublished: true,
          OR: [
            ...searchTerms.flatMap(w => [
              { title: { contains: w, mode: 'insensitive' as const } },
              { body: { contains: w, mode: 'insensitive' as const } },
              { tags: { has: w } },
            ]),
            { title: { contains: message.slice(0, 100), mode: 'insensitive' as const } },
            { body: { contains: message.slice(0, 100), mode: 'insensitive' as const } },
          ],
        },
        select: { id: true, title: true, tags: true, body: true },
        take: 40,
      })
    : []

  if (candidates.length === 0) {
    candidates = await prisma.kbArticle.findMany({
      where: { isPublished: true },
      select: { id: true, title: true, tags: true, body: true },
      orderBy: { updatedAt: 'desc' },
      take: 40,
    })
  }

  const messageNorm = normalizeText(message)

  const scored = candidates.map(a => {
    const titleNorm = normalizeText(a.title)
    const tagsNorm = normalizeText(a.tags.join(' '))
    const bodyNorm = normalizeText(a.body)

    let score = 0
    for (const w of expandedWords) {
      if (titleNorm.includes(w)) score += 6
      if (tagsNorm.includes(w)) score += 5
      if (bodyNorm.includes(w)) score += 3
    }

    // Phrase overlap boost
    if (messageNorm.length > 8) {
      const phrase = messageNorm.slice(0, 40)
      if (titleNorm.includes(phrase) || bodyNorm.includes(phrase)) score += 8
    }

    const matchCount = expandedWords.filter(w =>
      titleNorm.includes(w) || tagsNorm.includes(w) || bodyNorm.includes(w)
    ).length
    score += matchCount * 2

    return { ...a, score }
  }).sort((a, b) => b.score - a.score)

  const kbQuestion = isKbRelatedQuestion(message)
  let results = scored.filter(a => a.score > 0).slice(0, limit)

  if (results.length === 0 && kbQuestion) {
    results = scored.slice(0, Math.min(3, limit))
  }

  return results
}

function formatKbContext(articles: KbArticleForChat[], maxChars = 20000): string {
  if (!articles.length) {
    return '## BASE DE CONNAISSANCES\nAucun article publié trouvé pour cette question.\n'
  }

  const lines: string[] = [
    '## BASE DE CONNAISSANCES — SOURCE OFFICIELLE (priorité absolue pour produits, tarifs, procédures)',
    '',
  ]

  let used = lines.join('\n').length
  const budgetPerArticle = Math.min(8000, Math.floor(maxChars / articles.length))

  for (const a of articles) {
    const header = `### ${a.title}${a.tags.length ? ` [${a.tags.join(', ')}]` : ''}`
    const remaining = maxChars - used
    if (remaining < 200) break

    const bodyLimit = Math.min(budgetPerArticle, remaining - header.length - 4)
    lines.push(header)
    lines.push(a.body.slice(0, bodyLimit))
    lines.push('')
    used = lines.join('\n').length
  }

  return lines.join('\n')
}

async function getKbCatalogTitles(excludeIds: string[]): Promise<string[]> {
  const articles = await prisma.kbArticle.findMany({
    where: {
      isPublished: true,
      id: excludeIds.length ? { notIn: excludeIds } : undefined,
    },
    select: { title: true, tags: true },
    orderBy: { title: 'asc' },
    take: 20,
  })
  return articles.map(a =>
    `- "${a.title}"${a.tags.length ? ` [${a.tags.join(', ')}]` : ''}`
  )
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableGeminiStatus(status: number): boolean {
  return status === 429 || status === 503 || status === 500
}

function normalizeChatHistory(
  history: Array<{ role: string; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const pairs: Array<{ role: 'user' | 'assistant'; content: string }> = []
  for (let i = 0; i < history.length; i++) {
    const current = history[i]
    const next = history[i + 1]
    if (current.role === 'user' && next?.role === 'assistant') {
      pairs.push(
        { role: 'user', content: current.content },
        { role: 'assistant', content: next.content }
      )
      i++
    }
  }
  return pairs.slice(-10)
}

function extractGeminiText(data: {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> }
    finishReason?: string
  }>
}): string {
  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts ?? []
  const text = parts.find(p => p.text && !p.thought)?.text?.trim()
    || parts.find(p => p.text)?.text?.trim()
  if (text) return text

  if (candidate?.finishReason === 'SAFETY') {
    return 'Je ne peux pas répondre à cette question pour des raisons de sécurité. Reformulez votre demande.'
  }

  return 'Je ne peux pas répondre à cette question pour le moment.'
}

async function callGeminiChat(
  systemPrompt: string,
  history: Array<{ role: string; content: string }>,
  userMessage: string,
  options?: { maxOutputTokens?: number }
): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('NOT_CONFIGURED')

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash']
  const normalizedHistory = normalizeChatHistory(history)
  const maxOutputTokens = options?.maxOutputTokens ?? 800

  const contents = [
    ...normalizedHistory.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: userMessage }] }
  ]

  let lastError = 'Gemini API error: unknown'

  for (const model of models) {
    const configs: Array<Record<string, unknown>> = [
      { maxOutputTokens, temperature: 0.2, thinkingConfig: { thinkingBudget: 0 } },
      { maxOutputTokens, temperature: 0.2 },
    ]

    for (const generationConfig of configs) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          signal: AbortSignal.timeout(55_000),
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            generationConfig
          })
        })

        if (!res.ok) {
          const errBody = await res.text().catch(() => '')
          lastError = `Gemini ${res.status}: ${errBody}`

          if (res.status === 400) break // try next config without thinkingConfig
          if (isRetryableGeminiStatus(res.status) && attempt < 2) {
            await sleep(1000 * Math.pow(2, attempt))
            continue
          }
          break
        }

        const data = await res.json() as Parameters<typeof extractGeminiText>[0]
        return extractGeminiText(data)
      }
    }
  }

  throw new Error(lastError)
}

// ─── POST /api/chat ──────────────────────────────────────────────────────────

router.post('/', chatLimiter, validate(MessageSchema), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Assistant IA non configuré sur ce serveur.' })
    }

    const { message, history } = req.body as z.infer<typeof MessageSchema>
    const userId = req.user!.userId
    const now = new Date()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    // ── Fetch everything in parallel ─────────────────────────────────────
    const [user, enrollments, careerEnrollments, passedQuizCount, recentCerts] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true, lastName: true, role: true,
          totalPoints: true, currentStreak: true,
          department: { select: { name: true } },
          tenant: { select: { name: true } }
        }
      }),
      prisma.enrollment.findMany({
        where: { userId, status: { not: 'COMPLETED' } },
        include: { module: { select: { title: true, estimatedMinutes: true, description: true } } },
        orderBy: { dueAt: 'asc' },
        take: 25
      }),
      prisma.careerPathEnrollment.findMany({
        where: { userId },
        include: { path: { select: { title: true, description: true } } },
        take: 5
      }),
      prisma.quizAttempt.count({ where: { userId, passed: true } }),
      prisma.certificate.findMany({
        where: { userId },
        select: { title: true, issuedAt: true, certNumber: true },
        orderBy: { issuedAt: 'desc' },
        take: 5
      })
    ])

    if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' })

    // ── KB: retrieve relevant articles first (priority context) ───────────
    const kbMatches = await findRelevantKbArticles(message, 5)
    // Signal for the head: what employees ask, and whether the KB had an answer
    prisma.chatQuestionLog.create({ data: { tenantId: getTenantId(), userId, departmentId: user.department ? (await prisma.user.findFirst({ where: { id: userId }, select: { departmentId: true } }))?.departmentId ?? null : null, question: message.slice(0, 300), kbHits: kbMatches.length } }).catch(() => {})
    const kbContext = formatKbContext(kbMatches)
    const catalogLines = await getKbCatalogTitles(kbMatches.map(a => a.id))
    const kbQuestion = isKbRelatedQuestion(message)

    // ── Build employee context ────────────────────────────────────────────
    const overdue   = enrollments.filter(e => e.dueAt && e.dueAt < now)
    const dueToday  = enrollments.filter(e => e.dueAt && e.dueAt >= now && e.dueAt <= todayEnd)
    const upcoming  = enrollments.filter(e => e.dueAt && e.dueAt > todayEnd && e.dueAt <= in7Days)
    const noDue     = enrollments.filter(e => !e.dueAt)

    const lines: string[] = []

    lines.push(kbContext)

    if (catalogLines.length) {
      lines.push('## Autres articles disponibles dans la base de connaissances')
      lines.push(...catalogLines)
      lines.push('')
    }

    lines.push('## Profil employé')
    lines.push(`Nom: ${user.firstName} ${user.lastName} | Rôle: ${user.role} | Département: ${user.department?.name ?? 'N/A'}`)
    lines.push(`Points totaux: ${user.totalPoints} | Streak actuel: ${user.currentStreak} jour(s) | Quiz réussis: ${passedQuizCount}`)
    lines.push('')

    if (overdue.length) {
      lines.push(`## ⚠ Formations EN RETARD (${overdue.length})`)
      overdue.forEach(e => lines.push(`- "${e.module.title}" — était dû le ${e.dueAt!.toLocaleDateString('fr-FR')}`))
      lines.push('')
    }
    if (dueToday.length) {
      lines.push(`## Formations dues AUJOURD'HUI`)
      dueToday.forEach(e => lines.push(`- "${e.module.title}"`))
      lines.push('')
    }
    if (upcoming.length) {
      lines.push(`## Formations à venir (7 prochains jours)`)
      upcoming.forEach(e => lines.push(`- "${e.module.title}" → ${e.dueAt!.toLocaleDateString('fr-FR')}`))
      lines.push('')
    }
    if (noDue.length) {
      lines.push(`## Formations assignées (sans deadline)`)
      noDue.slice(0, 6).forEach(e => lines.push(`- "${e.module.title}"`))
      lines.push('')
    }
    if (careerEnrollments.length) {
      lines.push(`## Parcours carrière`)
      careerEnrollments.forEach(e => lines.push(`- "${e.path.title}" — ${e.status} (${Math.round(e.progressPct ?? 0)}%)`))
      lines.push('')
    }
    if (recentCerts.length) {
      lines.push(`## Certificats obtenus`)
      recentCerts.forEach(c => lines.push(`- "${c.title}" (${c.certNumber}) — ${c.issuedAt.toLocaleDateString('fr-FR')}`))
      lines.push('')
    }

    const tenantName = user.tenant?.name
    const MAX_SYSTEM_PROMPT_CHARS = 32000
    let systemPrompt = `Tu es l'assistant intelligent de ${PLATFORM_NAME}, la plateforme de formation interne de l'entreprise${tenantName ? ` ${tenantName}` : ''}.

MISSION: Répondre aux questions des employés en t'appuyant d'abord sur la BASE DE CONNAISSANCES, puis sur leurs données personnelles (formations, progression).

═══ RÈGLES PRIORITAIRES — BASE DE CONNAISSANCES ═══
1. La section "BASE DE CONNAISSANCES" ci-dessous est la source de vérité officielle pour les produits, tarifs, forfaits, procédures, SLA, add-ons et services de l'entreprise.
2. Pour toute question sur produits/tarifs/plans/procédures/promotions : tu DOIS répondre à partir du contenu des articles KB fournis.
3. Reprends les informations exactes (prix, délais, conditions, étapes) telles qu'elles figurent dans les articles — ne les invente jamais.
4. Si plusieurs articles sont pertinents, synthétise-les clairement (listes ou tableaux si utile).
5. Ne dis JAMAIS "je n'ai pas cette information" ou "consultez le département" si la réponse est dans les articles KB.
6. Mentionne le nom de l'article source entre parenthèses en fin de réponse quand tu cites des infos produit/tarif.
7. Si aucun article ne couvre la question, dis-le clairement et oriente vers le bon département.

DONNÉES DISPONIBLES:
${lines.join('\n')}

INSTRUCTIONS GÉNÉRALES:
- Réponds en français, de façon claire et professionnelle
- ${kbQuestion
    ? 'Cette question concerne probablement la base de connaissances : priorise les articles KB et donne des détails concrets (tarifs, caractéristiques, étapes).'
    : 'Réponds en 2-4 phrases sauf si une liste aide vraiment.'}
- Pour les questions sur les formations personnelles de l'employé, utilise la section "Profil employé"
- Si l'employé a des formations en retard, mentionne-le brièvement en fin de réponse
- Ne donne jamais d'IDs techniques, mots de passe, ou données sensibles`

    if (systemPrompt.length > MAX_SYSTEM_PROMPT_CHARS) {
      systemPrompt = systemPrompt.slice(0, MAX_SYSTEM_PROMPT_CHARS) + '\n\n[... contexte tronqué ...]'
    }

    const reply = await callGeminiChat(systemPrompt, history, message, {
      maxOutputTokens: kbQuestion ? 1200 : 800
    })
    res.json({ reply })

  } catch (err) {
    const msg = (err as Error).message
    if (msg === 'NOT_CONFIGURED') {
      return res.status(503).json({ error: 'Assistant IA non configuré sur ce serveur.' })
    }
    if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
      return res.status(429).json({ error: 'Service IA surchargé. Réessayez dans quelques instants.' })
    }
    logger.error('Chat error:', { message: (err as Error).message, stack: (err as Error).stack })
    res.status(500).json({ error: 'Erreur du chat. Réessayez dans un instant.' })
  }
})

export default router
