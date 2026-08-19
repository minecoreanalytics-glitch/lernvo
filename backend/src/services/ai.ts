/**
 * AI Content Generator Service
 * Uses Google Gemini API to generate training modules and quizzes
 * Supports multimodal input (text, audio, video) and multiple output formats
 */

import { redis } from '../utils/redis'
import { logger } from '../utils/logger'
import { randomUUID } from 'crypto'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse') as (buffer: Buffer) => Promise<{ text: string }>

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

// ─── Types ──────────────────────────────────────────────────────────────────

export type TrainingPurpose = 'Processus' | 'Produit' | 'Dépannage' | 'Promotion'
export type TrainingFormat = 'Texte' | 'Vidéo' | 'Diaporama'

interface GeneratedContent {
  title: string
  description: string
  estimatedMinutes: number
  sections: Array<{
    title: string
    body: string   // markdown
    order: number
  }>
}

interface GeneratedQuiz {
  title: string
  description: string
  timeLimit: number  // seconds
  passingScore: number
  questions: Array<{
    text: string
    options: Array<{ id: string; text: string; isCorrect: boolean }>
    explanation: string
    difficulty: number
    points: number
    order: number
  }>
}

export interface GenerateModuleResult {
  module: GeneratedContent
  quiz: GeneratedQuiz
}

export interface AnalysisResult {
  sessionId: string
  purpose: TrainingPurpose
  format: TrainingFormat
  summary: string
  suggestedTitle: string
  transcription: string
  fileInfo?: { name: string; size: number; type: string }
}

// ─── Purpose & Format prompt instructions ───────────────────────────────────

const PURPOSE_INSTRUCTIONS: Record<TrainingPurpose, string> = {
  Processus: `Cette formation porte sur un PROCESSUS ou une PROCÉDURE.
Structure le contenu autour de:
- Les étapes séquentielles du processus
- Les prérequis et conditions
- Les checklists et points de contrôle
- Les erreurs courantes à éviter
- Les responsabilités de chaque acteur
Utilise un ton procédural, clair et méthodique. Inclus des diagrammes en texte si possible.`,

  Produit: `Cette formation porte sur un PRODUIT ou ses FONCTIONNALITÉS.
Structure le contenu autour de:
- La présentation et proposition de valeur du produit
- Les fonctionnalités clés et leurs bénéfices
- Les cas d'utilisation concrets
- Les comparaisons et avantages compétitifs
- Les FAQ clients fréquentes
Utilise un ton informatif et orienté bénéfices client.`,

  Dépannage: `Cette formation porte sur le DÉPANNAGE et la RÉSOLUTION DE PROBLÈMES.
Structure le contenu autour de:
- Les problèmes les plus fréquents (top 5-10)
- Les étapes de diagnostic pour chaque problème
- Les solutions étape par étape
- Les critères d'escalade
- Les outils de diagnostic à utiliser
Utilise un ton technique mais accessible. Inclus des arbres de décision en texte.`,

  Promotion: `Cette formation porte sur la PROMOTION et la VENTE.
Structure le contenu autour de:
- Les arguments de vente clés (pitch)
- Les objections courantes et comment y répondre
- Les scripts de conversation
- Les techniques de closing
- Les profils clients cibles
Utilise un ton persuasif et orienté action. Inclus des exemples de dialogues.`
}

// ─── Procedure document cleanup ─────────────────────────────────────────────

const DOCUMENT_CLEANUP_INSTRUCTIONS = `EXCLUSIONS OBLIGATOIRES — Ne jamais reproduire dans le contenu généré:
- Les en-têtes administratifs des documents de procédure : Direction, Service/Unité, Code, Page X de Y, Procédure, Date, Périodicité, Rédaction, Vérification, Approbation
- Les numéros de section hiérarchiques isolés (A, A.1, A.2, B, B.1, C.3, E.1.1.1, etc.) — remplace-les par des titres descriptifs et du contenu pédagogique
- Les métadonnées de page, codes document et signatures d'approbation
Concentre-toi uniquement sur le contenu utile : description, objectif, tâches, précisions, étapes opérationnelles.`

