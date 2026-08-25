import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown } from 'lucide-react'
import BrandMark from './BrandMark'
import { OUTCOMES, CAPABILITIES, PRODUCTS, MENU_LABELS, type Lang } from '../marketing/data'

/** Shared marketing header with a three-column "Platform" mega-menu. */
export default function MarketingNav({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const [open, setOpen] = useState(false)
  const L = MENU_LABELS[lang]

  const col = (heading: string, links: { to?: string; href?: string; label: string; desc?: string }[]) => (
    <div className="min-w-[220px]">
      <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-3">{heading}</div>
      <ul className="space-y-2.5">
        {links.map(l => (
          <li key={l.label}>
            {l.to
              ? <Link to={l.to} onClick={() => setOpen(false)} className="block group">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">{l.label}</span>
                  {l.desc && <span className="block text-xs text-gray-500">{l.desc}</span>}
                </Link>
              : <a href={l.href} onClick={() => setOpen(false)} className="block group">
                  <span className="text-sm font-semibold text-gray-900 group-hover:text-primary-700">{l.label}</span>
                  {l.desc && <span className="block text-xs text-gray-500">{l.desc}</span>}
                </a>}
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <BrandMark size={36} className="rounded-xl" />
          <span className="text-lg font-extrabold tracking-[-0.04em] text-gray-900 lowercase">Lernvo</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600 ml-4">
          <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
            <Link to="/platform" className="flex items-center gap-1 hover:text-gray-900 py-5">
              {L.products === 'Products' ? 'Platform' : 'Plateforme'}
              <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </Link>
            {open && (
              <div className="absolute left-0 top-full pt-1">
                <div className="bg-white border border-gray-100 rounded-2xl shadow-card-md p-7 flex gap-12">
                  {col(L.products, PRODUCTS[lang].map(p => ({ href: p.href, label: p.label, desc: p.desc })))}
                  {col(L.outcomes, OUTCOMES.map(s => ({ to: `${s.base}/${s.slug}`, label: s[lang].title, desc: s[lang].promise.slice(0, 46) + (s[lang].promise.length > 46 ? '…' : '') })))}
                  {col(L.capabilities, CAPABILITIES.map(s => ({ to: `${s.base}/${s.slug}`, label: s[lang].title })))}
                </div>
              </div>
            )}
          </div>
          <a href="/#pricing" className="hover:text-gray-900">{lang === 'fr' ? 'Tarifs' : 'Pricing'}</a>
          <a href="/#faq" className="hover:text-gray-900">{lang === 'fr' ? 'Questions' : 'FAQ'}</a>
        </nav>

        <div className="flex-1" />
        <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} className="text-xs font-semibold text-gray-500 hover:text-gray-900 px-2">{lang === 'fr' ? 'EN' : 'FR'}</button>
        <Link to="/login" className="hidden sm:inline text-sm font-medium text-gray-700 hover:text-gray-900">{lang === 'fr' ? 'Se connecter' : 'Log in'}</Link>
        <a href="/#demo" className="btn-primary text-sm px-4 py-2">{lang === 'fr' ? 'Réserver une démo' : 'Book a demo'}</a>
      </div>
    </header>
  )
}
