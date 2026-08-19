import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck, BookOpenCheck, MessageSquareText, Activity, Plug, Globe, Award, CheckCircle2, ArrowRight, Loader2, ChevronDown } from 'lucide-react'
import { api } from '../utils/api'
import BrandMark from '../components/BrandMark'

type Lang = 'fr' | 'en'

/* ───────────────────────────── Copy (FR first, EN variant) ───────────────────────────── */
const T = {
  fr: {
    nav: { how: 'Comment ça marche', features: 'Fonctions', pricing: 'Tarifs', faq: 'Questions', login: 'Se connecter', demo: 'Réserver une démo' },
    hero: {
      kicker: 'Assurance de connaissance pour les équipes terrain',
      h1a: 'Tes procédures ne servent à rien',
      h1b: 'si tes employés ne les connaissent pas.',
      sub: 'Lernvo est la seule façon de t’assurer que chaque employé applique la version du jour de vos procédures, produits et tarifs — et de le prouver.',
      cta1: 'Réserver une démo (30 min)', cta2: 'Démarrer un pilote gratuit',
      proof: ['100+ employés en production', '394 procédures & produits', '3 344 questions de quiz', '39 départements'],
      proofNote: 'Premier déploiement : un groupe télécom multi-filiales.',
    },
    problem: {
      h2: 'Aujourd’hui, vos procédures vivent à quatre endroits. Aucun ne vous protège.',
      items: [
        ['Le PDF sur le serveur', 'Personne ne sait quelle version est la bonne.'],
        ['Le message WhatsApp', 'Envoyé ≠ lu. Lu ≠ compris. Zéro preuve.'],
        ['SharePoint / Drive', 'Stocké, jamais vérifié. Introuvable au moment du client.'],
        ['La tête de Jean', 'Jean part en congé. Le client paie l’écart.'],
      ],
      cost: 'Ce que ça coûte : devis erronés, tickets répétés, audits sans preuve, onboardings de trois semaines, managers qui réexpliquent la même règle.',
    },
    how: {
      h2: 'Trois marches. Si une manque, vous n’êtes pas sûr — vous espérez.',
      steps: [
        ['1', 'Source de vérité approuvée', 'Procédures, fiches produits, tarifs : brouillon → relecture → approuvé vN. Versionné. Les employés ne voient jamais un brouillon.'],
        ['2', 'Lu et compris', 'À chaque approbation, les bonnes personnes reçoivent « à lire et valider ». Quiz de section, certificat, trace par personne et par version.'],
        ['3', 'Prouvé, par département', 'Couverture en temps réel : « 87 % du Support a validé la v3 ». Signaux : échecs quiz, questions sans réponse, documents périmés.'],
      ],
    },
    features: {
      h2: 'Tout ce qu’il faut pour que le terrain sache — et rien de plus.',
      items: [
        [MessageSquareText, 'Assistant IA branché sur vos procédures', 'Il répond à l’agent en secondes, uniquement depuis la connaissance approuvée. Quand il ne trouve pas, c’est un signal : il manque un document.'],
        [Activity, 'Signaux & recommandations', 'Par département : couverture, échecs quiz, retards, questions sans réponse, docs périmés. Optionnellement raisonné par le cœur Morpheus.'],
        [Plug, 'SIRH dedans, certificats dehors', 'Odoo, clé API ou CSV : employés et organigramme importés ; certificats renvoyés dans la fiche RH. Onboarding automatique le jour de l’embauche.'],
        [Globe, 'Ce que le client lit = ce que l’employé a appris', 'API publique : votre site affiche exactement les produits et tarifs approuvés que vos équipes ont validés.'],
        [Award, 'Parcours, certificats, gamification', 'Parcours carrière, badges, classements : les gens progressent, et la RH a la preuve.'],
        [ShieldCheck, 'Votre espace, isolé', 'entreprise.lernvo.com, votre logo, vos données séparées — isolation vérifiée par la CI, source ouverte.'],
      ],
    },
    pricing: {
      h2: 'Un prix par employé actif. Pas de frais de plateforme.',
      pilot: 'Pilote 60 jours gratuit sur un département, avec un KPI convenu. Conversion : −20 % la première année.',
      plans: [
        ['Starter', '8 $', '/employé/mois', '20 à 100 employés', ['Tout le produit', 'Un espace brandé', 'Support email']],
        ['Business', '6 $', '/employé/mois', '100 à 1 000 employés · −20 % en annuel', ['Intégration SIRH (Odoo, API, CSV)', 'API publique', 'Signaux & recommandations', 'Support prioritaire']],
        ['Enterprise', 'Sur devis', '', '1 000+ / multi-entités', ['SSO, SLA', 'Cœur Morpheus', 'Accompagnement & migration']],
      ],
      cta: 'Parler à Thierry',
    },
    faq: {
      h2: 'Questions qu’on nous pose',
      items: [
        ['On a déjà un LMS / SharePoint.', 'Gardez-les pour les cours et les fichiers. Lernvo est la couche qui prouve que la version actuelle est connue. On importe vos PDF, on génère modules, quiz et assistant.'],
        ['Nos employés n’utiliseront pas une appli de plus.', 'C’est l’endroit où vit l’information dont ils ont besoin pour faire leur travail, avec un assistant qui répond en secondes. Mobile, 2 minutes pour « lu et compris ».'],
        ['Sécurité et données ?', 'Espace isolé par entreprise, secrets chiffrés, aucune donnée client dans le code (vérifié en CI), export à tout moment.'],
        ['Combien de temps pour démarrer ?', 'Des heures, pas des mois : import CSV ou SIRH, génération IA depuis vos documents, premier « lu et compris » le jour même.'],
      ],
    },
    form: {
      h2: 'Voir Lernvo sur vos procédures',
      sub: '30 minutes, votre cas concret. Ou un pilote gratuit de 60 jours sur un département.',
      name: 'Nom', email: 'Email professionnel', company: 'Entreprise', size: 'Taille', sizes: ['20-100', '100-500', '500-2 000', '2 000+'], message: 'Votre situation (optionnel)',
      intentDemo: 'Démo 30 min', intentPilot: 'Pilote gratuit 60 jours', send: 'Envoyer', ok: 'Merci — je vous réponds sous 24 h. — Thierry', err: 'Envoi impossible, réessayez.',
    },
    footer: { tag: 'Lernvo — plateforme d’assurance de connaissance. Groupe Altis Holding / Minecore.', links: [['Se connecter', '/login'], ['Créer un espace', '/signup'], ['Code source', 'https://github.com/minecoreanalytics-glitch/lernvo']] },
  },
  en: {
    nav: { how: 'How it works', features: 'Features', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', demo: 'Book a demo' },
    hero: {
      kicker: 'Knowledge assurance for frontline teams',
      h1a: 'Your procedures are worthless',
      h1b: 'if your employees don’t know them.',
      sub: 'Lernvo is the only way to make sure every employee applies today’s version of your procedures, products and prices — and to prove it.',
      cta1: 'Book a 30-min demo', cta2: 'Start a free pilot',
      proof: ['100+ employees in production', '394 procedures & products', '3,344 quiz questions', '39 departments'],
      proofNote: 'First deployment: a multi-brand telecom group.',
    },
    problem: {
      h2: 'Today your procedures live in four places. None of them protects you.',
      items: [
        ['The PDF on the server', 'Nobody knows which version is current.'],
        ['The WhatsApp message', 'Sent ≠ read. Read ≠ understood. Zero proof.'],
        ['SharePoint / Drive', 'Stored, never verified. Unfindable in front of the customer.'],
        ['John’s head', 'John goes on leave. The customer pays the gap.'],
      ],
      cost: 'What it costs: wrong quotes, repeated tickets, audits with no evidence, three-week onboardings, managers re-explaining the same rule.',
    },
    how: {
      h2: 'Three steps. Miss one and you are not sure — you are hoping.',
      steps: [
        ['1', 'Approved source of truth', 'Procedures, product sheets, price lists: draft → review → approved vN. Versioned. Employees never see a draft.'],
        ['2', 'Read & understood', 'On every approval the right people get "read & acknowledge". Section quizzes, certificates, a trace per person and per version.'],
        ['3', 'Proven, per department', 'Live coverage: "87% of Support acknowledged v3". Signals: quiz failures, unanswered questions, stale documents.'],
      ],
    },
    features: {
      h2: 'Everything the floor needs to know — and nothing else.',
      items: [
        [MessageSquareText, 'AI assistant grounded in your procedures', 'Answers the agent in seconds, only from approved knowledge. When it can’t find it, that’s a signal: a document is missing.'],
        [Activity, 'Signals & recommendations', 'Per department: coverage, quiz failures, overdue, unanswered questions, stale docs. Optionally reasoned by the Morpheus core.'],
        [Plug, 'HRIS in, certificates out', 'Odoo, API key or CSV: employees and org chart imported; certificates written back to the HR file. Onboarding starts on day one, automatically.'],
        [Globe, 'What the customer reads = what the employee learned', 'Public API: your website shows exactly the approved products and prices your teams acknowledged.'],
        [Award, 'Paths, certificates, gamification', 'Career paths, badges, leaderboards: people progress, HR has the proof.'],
        [ShieldCheck, 'Your own isolated space', 'company.lernvo.com, your logo, your data apart — isolation enforced in CI, source-available.'],
      ],
    },
    pricing: {
      h2: 'One price per active employee. No platform fee.',
      pilot: 'Free 60-day pilot on one department with an agreed KPI. Convert at −20% for the first year.',
      plans: [
        ['Starter', '$8', '/employee/mo', '20 to 100 employees', ['The whole product', 'One branded space', 'Email support']],
        ['Business', '$6', '/employee/mo', '100 to 1,000 · −20% annual', ['HRIS integration (Odoo, API, CSV)', 'Public API', 'Signals & recommendations', 'Priority support']],
        ['Enterprise', 'Custom', '', '1,000+ / multi-entity', ['SSO, SLA', 'Morpheus core', 'Onboarding & migration']],
      ],
      cta: 'Talk to Thierry',
    },
    faq: {
      h2: 'Questions we get',
      items: [
        ['We already have an LMS / SharePoint.', 'Keep them for courses and files. Lernvo is the layer that proves the current version is known. We import your PDFs and generate modules, quizzes and the assistant.'],
        ['Our people won’t use another app.', 'It’s where the information they need to do their job lives, with an assistant that answers in seconds. Mobile, 2 minutes to acknowledge.'],
        ['Security and data?', 'Isolated space per company, encrypted secrets, no customer data in code (CI-enforced), export anytime.'],
        ['How long to start?', 'Hours, not months: CSV or HRIS import, AI generation from your documents, first acknowledgment the same day.'],
      ],
    },
    form: {
      h2: 'See Lernvo on your own procedures',
      sub: '30 minutes, your real case. Or a free 60-day pilot on one department.',
      name: 'Name', email: 'Work email', company: 'Company', size: 'Size', sizes: ['20-100', '100-500', '500-2,000', '2,000+'], message: 'Your situation (optional)',
      intentDemo: '30-min demo', intentPilot: 'Free 60-day pilot', send: 'Send', ok: 'Thanks — I’ll reply within 24h. — Thierry', err: 'Could not send, please retry.',
    },
    footer: { tag: 'Lernvo — knowledge assurance platform. Groupe Altis Holding / Minecore.', links: [['Log in', '/login'], ['Create a space', '/signup'], ['Source code', 'https://github.com/minecoreanalytics-glitch/lernvo']] },
  },
}
type Copy = typeof T['fr']

/* ───────────────────────────── Page ───────────────────────────── */
export default function LandingPage() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr')
  const t = T[lang] as Copy
  useEffect(() => {
    document.title = lang === 'fr' ? 'Lernvo — Vos employés connaissent vos procédures. Prouvé.' : 'Lernvo — Your employees know your procedures. Proven.'
    document.documentElement.lang = lang
  }, [lang])

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <Nav t={t} lang={lang} setLang={setLang} />
      <Hero t={t} />
      <Proof t={t} />
      <Problem t={t} />
      <How t={t} />
      <Features t={t} />
      <Pricing t={t} />
      <Faq t={t} />
      <LeadForm t={t} lang={lang} />
      <Footer t={t} />
    </div>
  )
}

