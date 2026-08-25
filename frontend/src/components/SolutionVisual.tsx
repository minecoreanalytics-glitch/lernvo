import {
  Check, Award, Star, FileText, MessageSquareText, AlertTriangle,
  ArrowRight, ShieldCheck, Trophy, MapPin, GitCommitHorizontal, ListChecks,
} from 'lucide-react'

type Accent = { c: string; soft: string }
type Props = { slug: string; accent: Accent; lang: 'fr' | 'en' }

const NAVY = '#163A6B'

/** A distinct product-glimpse mockup per solution. Not decorative filler: each one
 *  illustrates that specific outcome/capability with the page's signature accent. */
export default function SolutionVisual({ slug, accent, lang }: Props) {
  const fr = lang === 'fr'
  const A = accent.c, S = accent.soft
  const chip = { color: A, background: S }

  const Card = ({ children, tilt = '-1deg' }: { children: React.ReactNode; tilt?: string }) => (
    <div className="card p-5 shadow-card-md" style={{ rotate: tilt }}>{children}</div>
  )
  const Head = ({ title, tag }: { title: string; tag: string }) => (
    <div className="flex items-center justify-between mb-4">
      <span className="text-sm font-bold text-gray-900">{title}</span>
      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={chip}>{tag}</span>
    </div>
  )

  switch (slug) {
    /* ── Onboarding: a Day-1 path, two steps done, one active ── */
    case 'onboarding': {
      const steps = [
        [fr ? 'Lire la procédure d’accueil' : 'Read the welcome procedure', 'done'],
        [fr ? 'Quiz de section' : 'Section quiz', 'done'],
        [fr ? '« Lu et compris »' : 'Read & understood', 'active'],
      ] as const
      return (
        <Card>
          <Head title={fr ? 'Intégration' : 'Onboarding'} tag={fr ? 'Jour 1' : 'Day 1'} />
          <div className="space-y-2.5">
            {steps.map(([label, state]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={state === 'done' ? { background: A } : { border: `2px solid ${A}` }}>
                  {state === 'done' && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
                <span className={`text-sm ${state === 'done' ? 'text-gray-400 line-through' : 'text-gray-800 font-medium'}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs font-semibold" style={{ color: A }}>
            <Award size={15} /> {fr ? 'Certificat délivré' : 'Certificate issued'}
          </div>
        </Card>
      )
    }

    /* ── Customer experience: same answer at three locations ── */
    case 'customer-experience': {
      const sites = [fr ? 'Nord' : 'North', fr ? 'Centre' : 'Central', fr ? 'Sud' : 'South']
      return (
        <Card>
          <Head title={fr ? 'Tarif produit A' : 'Product A price'} tag={fr ? 'Approuvé v3' : 'Approved v3'} />
          <div className="grid grid-cols-3 gap-2">
            {sites.map(s => (
              <div key={s} className="rounded-xl p-3 text-center" style={{ background: S }}>
                <MapPin size={14} className="mx-auto" style={{ color: A }} />
                <div className="text-[11px] text-gray-500 mt-1">{s}</div>
                <div className="text-sm font-bold text-gray-900 mt-0.5">199 $</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs font-semibold" style={{ color: A }}>
            <Check size={15} strokeWidth={3} /> {fr ? 'Même réponse partout' : 'Same answer everywhere'}
          </div>
        </Card>
      )
    }

    /* ── Employee engagement: points, badges, a leaderboard row ── */
    case 'employee-engagement': {
      return (
        <Card>
          <Head title={fr ? 'Ma progression' : 'My progress'} tag={fr ? 'Niveau 4' : 'Level 4'} />
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: S }}>
              <Trophy size={22} style={{ color: A }} />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-gray-900 leading-none">1 240</div>
              <div className="text-[11px] text-gray-500 mt-1">{fr ? 'points · série 12 j' : 'points · 12-day streak'}</div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            {[Star, Award, ShieldCheck].map((Icon, i) => (
              <span key={i} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: S }}><Icon size={15} style={{ color: A }} /></span>
            ))}
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold text-gray-400 bg-gray-100">+5</span>
          </div>
        </Card>
      )
    }

    /* ── Change management: v2 → v3 with an acknowledge bar ── */
    case 'change-management': {
      return (
        <Card>
          <Head title={fr ? 'Procédure' : 'Procedure'} tag={fr ? 'Publié' : 'Published'} />
          <div className="flex items-center gap-2 text-sm">
            <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-400 line-through">v2</span>
            <GitCommitHorizontal size={18} style={{ color: A }} />
            <span className="px-2 py-1 rounded-lg font-bold text-white" style={{ background: A }}>v3</span>
            <span className="text-xs text-gray-500 ml-1">{fr ? 'approuvée' : 'approved'}</span>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-600 mb-1"><span>{fr ? 'Validé par l’équipe' : 'Acknowledged by team'}</span><span className="font-semibold text-gray-800">78%</span></div>
            <div className="h-2 rounded-full bg-gray-200 overflow-hidden"><div className="h-2 rounded-full" style={{ width: '78%', background: A }} /></div>
          </div>
        </Card>
      )
    }

    /* ── Training: PDF → module + quiz ── */
    case 'training': {
      return (
        <Card>
          <Head title={fr ? 'Générateur IA' : 'AI generator'} tag={fr ? 'PDF importé' : 'PDF imported'} />
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-14 rounded-lg bg-gray-100 flex items-center justify-center"><FileText size={22} className="text-gray-400" /></div>
              <span className="text-[10px] text-gray-400">PDF</span>
            </div>
            <ArrowRight size={18} style={{ color: A }} />
            <div className="flex-1 rounded-xl p-3" style={{ background: S }}>
              <div className="text-xs font-bold text-gray-900">{fr ? 'Module généré' : 'Module generated'}</div>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 rounded-full bg-white/70" style={{ width: '90%' }} />
                <div className="h-1.5 rounded-full bg-white/70" style={{ width: '70%' }} />
              </div>
              <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white" style={{ color: A }}>{fr ? '+ Quiz' : '+ Quiz'}</div>
            </div>
          </div>
        </Card>
      )
    }

    /* ── AI assistant: a chat with a citation ── */
    case 'ai-assistant': {
      return (
        <Card>
          <Head title={fr ? 'Assistant' : 'Assistant'} tag={fr ? 'En ligne' : 'Online'} />
          <div className="space-y-2">
            <div className="ml-auto max-w-[80%] text-xs bg-gray-100 text-gray-700 rounded-2xl rounded-br-sm px-3 py-2">
              {fr ? 'Seuil de remboursement ?' : 'Refund threshold?'}
            </div>
            <div className="max-w-[88%] text-xs rounded-2xl rounded-bl-sm px-3 py-2 text-white" style={{ background: NAVY }}>
              {fr ? 'Au-delà de 100 $, accord d’un responsable.' : 'Above $100, a manager’s approval.'}
              <span className="mt-1 flex items-center gap-1 text-[10px]" style={{ color: '#B9C6DE' }}>
                <MessageSquareText size={11} /> source : {fr ? 'Procédure' : 'Procedure'} v3
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-semibold px-2 py-1 rounded-lg" style={chip}>
            <AlertTriangle size={12} /> {fr ? 'Introuvable = signal' : 'Not found = signal'}
          </div>
        </Card>
      )
    }

    /* ── Assignments: a task list with due chips ── */
    case 'assignments': {
      const rows = [
        [fr ? 'Politique de sécurité' : 'Safety policy', fr ? 'En retard' : 'Overdue', '#DB4F66', true],
        [fr ? 'Nouveau tarif Q3' : 'New Q3 pricing', fr ? 'Aujourd’hui' : 'Today', '#E0880C', true],
        [fr ? 'Procédure d’accueil' : 'Welcome procedure', fr ? 'À venir' : 'Upcoming', '#8B98AD', false],
      ] as const
      return (
        <Card>
          <Head title={fr ? 'Mes affectations' : 'My assignments'} tag={fr ? '3 en cours' : '3 active'} />
          <div className="space-y-2">
            {rows.map(([label, due, color, ack]) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md flex items-center justify-center shrink-0" style={ack ? { background: A } : { border: '2px solid #CBD5E1' }}>
                  {ack && <Check size={12} className="text-white" strokeWidth={3} />}
                </span>
                <span className="text-sm text-gray-800 flex-1 truncate">{label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color, background: `${color}1A` }}>{due}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color: A }}>
            <ListChecks size={15} /> {fr ? 'Couverture suivie en direct' : 'Coverage tracked live'}
          </div>
        </Card>
      )
    }

    default:
      return null
  }
}
