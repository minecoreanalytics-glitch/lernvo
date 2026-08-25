import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, BookOpenCheck, AlertTriangle } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import SolutionVisual from '../components/SolutionVisual'
import BrandMark from '../components/BrandMark'
import { getSolution, SOLUTIONS, EXTRA, STATS, ACCENT, type Lang } from '../marketing/data'

export default function SolutionPage() {
  const { slug } = useParams()
  const sol = getSolution(slug)
  const [lang, setLang] = useState<Lang>(() => (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr')

  useEffect(() => {
    if (!sol) return
    document.title = `Lernvo — ${sol[lang].title}`
    document.documentElement.lang = lang
  }, [sol, lang])

  if (!sol || !slug) return <Navigate to="/platform" replace />
  const c = sol[lang]
  const extra = EXTRA[slug][lang]
  const stats = STATS[lang]
  const A = ACCENT[slug]
  const Icon = sol.icon
  const fr = lang === 'fr'
  const idx = SOLUTIONS.findIndex(s => s.slug === slug)
  const flip = idx % 2 === 1
  const related = SOLUTIONS.filter(s => s.kind === sol.kind && s.slug !== sol.slug)

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <MarketingNav lang={lang} setLang={setLang} />

      {/* Hero: oversized title + an italic tagline, visual to the side */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(52% 42% at ${flip ? '20%' : '80%'} -5%, ${A.soft} 0%, transparent 60%)` }} />
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-12 md:pt-20 md:pb-16 grid md:grid-cols-12 gap-10 items-center">
          <div className={`md:col-span-7 ${flip ? 'md:order-2' : ''}`}>
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em]" style={{ color: A.c }}>
              <Icon size={14} /> {c.kicker}
            </div>
            <div className="h-1 w-10 rounded-full mt-3 mb-5" style={{ background: A.c }} />
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[0.98] tracking-[-0.02em] text-gray-900">{c.title}</h1>
            <p className="mt-6 text-xl md:text-2xl italic text-gray-600 max-w-xl leading-snug">{c.promise}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="/#demo" className="btn px-6 py-3 text-base text-white flex items-center justify-center gap-2 shadow-sm" style={{ background: A.c }}>{fr ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
              <Link to="/platform" className="btn-outline px-6 py-3 text-base text-center">{fr ? 'Voir la plateforme' : 'See the platform'}</Link>
            </div>
          </div>
          <div className={`md:col-span-5 ${flip ? 'md:order-1' : ''}`}>
            <SolutionVisual slug={slug} accent={A} lang={lang} />
          </div>
        </div>
      </section>

      {/* The cost today */}
      <section className="border-t border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 py-14 md:py-16">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 max-w-2xl">{fr ? 'Le coût, aujourd’hui' : 'What it costs today'}</h2>
          <p className="mt-3 text-gray-600 max-w-2xl">{c.problem}</p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {extra.cost.map(x => (
              <div key={x} className="bg-white rounded-2xl p-5 border-l-4 border-l-danger-500 shadow-card flex gap-3">
                <AlertTriangle size={17} className="text-danger-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700 leading-relaxed">{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Color-block stat band — the bold signature move, floating white number cards */}
      <section className="text-white" style={{ background: A.c }}>
        <div className="max-w-6xl mx-auto px-5 py-16 md:py-20">
          <p className="text-center text-sm font-extrabold uppercase tracking-[0.18em] text-white/80">{fr ? 'En production aujourd’hui' : 'In production today'}</p>
          <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map(([big, label]) => (
              <div key={label} className="bg-white rounded-2xl p-6 text-center shadow-card-md">
                <div className="text-4xl md:text-5xl font-extrabold tracking-tight" style={{ color: A.c }}>{big}</div>
                <div className="text-sm text-gray-500 mt-1.5">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-white/70">{fr ? 'Premier déploiement : un groupe multi-filiales de 100+ employés.' : 'First deployment: a 100+ employee multi-brand group.'}</p>
        </div>
      </section>

      {/* How Lernvo delivers — colored top-border cards */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 max-w-2xl">{fr ? 'Comment Lernvo le fait' : 'How Lernvo does it'}</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {c.points.map(([PIcon, h, d]) => (
            <div key={h} className="bg-white rounded-2xl p-6 shadow-card border border-gray-100" style={{ borderTop: `4px solid ${A.c}` }}>
              <PIcon size={22} style={{ color: A.c }} />
              <h3 className="mt-4 font-bold text-gray-900 text-lg">{h}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center text-2xl md:text-3xl font-extrabold tracking-tight max-w-2xl mx-auto" style={{ color: A.c }}>{c.close}</p>
      </section>

      {/* What you get — dark band */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-5 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{fr ? 'Ce que vous obtenez' : 'What you get'}</h2>
          <div className="h-1 w-12 rounded-full mt-3" style={{ background: A.c }} />
          <div className="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-4">
            {extra.youGet.map(x => (
              <div key={x} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0" style={{ color: A.c }} />
                <span className="text-gray-200">{x}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related */}
      <section className="max-w-5xl mx-auto px-5 py-14">
        <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
          {sol.kind === 'outcome' ? (fr ? 'Autres résultats' : 'Other outcomes') : (fr ? 'Autres capacités' : 'Other capabilities')}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {related.map(r => {
            const RIcon = r.icon
            const RA = ACCENT[r.slug]
            return (
              <Link key={r.slug} to={`${r.base}/${r.slug}`} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-card flex items-center gap-3 hover:shadow-card-md transition-shadow" style={{ borderLeft: `4px solid ${RA.c}` }}>
                <RIcon size={18} style={{ color: RA.c }} />
                <span className="text-sm font-semibold text-gray-900">{r[lang].title}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="text-white" style={{ background: A.c }}>
        <div className="max-w-4xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-[-0.02em] leading-[0.98] text-white">{fr ? 'Voir Lernvo sur vos procédures.' : 'See Lernvo on your own procedures.'}</h2>
          <p className="mt-5 text-white/85 text-lg max-w-xl mx-auto">{fr ? '30 minutes, votre cas concret. Ou un pilote gratuit de 60 jours sur un département.' : '30 minutes, your real case. Or a free 60-day pilot on one department.'}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/#demo" className="btn bg-white hover:bg-gray-100 px-6 py-3 text-base inline-flex items-center justify-center gap-2" style={{ color: A.c }}>{fr ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
            <a href="/#pricing" className="border border-white/40 text-white rounded-xl px-6 py-3 text-base text-center hover:bg-white/10 inline-flex items-center justify-center gap-2"><BookOpenCheck size={16} /> {fr ? 'Voir les tarifs' : 'See pricing'}</a>
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
