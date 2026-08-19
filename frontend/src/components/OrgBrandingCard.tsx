import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, Loader2 } from 'lucide-react'
import { api } from '../utils/api'
import { useBranding } from '../hooks/useBranding'

type MyTenant = { id: string; name: string; slug: string; logoUrl: string | null; primaryColor: string | null; supportEmail: string | null }

/** PLATFORM_MANAGER only — branding of the current tenant (name, logo, support email). */
export default function OrgBrandingCard() {
  const qc = useQueryClient()
  const branding = useBranding()
  const { data: tenant } = useQuery<MyTenant>({ queryKey: ['my-tenant'], queryFn: () => api.get('/tenants/me').then(r => r.data) })
  const [form, setForm] = useState({ name: '', logoUrl: '', supportEmail: '' })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (tenant) setForm({ name: tenant.name, logoUrl: tenant.logoUrl ?? '', supportEmail: tenant.supportEmail ?? '' })
  }, [tenant])

  const save = useMutation({
    mutationFn: () => api.patch('/tenants/me', {
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || null,
      supportEmail: form.supportEmail.trim() || null,
    }),
    onSuccess: () => {
      setSaved(true); setTimeout(() => setSaved(false), 2500)
      qc.invalidateQueries({ queryKey: ['my-tenant'] })
      qc.invalidateQueries({ queryKey: ['branding'] })
    }
  })

  if (!tenant) return null
  const url = `https://${tenant.slug}.${branding.baseDomain}`
  const inputCls = 'w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-gray-50'

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-3">
        <Building2 size={15} className="text-primary-600" /> Mon organisation
      </h2>
      <div className="card p-4 space-y-3">
        <div className="text-xs text-gray-500">
          Espace : <a href={url} className="text-primary-600 font-medium" target="_blank" rel="noreferrer">{url}</a>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Nom affiché</label>
          <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">URL du logo (PNG/SVG, fond transparent)</label>
          <input className={inputCls} placeholder="https://…/logo.png" value={form.logoUrl} onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))} />
          {form.logoUrl && <img src={form.logoUrl} alt="aperçu" className="h-10 mt-2 object-contain" />}
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">Email support (affiché aux employés)</label>
          <input className={inputCls} placeholder="support@entreprise.com" value={form.supportEmail} onChange={e => setForm(f => ({ ...f, supportEmail: e.target.value }))} />
        </div>
        {save.isError && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">Enregistrement impossible (vérifiez l'URL du logo / l'email).</div>}
        <button onClick={() => save.mutate()} disabled={save.isPending || form.name.trim().length < 2}
          className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : <Building2 size={14} />}
          {saved ? 'Enregistré' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )
}
