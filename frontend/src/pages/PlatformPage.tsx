import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ShieldCheck, BookOpenCheck, MessageSquareText, Activity, Plug, Globe, Award,
  CheckCircle2, ArrowRight, Sparkles, FileCheck2, GitBranch, Bell, BarChart3,
  Lock, Database, Layers, Gauge,
} from 'lucide-react'
import BrandMark from '../components/BrandMark'
import MarketingNav from '../components/MarketingNav'
import type { Lang } from '../marketing/data'

/* ───────────────────────────── Copy (FR first, EN variant) ───────────────────────────── */
const T = {
  fr: {
    nav: { platform: 'Plateforme', pricing: 'Tarifs', faq: 'Questions', login: 'Se connecter', demo: 'Réserver une démo' },
    hero: {
      kicker: 'La plateforme',
      h1a: 'Une plateforme. Trois piliers.',
      h1b: 'La connaissance qui devient une preuve.',
      sub: 'Une source de vérité approuvée, un assistant IA qui n’y répond que depuis elle, et la preuve, par département, que vos équipes la connaissent. Un seul produit.',
      cta1: 'Réserver une démo', cta2: 'Voir les tarifs',
    },
    proof: {
      items: ['100+ employés en production', '394 procédures & produits', '3 344 questions de quiz', '39 départements'],
      note: 'Premier déploiement : un groupe multi-filiales de 100+ employés.',
    },
    arch: { title: 'Trois piliers, une boucle qui se referme.', links: [['La source', '#source'], ['L’assistant', '#assistant'], ['La preuve', '#preuve']] },
    pillars: [
      {
        id: 'source', n: '01', icon: FileCheck2,
        kicker: 'La source',
        title: 'Une source de vérité approuvée',
        purpose: 'Procédures, fiches produits, tarifs : brouillon → relecture → approuvé vN. Versionné. Les employés ne voient jamais un brouillon.',
        points: [
          [GitBranch, 'Approbation & versioning', 'Chaque changement passe par une validation. La version approuvée est la seule que le terrain voit.'],
          [BookOpenCheck, 'Lu et compris', 'À chaque approbation, les bonnes personnes reçoivent « à lire et valider ». Trace par personne et par version.'],
          [Award, 'Quiz, certificats, parcours', 'Quiz de section, certificats vérifiables, parcours carrière : les gens progressent, la RH a la preuve.'],
        ],
      },
      {
        id: 'assistant', n: '02', icon: MessageSquareText,
        kicker: 'L’assistant',
        title: 'Un assistant IA qui ne peut pas inventer',
        purpose: 'Il répond à vos équipes en secondes, uniquement depuis la connaissance approuvée, toujours cité à la version.',
        points: [
          [ShieldCheck, 'Ancré dans l’approuvé', 'Chaque réponse vient de vos documents approuvés, jamais du web, jamais d’une supposition.'],
          [FileCheck2, 'Cité à la version', '« source : Procédure v3 » sous chaque réponse. Vous savez toujours d’où ça vient.'],
          [Sparkles, 'Généré depuis vos PDF', 'Importez vos documents : l’IA en tire modules, quiz et réponses. Ce qu’elle ne trouve pas devient un signal.'],
        ],
      },
      {
        id: 'preuve', n: '03', icon: BarChart3,
        kicker: 'La preuve',
        title: 'La preuve, par département',
        purpose: 'Couverture en temps réel : « 87 % du Support a validé la v3 ». Vous ne l’espérez plus, vous le mesurez.',
        points: [
          [Gauge, 'Couverture « lu et compris »', 'Par département et par version : qui a validé, qui reste, qui est en retard.'],
          [Bell, 'Signaux qui remontent', 'Échecs de quiz, questions sans réponse, documents périmés : les angles morts deviennent des alertes.'],
          [Activity, 'Raisonné par le cœur Morpheus', 'Optionnellement, les signaux sont priorisés et transformés en recommandations d’action.'],
        ],
      },
    ],
    ai: {
      title: 'L’IA à chaque étage, jamais en roue libre.',
      sub: 'La même règle partout : elle travaille depuis l’approuvé, cite sa source, et signale ce qui manque plutôt que d’inventer.',
      items: [
        ['Générer', 'Modules, quiz et fiches tirés de vos PDF, en minutes.'],
        ['Répondre', 'L’assistant répond à l’agent, cité à la version.'],
        ['Écouter', 'Version audio des sections (synthèse vocale) pour le terrain.'],
        ['Alerter', 'Les questions sans réponse et les échecs deviennent des signaux.'],
      ],
    },
    enterprise: {
      title: 'Pensé pour l’entreprise.',
      sub: 'Ce qu’un acheteur sécurité, RH ou IT vérifie avant de signer.',
      items: [
        [Lock, 'Isolation par entreprise', 'Les données de chaque tenant restent à part, l’isolation est imposée à chaque livraison par la CI.'],
        [ShieldCheck, 'Sécurité & données', 'Secrets chiffrés, aucune donnée client dans le code, export à tout moment.'],
        [Plug, 'SIRH dedans, certificats dehors', 'Odoo, clé API ou CSV : employés et organigramme importés, certificats renvoyés dans la fiche RH.'],
        [Globe, 'API publique', 'Votre site affiche exactement les produits et tarifs approuvés que vos équipes ont validés.'],
        [Layers, 'Votre espace, votre marque', 'entreprise.lernvo.com, votre logo, TLS dédié par domaine.'],
        [Database, 'Prix par employé actif', 'Un seul prix par employé actif. Pas de frais de plateforme, pas de surprise.'],
      ],
    },
    integrations: { title: 'S’intègre à ce que vous avez déjà.', list: ['Odoo (SIRH)', 'Import CSV', 'Clé API', 'Google Gemini (IA)', 'Cœur Morpheus', 'API publique'] },
    cta: { h2: 'Voir Lernvo sur vos procédures.', sub: '30 minutes, votre cas concret. Ou un pilote gratuit de 60 jours sur un département.', btn1: 'Réserver une démo', btn2: 'Démarrer un pilote' },
    footer: { tag: 'Lernvo, plateforme d’assurance de connaissance. Groupe Altis Holding / Minecore.', home: 'Accueil', login: 'Se connecter', space: 'Créer un espace' },
  },
  en: {
    nav: { platform: 'Platform', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', demo: 'Book a demo' },
    hero: {
      kicker: 'The platform',
      h1a: 'One platform. Three pillars.',
      h1b: 'Knowledge that becomes proof.',
      sub: 'An approved source of truth, an AI assistant that only answers from it, and proof, per department, that your teams know it. One product.',
      cta1: 'Book a demo', cta2: 'See pricing',
    },
    proof: {
      items: ['100+ employees in production', '394 procedures & products', '3,344 quiz questions', '39 departments'],
      note: 'First deployment: a 100+ employee multi-brand group.',
    },
    arch: { title: 'Three pillars, one loop that closes.', links: [['The source', '#source'], ['The assistant', '#assistant'], ['The proof', '#preuve']] },
    pillars: [
      {
        id: 'source', n: '01', icon: FileCheck2,
        kicker: 'The source',
        title: 'An approved source of truth',
        purpose: 'Procedures, product sheets, price lists: draft → review → approved vN. Versioned. Employees never see a draft.',
        points: [
          [GitBranch, 'Approval & versioning', 'Every change goes through review. The approved version is the only one the floor sees.'],
          [BookOpenCheck, 'Read & understood', 'On every approval the right people get "read & acknowledge". A trace per person and per version.'],
          [Award, 'Quizzes, certificates, paths', 'Section quizzes, verifiable certificates, career paths: people progress, HR has the proof.'],
        ],
      },
      {
        id: 'assistant', n: '02', icon: MessageSquareText,
        kicker: 'The assistant',
        title: 'An AI assistant that cannot make things up',
        purpose: 'It answers your teams in seconds, only from approved knowledge, always cited to the version.',
        points: [
          [ShieldCheck, 'Grounded in approved knowledge', 'Every answer comes from your approved documents, never the web, never a guess.'],
          [FileCheck2, 'Cited to the version', '"source: Procedure v3" under every answer. You always know where it came from.'],
          [Sparkles, 'Generated from your PDFs', 'Import your documents: the AI turns them into modules, quizzes and answers. What it can’t find becomes a signal.'],
        ],
      },
      {
        id: 'preuve', n: '03', icon: BarChart3,
        kicker: 'The proof',
        title: 'Proof, per department',
        purpose: 'Live coverage: "87% of Support acknowledged v3". You no longer hope it, you measure it.',
        points: [
          [Gauge, '"Read & understood" coverage', 'Per department and per version: who acknowledged, who is left, who is overdue.'],
          [Bell, 'Signals that surface', 'Quiz failures, unanswered questions, stale documents: blind spots become alerts.'],
          [Activity, 'Reasoned by the Morpheus core', 'Optionally, signals are prioritized and turned into recommended actions.'],
        ],
      },
    ],
    ai: {
      title: 'AI on every floor, never off the leash.',
      sub: 'Same rule everywhere: it works from approved knowledge, cites its source, and flags what’s missing instead of inventing.',
      items: [
        ['Generate', 'Modules, quizzes and sheets drawn from your PDFs, in minutes.'],
        ['Answer', 'The assistant answers the agent, cited to the version.'],
        ['Listen', 'Audio version of sections (text-to-speech) for the floor.'],
        ['Alert', 'Unanswered questions and failures become signals.'],
      ],
    },
    enterprise: {
      title: 'Built for the enterprise.',
      sub: 'What a security, HR or IT buyer checks before signing.',
      items: [
        [Lock, 'Per-company isolation', 'Each tenant’s data stays apart, isolation is enforced on every release by CI.'],
        [ShieldCheck, 'Security & data', 'Encrypted secrets, no customer data in the code, export anytime.'],
        [Plug, 'HRIS in, certificates out', 'Odoo, API key or CSV: employees and org chart imported, certificates written back to the HR file.'],
        [Globe, 'Public API', 'Your website shows exactly the approved products and prices your teams acknowledged.'],
        [Layers, 'Your space, your brand', 'company.lernvo.com, your logo, dedicated per-domain TLS.'],
        [Database, 'Per active employee', 'One price per active employee. No platform fee, no surprise.'],
      ],
    },
    integrations: { title: 'Fits what you already run.', list: ['Odoo (HRIS)', 'CSV import', 'API key', 'Google Gemini (AI)', 'Morpheus core', 'Public API'] },
    cta: { h2: 'See Lernvo on your own procedures.', sub: '30 minutes, your real case. Or a free 60-day pilot on one department.', btn1: 'Book a demo', btn2: 'Start a pilot' },
    footer: { tag: 'Lernvo, knowledge assurance platform. Groupe Altis Holding / Minecore.', home: 'Home', login: 'Log in', space: 'Create a space' },
  },
}
type Copy = typeof T['fr']

/* ───────────────────────────── Page ───────────────────────────── */
export default function PlatformPage() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr')
  const t = T[lang] as Copy
  useEffect(() => {
    document.title = lang === 'fr' ? 'Lernvo, La plateforme' : 'Lernvo, The platform'
    document.documentElement.lang = lang
  }, [lang])

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <MarketingNav lang={lang} setLang={setLang} />
      <Hero t={t} />
      <Proof t={t} />
      <Arch t={t} />
      {t.pillars.map((p, i) => <Pillar key={p.id} p={p} flip={i % 2 === 1} />)}
      <Ai t={t} />
      <Enterprise t={t} />
      <Integrations t={t} />
      <Cta t={t} />
      <Footer t={t} />
    </div>
  )
}


