import type { HrPayload } from './sync'

/**
 * Odoo connector (JSON-RPC, Odoo ≥ 14). Config: { url, db, username, apiKey }.
 * Reads hr.department + hr.employee. Writes certificates back as hr.resume.line
 * (module hr_skills) or, if unavailable, as a chatter message on the employee.
 */
export type OdooConfig = { url: string; db: string; username: string; apiKey: string }

async function rpc<T>(url: string, service: string, method: string, args: unknown[]): Promise<T> {
  const res = await fetch(`${url.replace(/\/$/, '')}/jsonrpc`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params: { service, method, args } }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`)
  const j = await res.json() as { result?: T; error?: { data?: { message?: string }; message?: string } }
  if (j.error) throw new Error(j.error.data?.message || j.error.message || 'Odoo RPC error')
  return j.result as T
}

export class OdooClient {
  private uid: number | null = null
  constructor(private cfg: OdooConfig) {}

  async login(): Promise<number> {
    if (this.uid) return this.uid
    const uid = await rpc<number | false>(this.cfg.url, 'common', 'login', [this.cfg.db, this.cfg.username, this.cfg.apiKey])
    if (!uid) throw new Error('Odoo: identifiants refusés')
    this.uid = uid; return uid
  }
  async exec<T>(model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}): Promise<T> {
    const uid = await this.login()
    return rpc<T>(this.cfg.url, 'object', 'execute_kw', [this.cfg.db, uid, this.cfg.apiKey, model, method, args, kwargs])
  }
  async test(): Promise<{ uid: number; version: string; employees: number; departments: number }> {
    const uid = await this.login()
    const v = await rpc<{ server_version?: string }>(this.cfg.url, 'common', 'version', [])
    const [employees, departments] = await Promise.all([
      this.exec<number>('hr.employee', 'search_count', [[['active', '=', true]]]),
      this.exec<number>('hr.department', 'search_count', [[]]),
    ])
    return { uid, version: v.server_version ?? '?', employees, departments }
  }

  /** Pull org chart + employees into the normalized HR payload. */
  async pull(): Promise<HrPayload> {
    type M2O = [number, string] | false
    const depts = await this.exec<Array<{ id: number; name: string; parent_id: M2O; manager_id: M2O }>>('hr.department', 'search_read', [[]], { fields: ['name', 'parent_id', 'manager_id'] })
    const emps = await this.exec<Array<{ id: number; name: string; work_email: string | false; department_id: M2O; parent_id: M2O; job_title: string | false; active: boolean; first_contract_date?: string | false }>>(
      'hr.employee', 'search_read', [[['active', 'in', [true, false]]]], { fields: ['name', 'work_email', 'department_id', 'parent_id', 'job_title', 'active', 'first_contract_date'] })
    const managerIds = new Set(depts.map(d => d.manager_id ? d.manager_id[0] : 0))
    return {
      departments: depts.map(d => ({ externalId: String(d.id), name: d.name, parentExternalId: d.parent_id ? String(d.parent_id[0]) : null, managerName: d.manager_id ? d.manager_id[1] : null })),
      employees: emps.filter(e => e.work_email).map(e => {
        const [firstName, ...rest] = e.name.trim().split(/\s+/)
        return {
          externalId: String(e.id), email: String(e.work_email), firstName, lastName: rest.join(' ') || firstName,
          role: managerIds.has(e.id) ? 'MANAGER' : undefined,
          departmentExternalId: e.department_id ? String(e.department_id[0]) : null,
          managerExternalId: e.parent_id ? String(e.parent_id[0]) : null,
          hiredAt: e.first_contract_date || null, active: e.active,
        }
      })
    }
  }

  /** Push a certificate to the employee record. Best effort: resume line, else chatter note. */
  async pushCertificate(employeeExternalId: string, title: string, certNumber: string, issuedAt: Date): Promise<'resume' | 'message'> {
    const empId = Number(employeeExternalId)
    const date = issuedAt.toISOString().slice(0, 10)
    try {
      const types = await this.exec<Array<{ id: number }>>('hr.resume.line.type', 'search_read', [[['name', 'ilike', 'certif']]], { fields: ['id'], limit: 1 })
      const line_type_id = types[0]?.id
      await this.exec('hr.resume.line', 'create', [{ employee_id: empId, name: title, description: `Certificat ${certNumber} — Lernvo`, date_start: date, ...(line_type_id ? { line_type_id } : {}), display_type: 'certification' }])
      return 'resume'
    } catch {
      await this.exec('hr.employee', 'message_post', [[empId]], { body: `🎓 Certificat obtenu : <b>${title}</b> (${certNumber}) — ${date} — via Lernvo` })
      return 'message'
    }
  }
}