function isProcedureHeaderLine(line: string): boolean {
  const t = line.trim()
  if (!t) return false
  return /^(Direction|Service\s*\/\s*Unité|Code|Procédure|Date|Périodicité|Rédaction|Vérification|Approbation)\s*[:：]/i.test(t)
    || /^Page\s+\d+\s+de\s+\d+$/i.test(t)
}

function isStandaloneSectionCode(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 12) return false
  return /^[A-Z](?:\.\d+)*$/.test(t)
}

/** Remove procedure headers and standalone section codes from extracted source text */
function sanitizeProcedureSourceContent(text: string): string {
  if (!text) return text
  const lines = text.split('\n').filter(line => {
    if (!line.trim()) return true
    if (isProcedureHeaderLine(line)) return false
    if (isStandaloneSectionCode(line)) return false
    return true
  })
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

const FORMAT_INSTRUCTIONS: Record<TrainingFormat, { system: string; sectionFormat: string }> = {
  Texte: {
    system: `Le format de sortie est TEXTE (formation écrite classique).`,
    sectionFormat: `Chaque section doit contenir du contenu en markdown riche (paragraphes, listes, gras, italique, tableaux). Minimum 200 mots par section. Utilise des titres, sous-titres et mise en forme variée.`
  },
  Vidéo: {
    system: `Le format de sortie est SCRIPT VIDÉO (formation vidéo).`,
    sectionFormat: `Chaque section représente un segment vidéo. Le body doit être structuré ainsi en markdown:

## Script narratif
Le texte complet à lire/dire face caméra. Écris comme un script naturel, conversationnel.

## Notes visuelles
- [Description de ce qui doit apparaître à l'écran]
- [Graphiques, captures d'écran, animations à montrer]

## Points clés à retenir
- Point 1
- Point 2

Minimum 150 mots de script par segment.`
  },
  Diaporama: {
    system: `Le format de sortie est DIAPORAMA (présentation slides).`,
    sectionFormat: `Chaque section représente un groupe de 2-3 slides. Le body doit être structuré ainsi en markdown:

### Slide 1: [Titre de la slide]
- Point clé 1
- Point clé 2
- Point clé 3

> Note présentateur: Ce que le présentateur doit dire pour accompagner cette slide.

### Slide 2: [Titre de la slide]
- Point clé 1
- Point clé 2

> Note présentateur: Explication détaillée.

Maximum 5-6 bullet points par slide. Les notes présentateur doivent être détaillées (50+ mots).`
  }
}

// ─── Service ────────────────────────────────────────────────────────────────

export class AIService {

  static isConfigured(): boolean {
    return !!GEMINI_API_KEY
  }

  private static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private static isRetryableGeminiStatus(status: number): boolean {
    return status === 429 || status === 503 || status === 500
  }

  private static parseGeminiJson(text: string): unknown {
    let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    function sanitizeJsonControlChars(raw: string): string {
      const result: string[] = []
      let inString = false
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i]
        if (ch === '"' && (i === 0 || raw[i - 1] !== '\\')) {
          inString = !inString
          result.push(ch)
        } else if (inString && ch.charCodeAt(0) < 32) {
          if (ch === '\n') result.push('\\n')
          else if (ch === '\r') result.push('\\r')
          else if (ch === '\t') result.push('\\t')
        } else {
          result.push(ch)
        }
      }
      return result.join('')
    }

    jsonStr = sanitizeJsonControlChars(jsonStr)

    try {
      return JSON.parse(jsonStr)
    } catch (firstError) {
      logger.warn(`JSON parse attempt 1 failed: ${(firstError as Error).message}, trying repair...`)
      let openBraces = 0, openBrackets = 0
      let inStr = false
      for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]
        if (ch === '"' && (i === 0 || jsonStr[i - 1] !== '\\')) inStr = !inStr
        if (!inStr) {
          if (ch === '{') openBraces++
          else if (ch === '}') openBraces--
          else if (ch === '[') openBrackets++
          else if (ch === ']') openBrackets--
        }
      }
      jsonStr = jsonStr.replace(/,\s*$/, '').replace(/,\s*"[^"]*$/, '')
      const quoteCount = (jsonStr.match(/(?<!\\)"/g) || []).length
      if (quoteCount % 2 !== 0) jsonStr += '"'
      for (let i = 0; i < openBrackets; i++) jsonStr += ']'
      for (let i = 0; i < openBraces; i++) jsonStr += '}'
      return JSON.parse(jsonStr)
    }
  }

  /**
   * Call Gemini API (text-only)
   */
  private static async callGemini(systemPrompt: string, userPrompt: string, maxTokens = 8000): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{
            parts: [{ text: userPrompt }]
          }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.7,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      })

      if (!response.ok) {
        const err = await response.text()
        if (this.isRetryableGeminiStatus(response.status) && attempt < maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt))
          continue
        }
        throw new Error(`Gemini API error: ${response.status} - ${err}`)
      }

      const data = await response.json() as {
        candidates: Array<{
          content: { parts: Array<{ text?: string; thought?: boolean }> }
        }>
      }

      const parts = data.candidates?.[0]?.content?.parts ?? []
      const text = parts.find(p => !p.thought)?.text?.trim() || parts[0]?.text?.trim() || ''
      if (!text) throw new Error('Gemini returned empty response')

      return text
    }

    throw new Error('Gemini API error: max retries exceeded')
  }

  /**
   * Call Gemini API with multimodal input (text + audio/video/image)
   */
  private static async callGeminiMultimodal(
    systemPrompt: string,
    parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>,
    maxTokens = 8000
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
    const maxRetries = 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY! },
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [{ parts }],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature: 0.5,
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      })

      if (!response.ok) {
        const err = await response.text()
        if (this.isRetryableGeminiStatus(response.status) && attempt < maxRetries - 1) {
          await this.sleep(1000 * Math.pow(2, attempt))
          continue
        }
        throw new Error(`Gemini API error: ${response.status} - ${err}`)
      }

      const data = await response.json() as {
        candidates: Array<{
          content: { parts: Array<{ text?: string; thought?: boolean }> }
        }>
      }

      const responseParts = data.candidates?.[0]?.content?.parts ?? []
      const text = responseParts.find(p => !p.thought)?.text?.trim() || responseParts[0]?.text?.trim() || ''
      if (!text) throw new Error('Gemini returned empty response')

      return text
    }

    throw new Error('Gemini API error: max retries exceeded')
  }

  /**
   * Analyze uploaded content — determine purpose, format, transcribe audio/video
   */
  static async analyzeContent(options: {
    file?: { buffer: Buffer; mimetype: string; originalname: string; size: number }
    prompt?: string
    kbContent?: string
  }): Promise<AnalysisResult> {
    const { file, prompt, kbContent } = options

    const systemPrompt = `Tu es un expert en ingénierie pédagogique.
Tu analyses du contenu source pour déterminer le meilleur type de formation à créer.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide.`

    const analysisRequestMedia = `Analyse le contenu fourni et détermine:

1. "purpose" — Le TYPE de formation le plus adapté parmi:
   - "Processus" (procédures, workflows, étapes à suivre)
   - "Produit" (fonctionnalités produit, avantages, spécifications)
   - "Dépannage" (résolution de problèmes, diagnostic, troubleshooting)
   - "Promotion" (vente, argumentaire commercial, pitch)

2. "format" — Le FORMAT de sortie le plus adapté parmi:
   - "Texte" (formation écrite avec sections détaillées)
   - "Vidéo" (script vidéo avec notes visuelles)
   - "Diaporama" (présentation slides avec notes présentateur)

3. "summary" — Un résumé du contenu analysé (2-3 phrases en français)

4. "suggestedTitle" — Un titre de formation suggéré (en français)

5. "transcription" — Fournis la transcription complète en français, SANS les en-têtes administratifs (Direction, Code, Date, etc.) ni les numéros de section isolés (A, A.1, B.2…).

JSON format:
{
  "purpose": "Processus",
  "format": "Texte",
  "summary": "Ce contenu traite de...",
  "suggestedTitle": "Formation: ...",
  "transcription": "Texte complet transcrit..."
}`

    const analysisRequestText = `Analyse le contenu fourni et détermine:

1. "purpose" — Le TYPE de formation le plus adapté parmi:
   - "Processus" (procédures, workflows, étapes à suivre)
   - "Produit" (fonctionnalités produit, avantages, spécifications)
   - "Dépannage" (résolution de problèmes, diagnostic, troubleshooting)
   - "Promotion" (vente, argumentaire commercial, pitch)

2. "format" — Le FORMAT de sortie le plus adapté parmi:
   - "Texte" (formation écrite avec sections détaillées)
   - "Vidéo" (script vidéo avec notes visuelles)
   - "Diaporama" (présentation slides avec notes présentateur)

3. "summary" — Un résumé du contenu analysé (2-3 phrases en français)

4. "suggestedTitle" — Un titre de formation suggéré (en français)

Ne renvoie PAS le contenu source complet — seulement purpose, format, summary et suggestedTitle.

JSON format:
{
  "purpose": "Processus",
  "format": "Texte",
  "summary": "Ce contenu traite de...",
  "suggestedTitle": "Formation: ..."
}`

    let text: string
    let extractedContent = ''
    const isMediaFile = file && (
      file.mimetype.startsWith('audio/') || file.mimetype.startsWith('video/')
    )

    if (isMediaFile && file) {
      const analysisRequest = analysisRequestMedia
      // Multimodal call for audio/video
      const base64Data = file.buffer.toString('base64')
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
        { inlineData: { mimeType: file.mimetype, data: base64Data } },
        { text: analysisRequest + (prompt ? `\n\nContexte additionnel de l'utilisateur: "${prompt}"` : '') +
                (kbContent ? `\n\nDocuments de référence:\n${kbContent}` : '') }
      ]
      text = await this.callGeminiMultimodal(systemPrompt, parts, 8000)
    } else {
      // Text-only call — extract content locally, ask Gemini only for metadata
      if (file) {
        if (file.mimetype === 'application/pdf') {
          const pdfData = await pdf(file.buffer)
          extractedContent = pdfData.text
        } else {
          extractedContent = file.buffer.toString('utf-8')
        }
        if (extractedContent.length > 15000) {
          extractedContent = extractedContent.slice(0, 15000) + '\n\n[... contenu tronqué ...]'
        }
      }

      const userPrompt = `${analysisRequestText}

${extractedContent ? `Contenu du fichier (${file?.originalname}):\n${extractedContent}\n` : ''}
${prompt ? `Description de l'utilisateur: "${prompt}"` : ''}
${kbContent ? `Documents de référence:\n${kbContent}` : ''}`

      text = await this.callGemini(systemPrompt, userPrompt, 2000)
    }

    // Parse response
    const result = this.parseGeminiJson(text) as {
      purpose: TrainingPurpose
      format: TrainingFormat
      summary: string
      suggestedTitle: string
      transcription?: string
    }

    // For text/PDF files, use locally extracted content as transcription
    if (!isMediaFile && extractedContent) {
      result.transcription = sanitizeProcedureSourceContent(extractedContent)
    } else if (result.transcription) {
      result.transcription = sanitizeProcedureSourceContent(result.transcription)
    }

    // Validate purpose and format values
    const validPurposes: TrainingPurpose[] = ['Processus', 'Produit', 'Dépannage', 'Promotion']
    const validFormats: TrainingFormat[] = ['Texte', 'Vidéo', 'Diaporama']
    if (!validPurposes.includes(result.purpose)) result.purpose = 'Processus'
    if (!validFormats.includes(result.format)) result.format = 'Texte'

    // Cache the transcription/content in Redis for 30 minutes
    const sessionId = randomUUID()
    const cacheData = JSON.stringify({
      transcription: result.transcription || '',
      summary: result.summary,
      suggestedTitle: result.suggestedTitle,
      purpose: result.purpose,
      format: result.format,
      fileInfo: file ? { name: file.originalname, size: file.size, type: file.mimetype } : null
    })
    await redis.set(`ai:session:${sessionId}`, cacheData, 'EX', 1800) // 30 min

    logger.info(`AI analysis complete: purpose=${result.purpose}, format=${result.format}, sessionId=${sessionId}`)

    return {
      sessionId,
      purpose: result.purpose,
      format: result.format,
      summary: result.summary,
      suggestedTitle: result.suggestedTitle,
      transcription: result.transcription || '',
      fileInfo: file ? { name: file.originalname, size: file.size, type: file.mimetype } : undefined
    }
  }

  /**
   * Retrieve cached session data from analysis step
   */
  static async getSessionData(sessionId: string): Promise<{
    transcription: string
    summary: string
    suggestedTitle: string
    purpose: TrainingPurpose
    format: TrainingFormat
    fileInfo?: { name: string; size: number; type: string }
  } | null> {
    const data = await redis.get(`ai:session:${sessionId}`)
    if (!data) return null
    return JSON.parse(data)
  }

  /**
   * Generate a full training module + quiz from a topic/prompt
   * Now supports purpose and format for tailored content
   */
  static async generateModule(prompt: string, options?: {
    language?: string
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
    numSections?: number
    numQuestions?: number
    context?: string
    fileContent?: string
    purpose?: TrainingPurpose
    format?: TrainingFormat
  }): Promise<GenerateModuleResult> {
    const {
      language = 'fr',
      difficulty = 'intermediate',
      numSections = 4,
      numQuestions = 10,
      context = 'Lernvo est une plateforme de formation professionnelle en ligne.',
      fileContent = '',
      purpose,
      format
    } = options || {}

    const cleanedFileContent = fileContent ? sanitizeProcedureSourceContent(fileContent) : ''

    // Build purpose-specific instructions
    const purposeInstr = purpose ? PURPOSE_INSTRUCTIONS[purpose] : ''
    const formatInstr = format ? FORMAT_INSTRUCTIONS[format] : FORMAT_INSTRUCTIONS['Texte']

    const difficultyLabel = { beginner: 'Débutant', intermediate: 'Intermédiaire', advanced: 'Avancé' }[difficulty]

    const systemPrompt = `Tu es un expert en formation professionnelle pour ${context}

Tu génères du contenu de formation structuré, pédagogique et engageant en ${language === 'fr' ? 'français' : 'anglais'}.

${purposeInstr ? `OBJECTIF DE LA FORMATION:\n${purposeInstr}\n` : ''}
${formatInstr.system}
${formatInstr.sectionFormat}

Niveau de difficulté: ${difficultyLabel}
${difficulty === 'beginner' ? '- Utilise un vocabulaire simple, beaucoup d\'exemples concrets, pas de jargon technique sans explication.' : ''}
${difficulty === 'intermediate' ? '- Équilibre entre théorie et pratique, vocabulaire technique modéré, exemples professionnels.' : ''}
${difficulty === 'advanced' ? '- Contenu approfondi, jargon technique acceptable, cas complexes, scénarios avancés.' : ''}

${DOCUMENT_CLEANUP_INSTRUCTIONS}

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide.`

    const fileSection = cleanedFileContent ? `\n\nContenu source de référence (métadonnées administratives déjà retirées):\n${cleanedFileContent}\n` : ''

    // Adapt quiz instructions based on purpose
    let quizInstructions = ''
    if (purpose === 'Processus') {
      quizInstructions = 'Les questions doivent tester la connaissance des étapes du processus, l\'ordre des opérations, et les points de contrôle.'
    } else if (purpose === 'Produit') {
      quizInstructions = 'Les questions doivent tester la connaissance des fonctionnalités, des avantages et des cas d\'utilisation du produit.'
    } else if (purpose === 'Dépannage') {
      quizInstructions = 'Les questions doivent tester la capacité à diagnostiquer des problèmes et choisir la bonne solution.'
    } else if (purpose === 'Promotion') {
      quizInstructions = 'Les questions doivent tester la maîtrise des arguments de vente, la gestion des objections et les techniques de closing.'
    }

    const userPrompt = `Génère un module de formation complet sur le sujet suivant:
"${prompt}"${fileSection}

Niveau: ${difficultyLabel} (${difficulty})
Nombre de sections: ${numSections}
Nombre de questions quiz: ${numQuestions}
${quizInstructions ? `\nInstructions quiz: ${quizInstructions}` : ''}

Le JSON doit avoir exactement cette structure:
{
  "module": {
    "title": "Titre du module",
    "description": "Description courte (2-3 phrases)",
    "estimatedMinutes": 30,
    "sections": [
      {
        "title": "Titre de la section",
        "body": "Contenu selon le format demandé. Riche et détaillé.",
        "order": 1
      }
    ]
  },
  "quiz": {
    "title": "Quiz: Titre",
    "description": "Description du quiz",
    "timeLimit": 600,
    "passingScore": 70,
    "questions": [
      {
        "text": "Question ?",
        "options": [
          {"id": "a", "text": "Option A", "isCorrect": false},
          {"id": "b", "text": "Option B", "isCorrect": true},
          {"id": "c", "text": "Option C", "isCorrect": false},
          {"id": "d", "text": "Option D", "isCorrect": false}
        ],
        "explanation": "Explication de la bonne réponse",
        "difficulty": 2,
        "points": 10,
        "order": 1
      }
    ]
  }
}`

    const text = await this.callGemini(systemPrompt, userPrompt, 16000)

    // Parse JSON (handle potential markdown wrapping and truncation)
    let jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // Sanitize control characters inside JSON string values only
    // Walk through the string, track whether we're inside a quoted string
    function sanitizeJsonControlChars(raw: string): string {
      const result: string[] = []
      let inString = false
      for (let i = 0; i < raw.length; i++) {
        const ch = raw[i]
        if (ch === '"' && (i === 0 || raw[i - 1] !== '\\')) {
          inString = !inString
          result.push(ch)
        } else if (inString && ch.charCodeAt(0) < 32) {
          // Control character inside a string — escape it
          if (ch === '\n') result.push('\\n')
          else if (ch === '\r') result.push('\\r')
          else if (ch === '\t') result.push('\\t')
          // else skip other control chars
        } else {
          result.push(ch)
        }
      }
      return result.join('')
    }

    jsonStr = sanitizeJsonControlChars(jsonStr)

    // Try to parse, then repair truncated JSON
    let parsed: GenerateModuleResult
    try {
      parsed = JSON.parse(jsonStr) as GenerateModuleResult
    } catch (firstError) {
      logger.warn(`JSON parse attempt 1 failed: ${(firstError as Error).message}, trying repair...`)
      // Count open braces/brackets and close them
      let openBraces = 0, openBrackets = 0
      let inStr = false
      for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i]
        if (ch === '"' && (i === 0 || jsonStr[i - 1] !== '\\')) inStr = !inStr
        if (!inStr) {
          if (ch === '{') openBraces++
          else if (ch === '}') openBraces--
          else if (ch === '[') openBrackets++
          else if (ch === ']') openBrackets--
        }
      }
      // Remove trailing comma or incomplete string/property
      jsonStr = jsonStr.replace(/,\s*$/, '').replace(/,\s*"[^"]*$/, '')
      // If inside a string, close it
      const quoteCount = (jsonStr.match(/(?<!\\)"/g) || []).length
      if (quoteCount % 2 !== 0) jsonStr += '"'
      // Close structures
      for (let i = 0; i < openBrackets; i++) jsonStr += ']'
      for (let i = 0; i < openBraces; i++) jsonStr += '}'
      parsed = JSON.parse(jsonStr) as GenerateModuleResult
    }

    // Validate the parsed result has required structure
    if (!parsed.module?.title || !parsed.module?.sections?.length) {
      logger.error('AI returned invalid module structure:', JSON.stringify(parsed.module || {}).slice(0, 200))
      throw new Error('L\'IA a généré une réponse incomplète. Veuillez réessayer la génération.')
    }
    if (!parsed.quiz?.questions?.length) {
      logger.error('AI returned invalid quiz structure:', JSON.stringify(parsed.quiz || {}).slice(0, 200))
      throw new Error('L\'IA a généré un quiz incomplet. Veuillez réessayer la génération.')
    }

    return parsed
  }

  /**
   * Generate a complete onboarding plan for a role/department.
   * Returns module topics with phases, descriptions, and suggested due days.
   * Each module can then be auto-generated with generateModule().
   */
  static async generateOnboardingPlan(options: {
    role: string
    department?: string
    companyContext?: string
    durationDays?: number
  }): Promise<{
    name: string
    description: string
    expectedDays: number
    modules: Array<{
      title: string
      description: string
      purpose: TrainingPurpose
      phase: string
      dueDaysFromHire: number
      order: number
      difficulty: 'beginner' | 'intermediate' | 'advanced'
    }>
  }> {
    const { role, department, companyContext, durationDays = 30 } = options

    const systemPrompt = `Tu es un expert en onboarding et intégration de nouveaux employés.
Tu crées des plans d'intégration structurés, progressifs et complets.
Les plans doivent être réalistes et adaptés au rôle et au département.

IMPORTANT: Réponds UNIQUEMENT avec un JSON valide.`

    const userPrompt = `Génère un plan d'onboarding complet pour un nouvel employé:

Rôle: ${role}
${department ? `Département: ${department}` : ''}
${companyContext ? `Contexte entreprise: ${companyContext}` : ''}
Durée totale: ${durationDays} jours

Le plan doit couvrir:
- Semaine 1 (jours 1-7): Accueil, culture d'entreprise, outils, sécurité
- Semaine 2 (jours 8-14): Formation métier de base, processus internes
- Semaine 3-4 (jours 15-30): Formation avancée, mise en pratique, évaluation

Génère entre 6 et 12 modules de formation avec des deadlines progressives.

JSON format:
{
  "name": "Onboarding [Rôle] - [Département]",
  "description": "Plan d'intégration pour...",
  "expectedDays": ${durationDays},
  "modules": [
    {
      "title": "Titre du module",
      "description": "Description courte",
      "purpose": "Processus",
      "phase": "Semaine 1",
      "dueDaysFromHire": 3,
      "order": 1,
      "difficulty": "beginner"
    }
  ]
}

Purposes possibles: "Processus", "Produit", "Dépannage", "Promotion"
Difficultés: "beginner" (semaine 1), "intermediate" (semaine 2), "advanced" (semaine 3-4)`

    const text = await this.callGemini(systemPrompt, userPrompt, 8000)
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr)
  }

  /**
   * Generate quiz questions only for an existing module
   */
  static async generateQuiz(moduleTitle: string, moduleContent: string, options?: {
    numQuestions?: number
    difficulty?: 'beginner' | 'intermediate' | 'advanced'
  }): Promise<GeneratedQuiz> {
    const { numQuestions = 10, difficulty = 'intermediate' } = options || {}

    const text = await this.callGemini(
      'Tu es un expert en évaluation pédagogique. Réponds UNIQUEMENT avec un JSON valide.',
      `Génère ${numQuestions} questions de quiz (niveau: ${difficulty}) basées sur ce contenu de formation:

Titre: ${moduleTitle}
Contenu: ${moduleContent}

JSON format:
{
  "title": "Quiz: ${moduleTitle}",
  "description": "Évaluez vos connaissances",
  "timeLimit": 600,
  "passingScore": 70,
  "questions": [
    {
      "text": "Question ?",
      "options": [
        {"id": "a", "text": "Option", "isCorrect": false},
        {"id": "b", "text": "Option", "isCorrect": true},
        {"id": "c", "text": "Option", "isCorrect": false},
        {"id": "d", "text": "Option", "isCorrect": false}
      ],
      "explanation": "Explication",
      "difficulty": 2,
      "points": 10,
      "order": 1
    }
  ]
}`,
      4000
    )

    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(jsonStr) as GeneratedQuiz
  }

  /**
   * Extract plain text from an uploaded document (PDF, TXT, MD, CSV)
   */
  static async extractDocumentText(file: {
    buffer: Buffer
    mimetype: string
    originalname: string
  }): Promise<string> {
    let text = ''
    if (file.mimetype === 'application/pdf' || file.originalname.match(/\.pdf$/i)) {
      const pdfData = await pdf(file.buffer)
      text = pdfData.text
    } else if (
      file.mimetype === 'text/plain' ||
      file.mimetype === 'text/markdown' ||
      file.mimetype === 'text/csv' ||
      file.originalname.match(/\.(txt|md|csv)$/i)
    ) {
      text = file.buffer.toString('utf-8')
    } else {
      throw new Error('Type de fichier non supporté. Utilisez PDF, TXT, MD ou CSV.')
    }

    text = text.replace(/\r\n/g, '\n').trim()
    if (!text) throw new Error('Le document ne contient pas de texte extractible.')
    return text
  }

  /**
   * Generate a KB article (title, markdown body, tags) from document text
   */
  static async generateKbArticle(
    sourceText: string,
    options?: { filename?: string }
  ): Promise<{ title: string; body: string; tags: string[] }> {
    const truncated = sourceText.length > 25000
      ? sourceText.slice(0, 25000) + '\n\n[... contenu tronqué ...]'
      : sourceText

    const systemPrompt = `Tu es un expert en documentation d'entreprise.
Tu transformes des documents sources en articles de base de connaissances clairs, complets et structurés en français.
IMPORTANT: Réponds UNIQUEMENT avec un JSON valide.`

    const userPrompt = `À partir du contenu source ci-dessous, crée un article de base de connaissances.

1. "title" — Titre clair et descriptif en français (max 120 caractères)
2. "body" — Contenu complet en markdown bien structuré (titres ##, listes, tableaux si pertinent). Conserve TOUTES les informations importantes : tarifs, procédures, étapes, contacts, conditions.
3. "tags" — 3 à 8 mots-clés pertinents en minuscules

${options?.filename ? `Nom du fichier source: ${options.filename}\n` : ''}
Contenu source:
${truncated}

JSON format:
{
  "title": "Titre de l'article",
  "body": "# Titre\\n\\nContenu markdown...",
  "tags": ["mot-clé1", "mot-clé2"]
}`

    try {
      const text = await this.callGemini(systemPrompt, userPrompt, 16000)
      const result = this.parseGeminiJson(text) as { title?: string; body?: string; tags?: string[] }
      const title = result.title?.trim() || options?.filename?.replace(/\.[^.]+$/, '') || 'Article importé'
      const body = result.body?.trim() || truncated
      const tags = Array.isArray(result.tags)
        ? result.tags.map(t => String(t).trim().toLowerCase()).filter(Boolean).slice(0, 10)
        : []
      return { title, body, tags }
    } catch (err) {
      logger.warn('KB AI generation failed, using extracted text fallback:', err)
      const fallbackTitle = options?.filename?.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Article importé'
      return {
        title: fallbackTitle,
        body: `# ${fallbackTitle}\n\n${truncated}`,
        tags: []
      }
    }
  }
}
