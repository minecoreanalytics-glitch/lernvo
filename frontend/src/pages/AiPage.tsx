import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight, Sparkles, MessageSquareText, AudioLines, Bell, ShieldCheck,
  FileCheck2, Cpu, Lock, CheckCircle2, BookOpenCheck,
} from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import SolutionVisual from '../components/SolutionVisual'
import BrandMark from '../components/BrandMark'
import { STATS, ACCENT, type Lang } from '../marketing/data'

const A = ACCENT['ai-assistant'] // blue signature for the AI page

const COPY = {
  fr: {
    kicker: 'L’IA chez Lernvo',
    h1a: 'L’IA, ancrée', h1b: 'dans l’approuvé.',
    sub: 'Ce n’est pas une fonctionnalité ajoutée, c’est une règle. L’IA de Lernvo ne répond que depuis vos documents validés, cite sa source, et signale ce qui manque plutôt que de l’inventer.',
    cta1: 'Réserver une démo', cta2: 'Voir la plateforme',
    nav: [['Le principe', '#principe'], ['À chaque étage', '#etages'], ['Nos principes', '#principes']],
    stmtKicker: 'Le principe',
    stmtH2: 'Une règle, pas une fonctionnalité.',
    stmtP: 'La plupart des assistants inventent quand ils ne savent pas. Le vôtre ne peut pas : il travaille sur votre source de vérité approuvée, et rien d’autre.',
    quote: 'Ce qu’elle ne trouve pas devient un signal, jamais une invention.',
    floorsKicker: 'À chaque étage',
    floorsH2: 'Où l’IA travaille dans Lernvo',
    floorsSub: 'La même règle partout : depuis l’approuvé, citée, et honnête sur ce qu’elle ignore.',
    floors: [
      [Sparkles, 'Générer', 'Importez un PDF, l’IA en tire un module, son quiz et des fiches. Vous relisez, vous approuvez.'],
      [MessageSquareText, 'Répondre', 'L’assistant répond à l’agent en secondes, cité à la version : « source : Procédure v3 ».'],
      [AudioLines, 'Écouter', 'Une version audio des sections, en synthèse vocale, pour le terrain qui n’a pas les mains libres.'],
      [Bell, 'Alerter', 'Les questions sans réponse et les échecs de quiz remontent en signaux, par département.'],
    ],
    prinKicker: 'Nos principes',
    prinH2: 'Une IA en qui vos équipes peuvent avoir confiance.',
    principles: [
      [ShieldCheck, 'Ancrée dans l’approuvé', 'Chaque réponse vient de vos documents validés. Jamais le web, jamais une supposition.'],
      [FileCheck2, 'Citée à la version', 'La source et la version exactes sous chaque réponse. Vous savez toujours d’où ça vient.'],
      [Bell, 'Le vide devient un signal', 'Quand elle ne trouve pas, elle le dit, et pointe le document manquant à écrire.'],
      [Cpu, 'Raisonnée par le cœur Morpheus', 'Les signaux sont priorisés et transformés en recommandations d’action, en option.'],
      [Lock, 'Vos données, isolées', 'L’IA travaille dans l’espace isolé de votre entreprise. Aucune donnée client dans le code.'],
      [BookOpenCheck, 'Transparente par conception', 'Le code est source-available : vous pouvez vérifier exactement ce que fait l’assistant.'],
    ],
    statTag: 'En production aujourd’hui',
    ctaH2: 'Voir l’IA de Lernvo sur vos procédures.',
    ctaSub: '30 minutes, vos vrais documents. On génère un module et on interroge l’assistant en direct.',
    ctaBtn1: 'Réserver une démo', ctaBtn2: 'Voir les tarifs',
  },
  en: {
    kicker: 'AI at Lernvo',
    h1a: 'AI, grounded', h1b: 'in what’s approved.',
    sub: 'It is not a feature we bolted on, it is a rule. Lernvo’s AI answers only from your approved documents, cites its source, and flags what is missing instead of inventing it.',
    cta1: 'Book a demo', cta2: 'See the platform',
    nav: [['The principle', '#principe'], ['Every floor', '#etages'], ['Our principles', '#principes']],
    stmtKicker: 'The principle',
    stmtH2: 'A rule, not a feature.',
    stmtP: 'Most assistants invent when they don’t know. Yours cannot: it works from your approved source of truth, and nothing else.',
    quote: 'What it can’t find becomes a signal, never an invention.',
    floorsKicker: 'Every floor',
    floorsH2: 'Where AI works inside Lernvo',
    floorsSub: 'The same rule everywhere: from approved knowledge, cited, and honest about what it doesn’t know.',
    floors: [
      [Sparkles, 'Generate', 'Import a PDF and the AI turns it into a module, its quiz and sheets. You review, you approve.'],
      [MessageSquareText, 'Answer', 'The assistant answers the agent in seconds, cited to the version: “source: Procedure v3”.'],
      [AudioLines, 'Listen', 'An audio version of sections, via text-to-speech, for the floor with their hands full.'],
      [Bell, 'Alert', 'Unanswered questions and quiz failures surface as signals, per department.'],
    ],
    prinKicker: 'Our principles',
    prinH2: 'An AI your teams can actually trust.',
    principles: [
      [ShieldCheck, 'Grounded in approved knowledge', 'Every answer comes from your approved documents. Never the web, never a guess.'],
      [FileCheck2, 'Cited to the version', 'The exact source and version under every answer. You always know where it came from.'],
      [Bell, 'Gaps become signals', 'When it can’t find it, it says so, and points to the missing document to write.'],
      [Cpu, 'Reasoned by the Morpheus core', 'Signals are prioritized and turned into recommended actions, optionally.'],
      [Lock, 'Your data, isolated', 'The AI works inside your company’s isolated space. No customer data in the code.'],
      [BookOpenCheck, 'Transparent by design', 'The code is source-available: you can verify exactly what the assistant does.'],
    ],
    statTag: 'In production today',
    ctaH2: 'See Lernvo’s AI on your own procedures.',
    ctaSub: '30 minutes, your real documents. We generate a module and query the assistant live.',
    ctaBtn1: 'Book a demo', ctaBtn2: 'See pricing',
  },
}