function Hero({ t }: { t: Copy }) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,#D6E5F5_0%,transparent_60%)]" />
      <div className="max-w-6xl mx-auto px-5 pt-16 pb-12 md:pt-24 md:pb-20 text-center">
        <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1">{t.hero.kicker}</div>
        <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-[1.03] tracking-tight text-gray-900 max-w-4xl mx-auto">
          {t.hero.h1a}<br /><span className="text-primary-700">{t.hero.h1b}</span>
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{t.hero.sub}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/#demo" className="btn-primary px-6 py-3 text-base flex items-center justify-center gap-2">{t.hero.cta1} <ArrowRight size={16} /></a>
          <a href="/#pricing" className="btn-outline px-6 py-3 text-base text-center">{t.hero.cta2}</a>
        </div>
      </div>
    </section>
  )
}

function Proof({ t }: { t: Copy }) {
  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm">
        {t.proof.items.map(p => <div key={p} className="flex items-center gap-2 text-gray-700 font-semibold"><CheckCircle2 size={15} className="text-success-500" /> {p}</div>)}
        <span className="text-xs text-gray-400 basis-full text-center">{t.proof.note}</span>
      </div>
    </section>
  )
}

function Arch({ t }: { t: Copy }) {
  return (
    <section className="max-w-6xl mx-auto px-5 pt-16 md:pt-24 text-center">
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 max-w-3xl mx-auto">{t.arch.title}</h2>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {t.arch.links.map(([label, href]) => (
          <a key={href} href={href} className="text-sm font-semibold text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-4 py-2 hover:bg-primary-100">{label}</a>
        ))}
      </div>
    </section>
  )
}

