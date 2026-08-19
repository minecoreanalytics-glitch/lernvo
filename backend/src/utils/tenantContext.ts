import { AsyncLocalStorage } from 'node:async_hooks'

export interface TenantCtx { tenantId: string | null; superAdmin: boolean }

export const tenantStore = new AsyncLocalStorage<TenantCtx>()

export function getCtx(): TenantCtx | undefined {
  return tenantStore.getStore()
}

export function getTenantId(): string {
  const ctx = tenantStore.getStore()
  if (!ctx || ctx.tenantId == null) {
    throw new Error('No tenant context available (fail-closed)')
  }
  return ctx.tenantId
}

export function isSuperAdmin(): boolean {
  return tenantStore.getStore()?.superAdmin === true
}