function Nav({ t, lang, setLang }: { t: Copy; lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
        <a href="#top" className="flex items-center gap-2.5 shrink-0">
          <BrandMark size={36} className="rounded-xl" />
          <span className="text-lg font-extrabold tracking-[-0.04em] text-gray-900 lowercase">Lernvo</span>
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 ml-4">
          <a href="#how" className="hover:text-gray-900">{t.nav.how}</a>
          <a href="#features" className="hover:text-gray-900">{t.nav.features}</a>
          <a href="#pricing" className="hover:text-gray-900">{t.nav.pricing}</a>
          <a href="#faq" className="hover:text-gray-900">{t.nav.faq}</a>
        </nav>
        <div className="flex-1" />
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-2">{lang === 'fr' ? 'EN' : 'FR'}</button>
        <Link to="/login" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900">{t.nav.login}</Link>
        <a href="#demo" className="btn-primary text-sm px-4 py-2">{t.nav.demo}</a>
      </div>
    </header>
  )
}

function Hero({ t }: { t: Copy }) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,#D6E5F5_0%,transparent_60%)]" />
      <div className="max-w-6xl mx-auto px-5 pt-16 pb-12 md:pt-24 md:pb-20 grid md:grid-cols-12 gap-10 items-center">
        <div className="md:col-span-7">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1">{t.hero.kicker}</div>
          <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-[1.02] tracking-tight text-gray-900">
            {t.hero.h1a}<br /><span className="text-primary-700">{t.hero.h1b}</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed">{t.hero.sub}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <a href="#demo" className="btn-primary px-6 py-3 text-base flex items-center justify-center gap-2">{t.hero.cta1} <ArrowRight size={16} /></a>
            <a href="#demo" data-intent="pilot" className="btn-outline px-6 py-3 text-base text-center">{t.hero.cta2}</a>
          </div>
        </div>
        <div className="md:col-span-5">
          <MockCoverage />
        </div>
      </div>
    </section>
  )
}

