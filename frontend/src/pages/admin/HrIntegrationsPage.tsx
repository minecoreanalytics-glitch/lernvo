import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Plug, Plus, Play, FlaskConical, KeyRound, Trash2, Upload, Loader2, CheckCircle2, XCircle, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import { api } from '../../utils/api'
import { useBranding } from '../../hooks/useBranding'

type Connector = {
  id: string; type: 'ODOO' | 'CSV' | 'API'; name: string; enabled: boolean
  config: Record<string, string>; hasApiKey: boolean; pushCertificates: boolean; deactivateMissing: boolean
  intervalMinutes: number; lastRunAt: string | null
}
type Run = { id: string; source: string; status: string; stats: { departments?: { created: number; updated: number }; employees?: { created: number; updated: number; deactivated: number; skipped: number }; warnings?: string[] } | null; error: string | null; startedAt: string; finishedAt: string | null }

const errMsg = (e: unknown) => (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur'

/** PLATFORM_MANAGER — HRIS connectors: Odoo (pull), API key (push from n8n/any HRIS), CSV import; runs history. */
export default function HrIntegrationsPage() {
  const qc = useQueryClient()
  const branding = useBranding()
  const { data: connectors = [] } = useQuery<Connector[]>({ queryKey: ['hr-connectors'], queryFn: () => api.get('/hr/connectors').then(r => r.data) })
  const { data: runs = [] } = useQuery<Run[]>({ queryKey: ['hr-runs'], queryFn: () => api.get('/hr/runs').then(r => r.data), refetchInterval: 30_000 })
  const refresh = () => { qc.invalidateQueries({ queryKey: ['hr-connectors'] }); qc.invalidateQueries({ queryKey: ['hr-runs'] }) }

  const [showNew, setShowNew] = useState<null | 'ODOO' | 'API'>(null)
  const [form, setForm] = useState({ name: '', url: '', db: '', username: '', apiKey: '' })
  const [msg, setMsg] = useState<Record<string, { ok: boolean; text: string }>>({})
  const setM = (id: string, ok: boolean, text: string) => setMsg(m => ({ ...m, [id]: { ok, text } }))

  const create = useMutation({
    mutationFn: () => api.post('/hr/connectors', showNew === 'ODOO'
      ? { type: 'ODOO', name: form.name || 'Odoo', config: { url: form.url.trim(), db: form.db.trim(), username: form.username.trim(), apiKey: form.apiKey } }
      : { type: 'API', name: form.name || 'API (n8n / SIRH)' }),
    onSuccess: () => { setShowNew(null); setForm({ name: '', url: '', db: '', username: '', apiKey: '' }); refresh() }
  })
  const patch = useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<Connector> }) => api.patch(`/hr/connectors/${id}`, data), onSuccess: refresh })
  const del = useMutation({ mutationFn: (id: string) => api.delete(`/hr/connectors/${id}`), onSuccess: refresh })
  const test = useMutation({
    mutationFn: (id: string) => api.post(`/hr/connectors/${id}/test`).then(r => ({ id, d: r.data })),
    onSuccess: ({ id, d }) => setM(id, true, `Connexion OK — Odoo ${d.version ?? ''}, ${d.employees ?? '?'} employés, ${d.departments ?? '?'} départements`),
    onError: (e, id) => setM(id, false, errMsg(e))
  })
  const run = useMutation({
    mutationFn: (id: string) => api.post(`/hr/connectors/${id}/run`).then(r => ({ id, d: r.data })),
    onSuccess: ({ id, d }) => { setM(id, true, `Sync OK — ${d.stats?.employees?.created ?? 0} créés, ${d.stats?.employees?.updated ?? 0} mis à jour, ${d.stats?.departments?.created ?? 0} départements créés`); refresh() },
    onError: (e, id) => { setM(id, false, errMsg(e)); refresh() }
  })
  const [shownKey, setShownKey] = useState<Record<string, string>>({})
  const rotate = useMutation({
    mutationFn: (id: string) => api.post(`/hr/connectors/${id}/rotate-key`).then(r => ({ id, key: r.data.key as string })),
    onSuccess: ({ id, key }) => { setShownKey(k => ({ ...k, [id]: key })); refresh() }
  })

  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvDeact, setCsvDeact] = useState(false)
  const importCsv = useMutation({
    mutationFn: () => { const fd = new FormData(); fd.append('file', csvFile!); fd.append('deactivateMissing', String(csvDeact)); return api.post('/hr/import-csv', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data) },
    onSuccess: () => { setCsvFile(null); refresh() }
  })

  const inputCls = 'input text-sm'
  const pushUrl = `https://${branding.baseDomain}/api/hr/push`

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2"><Plug size={20} className="text-primary-600" /> Intégrations RH</h1>
          <p className="text-sm text-gray-500 mt-0.5">Employés et organigramme importés depuis votre SIRH ; certificats et accomplissements renvoyés dans la fiche employé.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setShowNew('ODOO')} className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> Odoo</button>
          <button onClick={() => setShowNew('API')} className="btn-outline text-xs px-3 py-2 flex items-center gap-1.5"><Plus size={14} /> Clé API</button>
        </div>
      </div>

      {showNew && (
        <div className="card p-4 space-y-3">
          <h2 className="text-sm font-bold text-gray-800">{showNew === 'ODOO' ? 'Connecter Odoo (hr.employee / hr.department)' : 'Clé API — votre SIRH ou n8n pousse les employés vers Lernvo'}</h2>
          <input className={inputCls} placeholder="Nom (ex. Odoo production)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          {showNew === 'ODOO' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input className={inputCls} placeholder="URL Odoo (https://odoo.entreprise.com)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              <input className={inputCls} placeholder="Base de données" value={form.db} onChange={e => setForm(f => ({ ...f, db: e.target.value }))} />
              <input className={inputCls} placeholder="Utilisateur (email Odoo)" value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
              <input className={inputCls} type="password" placeholder="Clé API Odoo (Préférences → Sécurité)" value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))} />
            </div>
          )}
          {create.isError && <p className="text-xs text-red-600">{errMsg(create.error)}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowNew(null)} className="btn-ghost text-xs">Annuler</button>
            <button onClick={() => create.mutate()} disabled={create.isPending || (showNew === 'ODOO' && !(form.url && form.db && form.username && form.apiKey))} className="btn-primary text-xs px-3 py-2 disabled:opacity-50">
              {create.isPending ? <Loader2 size={12} className="animate-spin" /> : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      {/* Connectors */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-gray-800">Connecteurs</h2>
        {connectors.length === 0 && <div className="card p-4 text-sm text-gray-400">Aucun connecteur. Ajoutez Odoo, une clé API, ou importez un CSV ci-dessous.</div>}
        {connectors.map(c => (
          <div key={c.id} className="card p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip chip-gray text-[10px]">{c.type}</span>
              <span className="text-sm font-semibold text-gray-800">{c.name}</span>
              {c.type === 'ODOO' && <span className="text-xs text-gray-400 truncate">{c.config.url} · {c.config.db}</span>}
              {c.lastRunAt && <span className="text-[11px] text-gray-400">· dernière sync {formatDistanceToNow(new Date(c.lastRunAt), { addSuffix: true, locale: fr })}</span>}
              <span className="flex-1" />
              <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={c.enabled} onChange={e => patch.mutate({ id: c.id, data: { enabled: e.target.checked } })} /> Actif</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600" title="Écrire les certificats obtenus dans la fiche employé du SIRH"><input type="checkbox" checked={c.pushCertificates} onChange={e => patch.mutate({ id: c.id, data: { pushCertificates: e.target.checked } })} /> Renvoyer les certificats</label>
              <label className="flex items-center gap-1.5 text-xs text-gray-600" title="Désactiver dans Lernvo les employés absents du SIRH"><input type="checkbox" checked={c.deactivateMissing} onChange={e => patch.mutate({ id: c.id, data: { deactivateMissing: e.target.checked } })} /> Désactiver les absents</label>
              <button onClick={() => { if (confirm('Supprimer ce connecteur ?')) del.mutate(c.id) }} className="btn-ghost text-xs px-2 py-1 text-red-500"><Trash2 size={13} /></button>
            </div>
            {c.type === 'ODOO' && (
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => test.mutate(c.id)} disabled={test.isPending} className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"><FlaskConical size={12} /> Tester</button>
                <button onClick={() => run.mutate(c.id)} disabled={run.isPending} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">{run.isPending ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />} Synchroniser maintenant</button>
                <span className="text-[11px] text-gray-400">Auto toutes les {c.intervalMinutes} min</span>
              </div>
            )}
            {c.type === 'API' && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => rotate.mutate(c.id)} disabled={rotate.isPending} className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"><KeyRound size={12} /> {c.hasApiKey ? 'Régénérer la clé' : 'Générer la clé'}</button>
                  {c.hasApiKey && !shownKey[c.id] && <span className="text-[11px] text-gray-400">Clé active (affichée une seule fois à la génération)</span>}
                </div>
                {shownKey[c.id] && (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="font-mono break-all text-gray-800">{shownKey[c.id]}</div>
                    <div className="text-gray-500">Copiez-la maintenant — elle ne sera plus affichée. Exemple :</div>
                    <pre className="font-mono text-[10px] text-gray-600 whitespace-pre-wrap">{`POST ${pushUrl}
X-HR-Key: ${shownKey[c.id]}
{ "departments": [{ "externalId": "D1", "name": "Ventes" }],
  "employees": [{ "externalId": "E1", "email": "a@b.com", "firstName": "A", "lastName": "B", "departmentExternalId": "D1", "role": "AGENT" }] }`}</pre>
                  </div>
                )}
              </div>
            )}
            {msg[c.id] && <div className={`text-xs flex items-center gap-1.5 ${msg[c.id].ok ? 'text-green-700' : 'text-red-600'}`}>{msg[c.id].ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />} {msg[c.id].text}</div>}
          </div>
        ))}
      </section>

      {/* CSV */}
      <section className="card p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2"><Upload size={14} className="text-primary-600" /> Import CSV (sans SIRH)</h2>
        <p className="text-xs text-gray-500">Colonnes (en-tête, ordre libre) : <code>email, firstname, lastname, department, manager_email, role, hiredat, active, externalid</code>. Séparateur virgule ou point-virgule. Les employés existants sont mis à jour par email ; les nouveaux reçoivent un mot de passe temporaire par email (si SMTP configuré).</p>
        <div className="flex flex-wrap items-center gap-3">
          <input type="file" accept=".csv,text/csv" onChange={e => setCsvFile(e.target.files?.[0] ?? null)} className="text-xs" />
          <label className="flex items-center gap-1.5 text-xs text-gray-600"><input type="checkbox" checked={csvDeact} onChange={e => setCsvDeact(e.target.checked)} /> Désactiver les employés absents du fichier</label>
          <button onClick={() => importCsv.mutate()} disabled={!csvFile || importCsv.isPending} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50">{importCsv.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Importer</button>
        </div>
        {importCsv.isSuccess && <p className="text-xs text-green-700">Import OK — {importCsv.data.rows} lignes : {importCsv.data.stats.employees.created} créés, {importCsv.data.stats.employees.updated} mis à jour, {importCsv.data.stats.employees.skipped} ignorés, {importCsv.data.stats.departments.created} départements créés.</p>}
        {importCsv.isError && <p className="text-xs text-red-600">{errMsg(importCsv.error)}</p>}
      </section>

      {/* Runs */}
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2"><RefreshCw size={14} className="text-primary-600" /> Historique des synchronisations</h2>
        {runs.length === 0 ? <div className="card p-4 text-sm text-gray-400">Aucune synchronisation.</div> : (
          <div className="card divide-y divide-gray-100">
            {runs.slice(0, 20).map(r => (
              <div key={r.id} className="p-3 text-xs flex flex-wrap items-center gap-2">
                <span className={`chip text-[10px] ${r.status === 'success' ? 'chip-success' : r.status === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'chip-gray'}`}>{r.status}</span>
                <span className="font-semibold text-gray-700">{r.source}</span>
                <span className="text-gray-400">{new Date(r.startedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {r.stats?.employees && <span className="text-gray-500">· {r.stats.employees.created} créés · {r.stats.employees.updated} mis à jour{r.stats.employees.deactivated ? ` · ${r.stats.employees.deactivated} désactivés` : ''}{r.stats.employees.skipped ? ` · ${r.stats.employees.skipped} ignorés` : ''}</span>}
                {r.error && <span className="text-red-600 truncate max-w-full">— {r.error}</span>}
                {r.stats?.warnings && r.stats.warnings.length > 0 && <span className="text-amber-600">· {r.stats.warnings.length} avertissement(s)</span>}
              </div>
            ))}
          </div>
        )}
      </section>
    </motion.div>
  )
}
