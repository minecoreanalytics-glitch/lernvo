import { useQuery } from '@tanstack/react-query'
import { api } from '../utils/api'

export type Branding = {
  platformName: string
  baseDomain: string
  tenant: { name: string; slug: string; logoUrl: string | null; primaryColor: string | null; supportEmail: string | null } | null
}

const FALLBACK: Branding = { platformName: 'Lernvo', baseDomain: 'lernvo.com', tenant: null }

/** Public branding resolved from the current host (<slug>.<domain>) — never fails, falls back to platform. */
export function useBranding() {
  const q = useQuery<Branding>({
    queryKey: ['branding'],
    queryFn: () => api.get('/branding').then(r => r.data),
    staleTime: 10 * 60 * 1000,
    retry: false,
  })
  const b = q.data ?? FALLBACK
  return {
    ...b,
    /** Name to display: tenant name on a tenant host, platform name on the apex */
    displayName: b.tenant?.name ?? b.platformName,
    logoUrl: b.tenant?.logoUrl ?? null,
    isTenantHost: !!b.tenant,
    isLoading: q.isLoading,
  }
}
