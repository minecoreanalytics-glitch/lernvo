import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, BookOpenCheck, MessageSquareText, FileCheck2, AlertTriangle } from 'lucide-react'
import MarketingNav from '../components/MarketingNav'
import BrandMark from '../components/BrandMark'
import { getSolution, SOLUTIONS, EXTRA, PROOF, type Lang } from '../marketing/data'

/** Compact product glimpse: approved → acknowledged → cited. Reused across every page. */
function Glimpse({ lang }: { lang: Lang }) {
  const fr = lang === 'fr'
  return (
    <div className="card p-5 shadow-card-md rotate-[-1deg]">
      <div className="flex items-center gap-2 mb-4">
        <span className="chip chip-success text-[10px]">{fr ? 'Approuvé v3' : 'Approved v3'}</span>
        <span className="text-sm font-semibold text-gray-800">{fr ? 'Procédure' : 'Procedure'}</span>
      </div>
      <div className="space-y-3">
        <div className="flex items-center gap-3 text-sm text-gray-700"><FileCheck2 size={16} className="text-primary-700 shrink-0" /> {fr ? 'Version approuvée, publiée' : 'Approved version, published'}</div>
        <div>
          <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{fr ? 'Lu et compris' : 'Read & understood'}</span><span className="font-semibold text-gray-800">87%</span></div>
          <div className="progress-track h-2"><div className="h-2 rounded-full bg-success-500" style={{ width: '87%' }} /></div>
        </div>
        <div className="flex items-start gap-2 bg-primary-50 border border-primary-100 rounded-xl p-3">
          <MessageSquareText size={14} className="text-primary-700 mt-0.5 shrink-0" />
          <p className="text-xs text-primary-900">{fr ? 'Réponse de l’assistant' : 'Assistant answer'} <span className="text-primary-600">source : {fr ? 'Procédure' : 'Procedure'} v3</span></p>
        </div>
      </div>
    </div>
  )
}

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
  const proof = PROOF[lang]
  const Icon = sol.icon
  const related = SOLUTIONS.filter(s => s.kind === sol.kind && s.slug !== sol.slug)
  const fr = lang === 'fr'

  return (
    <div className="min-h-dvh bg-white text-gray-800 antialiased">
      <MarketingNav lang={lang} setLang={setLang} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_0%,#D6E5F5_0%,transparent_60%)]" />
        <div className="max-w-6xl mx-auto px-5 pt-16 pb-12 md:pt-24 md:pb-16 grid md:grid-cols-12 gap-10 items-center">
          <div className="md:col-span-7">
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1">
              <Icon size={13} /> {c.kicker}
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-extrabold leading-[1.05] tracking-tight text-gray-900">{c.title}</h1>
            <p className="mt-5 text-lg md:text-xl text-gray-600 max-w-xl leading-relaxed">{c.promise}</p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <a href="/#demo" className="btn-primary px-6 py-3 text-base flex items-center justify-center gap-2">{fr ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
              <Link to="/platform" className="btn-outline px-6 py-3 text-base text-center">{fr ? 'Voir la plateforme' : 'See the platform'}</Link>
            </div>
          </div>
          <div className="md:col-span-5">
            <Glimpse lang={lang} />
          </div>
        </div>
      </section>

      {/* The cost today */}
      <section className="border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-5 py-14 md:py-16">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 max-w-2xl">{fr ? 'Le coût, aujourd’hui' : 'What it costs today'}</h2>
          <p className="mt-3 text-gray-600 max-w-2xl">{c.problem}</p>
          <div className="mt-8 grid sm:grid-cols-3 gap-4">
            {extra.cost.map(x => (
              <div key={x} className="card p-5 border-l-4 border-l-danger-500 flex gap-3">
                <AlertTriangle size={17} className="text-danger-500 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700 leading-relaxed">{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Lernvo delivers */}
      <section className="max-w-6xl mx-auto px-5 py-16 md:py-20">
        <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900 max-w-2xl">{fr ? 'Comment Lernvo le fait' : 'How Lernvo does it'}</h2>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {c.points.map(([PIcon, h, d]) => (
            <div key={h} className="card p-6">
              <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center"><PIcon size={20} /></div>
              <h3 className="mt-4 font-bold text-gray-900">{h}</h3>
              <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-xl md:text-2xl font-bold tracking-tight text-primary-700 max-w-2xl mx-auto">{c.close}</p>
      </section>

      {/* What you get (dark band) */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-5xl mx-auto px-5 py-16 md:py-20">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{fr ? 'Ce que vous obtenez' : 'What you get'}</h2>
          <div className="mt-8 grid sm:grid-cols-2 gap-x-10 gap-y-4">
            {extra.youGet.map(x => (
              <div key={x} className="flex items-start gap-3">
                <CheckCircle2 size={18} className="text-success-500 mt-0.5 shrink-0" />
                <span className="text-gray-200">{x}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Proof strip */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-6xl mx-auto px-5 py-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm">
          {proof.items.map(p => <div key={p} className="flex items-center gap-2 text-gray-700 font-semibold"><CheckCircle2 size={15} className="text-success-500" /> {p}</div>)}
          <span className="text-xs text-gray-400 basis-full text-center">{proof.note}</span>
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
            return (
              <Link key={r.slug} to={`${r.base}/${r.slug}`} className="card p-5 flex items-center gap-3 hover:shadow-card-md transition-shadow">
                <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><RIcon size={17} /></div>
                <span className="text-sm font-semibold text-gray-900">{r[lang].title}</span>
              </Link>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary-700 text-white">
        <div className="max-w-4xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-white">{fr ? 'Voir Lernvo sur vos procédures.' : 'See Lernvo on your own procedures.'}</h2>
          <p className="mt-4 text-primary-100 text-lg max-w-xl mx-auto">{fr ? '30 minutes, votre cas concret. Ou un pilote gratuit de 60 jours sur un département.' : '30 minutes, your real case. Or a free 60-day pilot on one department.'}</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="/#demo" className="btn-primary bg-white text-primary-700 hover:bg-gray-100 px-6 py-3 text-base inline-flex items-center justify-center gap-2">{fr ? 'Réserver une démo' : 'Book a demo'} <ArrowRight size={16} /></a>
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