type PillarData = Copy['pillars'][number]
function Pillar({ p, flip }: { p: PillarData; flip: boolean }) {
  const Icon = p.icon as typeof BookOpenCheck
  return (
    <section id={p.id} className="max-w-6xl mx-auto px-5 py-14 md:py-20 scroll-mt-20">
      <div className={`grid lg:grid-cols-12 gap-10 items-start ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-700 text-white flex items-center justify-center"><Icon size={22} /></div>
            <span className="text-sm font-bold uppercase tracking-widest text-gray-400">{p.n} · {p.kicker}</span>
          </div>
          <h3 className="mt-5 text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">{p.title}</h3>
          <p className="mt-4 text-gray-600 leading-relaxed">{p.purpose}</p>
        </div>
        <div className="lg:col-span-7 grid gap-4">
          {p.points.map(([PIcon, h, d]) => {
            const I = PIcon as typeof BookOpenCheck
            return (
              <div key={h as string} className="card p-5 flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><I size={18} /></div>
                <div><h4 className="font-bold text-gray-900">{h as string}</h4><p className="mt-1 text-sm text-gray-600 leading-relaxed">{d as string}</p></div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Ai({ t }: { t: Copy }) {
  return (
    <section className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-500 text-white flex items-center justify-center"><Sparkles size={20} /></div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white max-w-3xl">{t.ai.title}</h2>
        </div>
        <p className="mt-4 text-gray-300 max-w-2xl text-lg leading-relaxed">{t.ai.sub}</p>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {t.ai.items.map(([h, d]) => (
            <div key={h} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <h3 className="text-lg font-bold text-white">{h}</h3>
              <p className="mt-2 text-gray-300 text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Enterprise({ t }: { t: Copy }) {
  return (
    <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 max-w-3xl">{t.enterprise.title}</h2>
      <p className="mt-3 text-gray-600 max-w-2xl">{t.enterprise.sub}</p>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {t.enterprise.items.map(([Icon, h, d]) => {
          const I = Icon as typeof BookOpenCheck
          return (
            <div key={h as string} className="card p-6">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center"><I size={20} /></div>
              <h3 className="mt-4 font-bold text-gray-900">{h as string}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d as string}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Integrations({ t }: { t: Copy }) {
  return (
    <section id="integrations" className="bg-gray-50 border-y border-gray-100 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-5 py-14 text-center">
        <h2 className="text-xl font-bold text-gray-900">{t.integrations.title}</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {t.integrations.list.map(x => (
            <span key={x} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-full px-4 py-2"><Plug size={14} className="text-primary-700" /> {x}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function Cta({ t }: { t: Copy }) {
  return (
    <section className="bg-primary-700 text-white">
      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white max-w-2xl mx-auto">{t.cta.h2}</h2>
        <p className="mt-4 text-primary-100 text-lg max-w-xl mx-auto">{t.cta.sub}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <a href="/#demo" className="btn-primary bg-white text-primary-700 hover:bg-gray-100 px-6 py-3 text-base flex items-center justify-center gap-2">{t.cta.btn1} <ArrowRight size={16} /></a>
          <a href="/#demo" className="border border-white/40 text-white rounded-xl px-6 py-3 text-base text-center hover:bg-white/10">{t.cta.btn2}</a>
        </div>
      </div>
    </section>
  )
}

function Footer({ t }: { t: Copy }) {
  return (
    <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-2"><BrandMark size={18} tone="navy" compact /> {t.footer.tag}</div>
      <div className="flex gap-5">
        <Link to="/" className="hover:text-gray-800">{t.footer.home}</Link>
        <Link to="/login" className="hover:text-gray-800">{t.footer.login}</Link>
        <Link to="/signup" className="hover:text-gray-800">{t.footer.space}</Link>
      </div>
    </footer>
  )
}
