import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, BookOpenCheck } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import BrandMark from '../components/BrandMark'
import { getSolution, SOLUTIONS, type Lang } from '../marketing/data'

export default function SolutionPage() {
  const { slug } = useParams()
  const sol = getSolution(slug)
  const [lang, setLang] = useState<Lang>(() => (navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr')

  useEffect(() => {
    if (!sol) return
    document.title = `Lernvo — ${sol[lang].title}`
    document.documentElement.lang = lang
  }, [sol, lang])

  if (!sol) return <Navigate to="/platform" replace />
  const c = sol[lang]
  const Icon = sol.icon
  const related = SOLUTIONS.filter(s => s.kind === sol.kind && s.slug !== sol.slug)

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <MarketingNav lang={lang} setLang={setLang} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_70%_0%,#D6E5F5_0%,transparent_60%)]" />
        <div className="max-w-4xl mx-auto px-5 pt-16 pb-10 md:pt-24 md:pb-14 text-center">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1">
            <Icon size={13} /> {c.kicker}
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-gray-900">{c.title}</h1>
          <p className="mt-5 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">{c.promise}</p>
          <div className="mt-8">
            <a href="/#demo" className="btn-primary px-6 py-3 text-base inline-flex items-center gap-2">{lang === 'fr' ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-3xl mx-auto px-5 py-10 text-center">
          <p className="text-lg text-gray-700 font-medium">{c.problem}</p>
        </div>
      </section>

      {/* How Lernvo delivers */}
      <section className="max-w-5xl mx-auto px-5 py-16 md:py-20">
        <div className="grid md:grid-cols-3 gap-5">
          {c.points.map(([PIcon, h, d]) => (
            <div key={h} className="card p-6">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center"><PIcon size={20} /></div>
              <h3 className="mt-4 font-bold text-gray-900">{h}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xl md:text-2xl font-bold tracking-tight text-gray-900 max-w-2xl mx-auto">{c.close}</p>
      </section>

      {/* Related */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto px-5 py-12">
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            {sol.kind === 'outcome' ? (lang === 'fr' ? 'Autres résultats' : 'Other outcomes') : (lang === 'fr' ? 'Autres capacités' : 'Other capabilities')}
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {related.map(r => {
              const RIcon = r.icon
              return (
                <Link key={r.slug} to={`${r.base}/${r.slug}`} className="card p-5 flex items-center gap-3 hover:shadow-card-md transition-shadow">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><RIcon size={17} /></div>
                  <span className="text-sm font-semibold text-gray-900">{r[lang].title}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{lang === 'fr' ? 'Voir Lernvo sur vos procédures.' : 'See Lernvo on your own procedures.'}</h2>
          <p className="mt-4 text-primary-100 text-lg max-w-xl mx-auto">{lang === 'fr' ? '30 minutes, votre cas concret. Ou un pilote gratuit de 60 jours sur un département.' : '30 minutes, your real case. Or a free 60-day pilot on one department.'}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/#demo" className="btn-primary bg-white text-primary-700 hover:bg-gray-100 px-6 py-3 text-base inline-flex items-center justify-center gap-2">{lang === 'fr' ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
            <a href="/platform" className="border border-white/40 text-white rounded-xl px-6 py-3 text-base text-center hover:bg-white/10 inline-flex items-center justify-center gap-2"><BookOpenCheck size={16} /> {lang === 'fr' ? 'Voir la plateforme' : 'See the platform'}</a>
          </div>
        </div>
      </section>

      <footer className="max-w-6xl mx-auto px-5 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-2"><BrandMark size={18} tone="navy" compact /> Lernvo. Groupe Altis Holding / Minecore.</div>
        <div className="flex gap-5">
          <Link to="/" className="hover:text-gray-800 flex items-center gap-1"><CheckCircle2 size={12} /> {lang === 'fr' ? 'Accueil' : 'Home'}</Link>
          <Link to="/login" className="hover:text-gray-800">{lang === 'fr' ? 'Se connecter' : 'Log in'}</Link>
        </div>
      </footer>
    </div>
  )
}