/** Product-like illustration: an approval → acknowledgment coverage card (pure CSS, no image). */
function MockCoverage() {
  const rows = [['Support technique', 87], ['Vente résidentielle', 72], ['Facturation', 94], ['Marketing', 58]]
  return (
    <div className="card p-5 shadow-card-md rotate-[-1deg] md:translate-x-4">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip chip-success text-[10px]">Approuvé v3</span>
        <span className="text-sm font-semibold text-gray-800">Procédure — Activation fibre</span>
      </div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-2">Lu et compris · par département</div>
      <div className="space-y-2.5">
        {rows.map(([n, p]) => (
          <div key={n as string}>
            <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{n}</span><span className="font-semibold text-gray-800">{p}%</span></div>
            <div className="progress-track h-2"><div className={`h-2 rounded-full ${(p as number) >= 80 ? 'bg-success-500' : (p as number) >= 60 ? 'bg-warning-500' : 'bg-danger-500'}`} style={{ width: `${p}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-xl p-3">
        <MessageSquareText size={14} className="text-primary-700 mt-0.5 shrink-0" />
        <p className="text-xs text-primary-900"><span className="font-semibold">Assistant :</span> « Pour l'activation fibre, étape 3 : vérifier la puissance optique (supérieure à −27 dBm) avant de valider. » <span className="text-primary-600">— source : Procédure v3</span></p>
      </div>
    </div>
  )
}

function Proof({ t }: { t: Copy }) {
  return (
    <section className="border-y border-gray-100 bg-gray-50">
      <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm">
        {t.hero.proof.map(p => <div key={p} className="flex items-center gap-2 text-gray-700 font-semibold"><CheckCircle2 size={15} className="text-success-500" /> {p}</div>)}
        <span className="text-xs text-gray-400 basis-full text-center">{t.hero.proofNote}</span>
      </div>
    </section>
  )
}

function Problem({ t }: { t: Copy }) {
  return (
    <section className="max-w-6xl mx-auto px-5 py-16 md:py-24">
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 max-w-3xl">{t.problem.h2}</h2>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {t.problem.items.map(([h, d]) => (
          <div key={h} className="card p-5 border-l-4 border-l-danger-500">
            <div className="font-bold text-gray-900">{h}</div>
            <p className="text-sm text-gray-600 mt-1">{d}</p>
          </div>
        ))}
      </div>
      <p className="mt-8 text-gray-600 max-w-3xl">{t.problem.cost}</p>
    </section>
  )
}

function How({ t }: { t: Copy }) {
  return (
    <section id="how" className="bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-3xl">{t.how.h2}</h2>
        <div className="mt-12 grid md:grid-cols-3 gap-6">
          {t.how.steps.map(([n, h, d]) => (
            <div key={n} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <div className="w-10 h-10 rounded-xl bg-primary-500 text-white font-extrabold flex items-center justify-center text-lg">{n}</div>
              <h3 className="mt-4 text-xl font-bold">{h}</h3>
              <p className="mt-2 text-gray-300 text-sm leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features({ t }: { t: Copy }) {
  return (
    <section id="features" className="max-w-6xl mx-auto px-5 py-16 md:py-24">
      <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900 max-w-3xl">{t.features.h2}</h2>
      <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {t.features.items.map(([Icon, h, d]) => {
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

function Pricing({ t }: { t: Copy }) {
  return (
    <section id="pricing" className="bg-gray-50 border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24">
        <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">{t.pricing.h2}</h2>
        <p className="mt-3 text-gray-600 max-w-2xl">{t.pricing.pilot}</p>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {t.pricing.plans.map(([name, price, unit, who, feats], i) => (
            <div key={name as string} className={`card p-6 flex flex-col ${i === 1 ? 'ring-2 ring-primary-600 relative' : ''}`}>
              {i === 1 && <span className="absolute -top-3 left-5 chip bg-primary-700 text-white text-[10px]">Recommandé</span>}
              <div className="text-sm font-bold text-gray-500 uppercase tracking-wide">{name as string}</div>
              <div className="mt-2 flex items-baseline gap-1"><span className="text-4xl font-extrabold text-gray-900">{price as string}</span><span className="text-sm text-gray-500">{unit as string}</span></div>
              <div className="text-xs text-gray-500 mt-1">{who as string}</div>
              <ul className="mt-5 space-y-2 text-sm text-gray-700 flex-1">
                {(feats as string[]).map(f => <li key={f} className="flex gap-2"><CheckCircle2 size={15} className="text-success-500 mt-0.5 shrink-0" /> {f}</li>)}
              </ul>
              <a href="#demo" className={`mt-6 text-sm text-center py-2.5 ${i === 1 ? 'btn-primary' : 'btn-outline'}`}>{t.pricing.cta}</a>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq({ t }: { t: Copy }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="max-w-3xl mx-auto px-5 py-16 md:py-24">
      <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">{t.faq.h2}</h2>
      <div className="mt-8 divide-y divide-gray-100 border-y border-gray-100">
        {t.faq.items.map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between gap-4 py-4 text-left">
              <span className="font-semibold text-gray-900">{q}</span><ChevronDown size={16} className={`text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`} />
            </button>
            {open === i && <p className="pb-4 text-sm text-gray-600 leading-relaxed">{a}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

function LeadForm({ t, lang }: { t: Copy; lang: Lang }) {
  const [intent, setIntent] = useState<'demo' | 'pilot'>('demo')
  const [f, setF] = useState({ name: '', email: '', company: '', size: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'err'>('idle')
  const source = useMemo(() => `${document.referrer || 'direct'} ${location.search}`.trim().slice(0, 300), [])
  useEffect(() => {
    const h = () => { const el = document.activeElement as HTMLElement | null; if (el?.dataset.intent === 'pilot') setIntent('pilot') }
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [])
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setState('busy')
    try { await api.post('/public/leads', { ...f, intent, source, locale: lang }); setState('ok') } catch { setState('err') }
  }
  const inp = 'input'
  return (
    <section id="demo" className="bg-primary-700 text-white">
      <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-start">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{t.form.h2}</h2>
          <p className="mt-4 text-primary-100 text-lg">{t.form.sub}</p>
          <ul className="mt-8 space-y-3 text-primary-50 text-sm">
            <li className="flex gap-2"><BookOpenCheck size={16} className="mt-0.5 shrink-0" /> {lang === 'fr' ? 'On part de vos vrais documents — pas d’une démo générique.' : 'We start from your real documents — not a generic demo.'}</li>
            <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0" /> {lang === 'fr' ? 'Espace isolé créé pendant l’appel si vous le souhaitez.' : 'Isolated space created during the call if you want.'}</li>
            <li className="flex gap-2"><Activity size={16} className="mt-0.5 shrink-0" /> {lang === 'fr' ? 'Un KPI convenu avant tout pilote : couverture, quiz, tickets.' : 'An agreed KPI before any pilot: coverage, quiz, tickets.'}</li>
          </ul>
        </div>
        <form onSubmit={submit} className="card p-6 text-gray-800 space-y-3">
          <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
            <button type="button" onClick={() => setIntent('demo')} className={`flex-1 py-2 ${intent === 'demo' ? 'bg-primary-700 text-white' : 'bg-white text-gray-600'}`}>{t.form.intentDemo}</button>
            <button type="button" onClick={() => setIntent('pilot')} className={`flex-1 py-2 ${intent === 'pilot' ? 'bg-primary-700 text-white' : 'bg-white text-gray-600'}`}>{t.form.intentPilot}</button>
          </div>
          <input className={inp} placeholder={t.form.name} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required />
          <input className={inp} type="email" placeholder={t.form.email} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inp} placeholder={t.form.company} value={f.company} onChange={e => setF({ ...f, company: e.target.value })} />
            <select className={inp} value={f.size} onChange={e => setF({ ...f, size: e.target.value })}><option value="">{t.form.size}</option>{t.form.sizes.map(s => <option key={s} value={s}>{s}</option>)}</select>
          </div>
          <textarea className={`${inp} min-h-[90px]`} placeholder={t.form.message} value={f.message} onChange={e => setF({ ...f, message: e.target.value })} />
          <input className="hidden" tabIndex={-1} autoComplete="off" value={f.website} onChange={e => setF({ ...f, website: e.target.value })} aria-hidden="true" />
          {state === 'ok' ? <p className="text-sm text-success-600 font-medium">{t.form.ok}</p> : (
            <button type="submit" disabled={state === 'busy'} className="btn-primary w-full py-3 flex items-center justify-center gap-2">{state === 'busy' ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />} {t.form.send}</button>
          )}
          {state === 'err' && <p className="text-xs text-red-600">{t.form.err}</p>}
        </form>
      </div>
    </section>
  )
}

function Footer({ t }: { t: Copy }) {
  return (
    <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
      <div className="flex items-center gap-2"><BrandMark size={18} tone="navy" compact /> {t.footer.tag}</div>
      <div className="flex gap-5">
        {t.footer.links.map(([l, href]) => href.startsWith('http')
          ? <a key={l} href={href} target="_blank" rel="noreferrer" className="hover:text-gray-800">{l}</a>
          : <Link key={l} to={href} className="hover:text-gray-800">{l}</Link>)}
      </div>
    </footer>
  )
}