export default function AiPage() {
  const [lang, setLang] = useState<Lang>(() => (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr')
  const t = COPY[lang]
  const stats = STATS[lang]
  const fr = lang === 'fr'
  useEffect(() => {
    document.title = fr ? 'Lernvo — L’IA, ancrée dans l’approuvé' : 'Lernvo — AI, grounded in what’s approved'
    document.documentElement.lang = lang
  }, [lang, fr])

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <MarketingNav lang={lang} setLang={setLang} />

      {/* Hero — dark, to set the AI page apart from the light solution pages */}
      <section className="relative overflow-hidden bg-gray-900 text-white">
        <div className="absolute inset-0 -z-0" style={{ background: `radial-gradient(50% 60% at 80% 0%, ${A.c}55 0%, transparent 60%)` }} />
        <div className="relative max-w-6xl mx-auto px-5 pt-16 pb-16 md:pt-24 md:pb-20 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: '#AEB8F0' }}>
              <Sparkles size={14} /> {t.kicker}
            </div>
            <h1 className="mt-5 text-4xl md:text-6xl font-extrabold leading-[0.98] tracking-[-0.02em] text-white">
              {t.h1a}<br />{t.h1b}
            </h1>
            <p className="mt-6 text-lg md:text-xl text-gray-300 max-w-xl leading-relaxed">{t.sub}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="/#demo" className="btn px-6 py-3 text-base text-white flex items-center justify-center gap-2" style={{ background: A.c }}>{t.cta1} <ArrowRight size={16} /></a>
              <Link to="/platform" className="btn px-6 py-3 text-base text-white border border-white/25 hover:bg-white/10 text-center">{t.cta2}</Link>
            </div>
          </div>
          <div className="md:col-span-5">
            <SolutionVisual slug="ai-assistant" accent={A} lang={lang} />
          </div>
        </div>
      </section>

      {/* Sub-nav (pipe-separated, like Axonify) */}
      <nav className="sticky top-16 z-30 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-5 h-12 flex items-center justify-center gap-5 text-sm text-gray-600">
          {t.nav.map(([label, href], i) => (
            <span key={href} className="flex items-center gap-5">
              {i > 0 && <span className="text-gray-300">|</span>}
              <a href={href} className="hover:text-gray-900 font-medium">{label}</a>
            </span>
          ))}
        </div>
      </nav>

      {/* The principle + pull-quote */}
      <section id="principe" className="max-w-4xl mx-auto px-5 py-16 md:py-24 text-center scroll-mt-28">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: A.c }}>{t.stmtKicker}</p>
        <h2 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-[-0.02em] leading-[1.02] text-gray-900">{t.stmtH2}</h2>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">{t.stmtP}</p>
        <p className="mt-12 text-2xl md:text-3xl font-extrabold italic tracking-tight" style={{ color: A.c }}>“{t.quote}”</p>
      </section>

      {/* Where AI works — tinted band, big-icon cards */}
      <section id="etages" className="scroll-mt-28" style={{ background: A.soft }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-24 text-center">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: A.c }}>{t.floorsKicker}</p>
          <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight text-gray-900">{t.floorsH2}</h2>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto">{t.floorsSub}</p>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
            {t.floors.map(([Icon, h, d]) => {
              const I = Icon as typeof Sparkles
              return (
                <div key={h as string} className="bg-white rounded-2xl p-6 shadow-card">
                  <I size={26} style={{ color: A.c }} />
                  <h3 className="mt-4 text-lg font-bold text-gray-900">{h as string}</h3>
                  <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d as string}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Principles — colored top-border cards */}
      <section id="principes" className="max-w-6xl mx-auto px-5 py-16 md:py-24 scroll-mt-28">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: A.c }}>{t.prinKicker}</p>
        <h2 className="mt-4 text-2xl md:text-4xl font-extrabold tracking-tight text-gray-900 max-w-2xl">{t.prinH2}</h2>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {t.principles.map(([Icon, h, d]) => {
            const I = Icon as typeof Sparkles
            return (
              <div key={h as string} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100" style={{ borderTop: `4px solid ${A.c}` }}>
                <I size={22} style={{ color: A.c }} />
                <h3 className="mt-4 font-bold text-gray-900 text-lg">{h as string}</h3>
                <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d as string}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Stat band */}
      <section className="text-white" style={{ background: A.c }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <p className="text-center text-sm font-extrabold uppercase tracking-[0.18em] text-white/80">{t.statTag}</p>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(([big, label]) => (
              <div key={label} className="bg-white rounded-2xl p-6 text-center shadow-card-md">
                <div className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: A.c }}>{big}</div>
                <div className="text-sm text-gray-500 mt-1.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-4xl mx-auto px-5 py-16 md:py-24 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-[-0.02em] leading-[0.98] text-white">{t.ctaH2}</h2>
          <p className="mt-5 text-gray-300 text-lg max-w-xl mx-auto">{t.ctaSub}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/#demo" className="btn px-6 py-3 text-base text-white inline-flex items-center justify-center gap-2" style={{ background: A.c }}>{t.ctaBtn1} <ArrowRight size={16} /></a>
            <a href="/#pricing" className="btn px-6 py-3 text-base text-white border border-white/25 hover:bg-white/10 inline-flex items-center justify-center gap-2"><CheckCircle2 size={16} /> {t.ctaBtn2}</a>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2"><BrandMark size={18} tone="navy" compact /> Lernvo. Groupe Altis Holding / Minecore.</div>
        <div className="flex gap-5">
          <Link to="/" className="hover:text-gray-800">{fr ? 'Accueil' : 'Home'}</Link>
          <Link to="/login" className="hover:text-gray-800">{fr ? 'Se connecter' : 'Log in'}</Link>
        </div>
      </footer>
    </div>
  )
}
