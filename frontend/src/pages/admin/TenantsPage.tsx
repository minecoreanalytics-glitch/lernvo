import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Loader2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { api } from '../../utils/api'
import { useAuthStore } from '../../store/auth'
import type { Tenant } from '../../types'

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'chip bg-amber-100 text-amber-700 border border-amber-200',
  ACTIVE:    'chip chip-success',
  SUSPENDED: 'chip bg-red-100 text-red-700 border border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING:   'En attente',
  ACTIVE:    'Actif',
  SUSPENDED: 'Suspendu',
}

// ─── Sort order: PENDING first, then ACTIVE, then SUSPENDED ──────────────────

const STATUS_ORDER: Record<string, number> = { PENDING: 0, ACTIVE: 1, SUSPENDED: 2 }

function sortTenants(tenants: Tenant[]): Tenant[] {
  return [...tenants].sort((a, b) => {
    const orderDiff = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)
    if (orderDiff !== 0) return orderDiff
    // Within the same status group: newest first (createdAt desc)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })
}

// ─── Date formatter ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function TenantsPage() {
  const user = useAuthStore(s => s.user)

  // Guard: SUPER_ADMIN only
  if (!user || user.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />
  }

  return <TenantsContent />
}

function TenantsContent() {
  const queryClient = useQueryClient()

  const { data: tenants, isLoading, error: fetchError } = useQuery<Tenant[]>({
    queryKey: ['admin-tenants'],
    queryFn: () => api.get('/tenants').then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tenants/${id}/approve`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  })

  const suspendMutation = useMutation({
    mutationFn: (id: string) => api.post(`/tenants/${id}/suspend`).then(r => r.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-tenants'] }),
  })

  const sorted = tenants ? sortTenants(tenants) : []

  // Determine which tenant ID is currently pending a mutation
  const approvingId = approveMutation.isPending
    ? (approveMutation.variables as string | undefined)
    : undefined
  const suspendingId = suspendMutation.isPending
    ? (suspendMutation.variables as string | undefined)
    : undefined

  const approveError = approveMutation.isError
    ? ((approveMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur lors de l\'approbation')
    : null
  const suspendError = suspendMutation.isError
    ? ((suspendMutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erreur lors de la suspension')
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Building2 size={20} className="text-primary-600" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Entreprises</h1>
          <p className="text-sm text-gray-500 mt-0.5">Approuvez les nouvelles entreprises inscrites.</p>
        </div>
      </div>

      {/* Inline mutation errors */}
      {approveError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
          {approveError}
        </div>
      )}
      {suspendError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
          {suspendError}
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-2.5">
          Impossible de charger les entreprises.
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3 text-left">Nom</th>
              <th className="px-4 py-3 text-left hidden sm:table-cell">Slug</th>
              <th className="px-4 py-3 text-left">Statut</th>
              <th className="px-4 py-3 text-left hidden md:table-cell">Inscrit le</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Loading skeleton
              [...Array(5)].map((_, i) => (
                <tr key={i}>
                  <td colSpan={5} className="px-4 py-3">
                    <div className="h-4 bg-gray-100 rounded animate-pulse" />
                  </td>
                </tr>
              ))
            ) : sorted.length === 0 ? (
              // Empty state
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-400">
                  Aucune entreprise pour le moment.
                </td>
              </tr>
            ) : (
              sorted.map(tenant => {
                const isApprovingThis = approvingId === tenant.id
                const isSuspendingThis = suspendingId === tenant.id

                return (
                  <tr key={tenant.id} className="hover:bg-primary-50 transition-colors">
                    {/* Nom */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-800">{tenant.name}</div>
                    </td>

                    {/* Slug */}
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs font-mono text-gray-400">{tenant.slug}</span>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span className={STATUS_BADGE[tenant.status] ?? 'chip chip-gray'}>
                        {STATUS_LABEL[tenant.status] ?? tenant.status}
                      </span>
                    </td>

                    {/* Inscrit le */}
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-gray-500">{formatDate(tenant.createdAt)}</span>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 text-right">
                      {tenant.status === 'PENDING' && (
                        <button
                          onClick={() => approveMutation.mutate(tenant.id)}
                          disabled={isApprovingThis || isSuspendingThis}
                          className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 ml-auto disabled:opacity-50"
                        >
                          {isApprovingThis && <Loader2 size={12} className="animate-spin" />}
                          Approuver
                        </button>
                      )}

                      {tenant.status === 'ACTIVE' && (
                        <button
                          onClick={() => suspendMutation.mutate(tenant.id)}
                          disabled={isSuspendingThis || isApprovingThis}
                          className="text-xs font-medium px-3 py-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5 ml-auto disabled:opacity-50"
                        >
                          {isSuspendingThis && <Loader2 size={12} className="animate-spin" />}
                          Suspendre
                        </button>
                      )}

                      {tenant.status === 'SUSPENDED' && (
                        <button
                          onClick={() => approveMutation.mutate(tenant.id)}
                          disabled={isApprovingThis || isSuspendingThis}
                          className="text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors flex items-center gap-1.5 ml-auto disabled:opacity-50"
                        >
                          {isApprovingThis && <Loader2 size={12} className="animate-spin" />}
                          Réactiver
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
