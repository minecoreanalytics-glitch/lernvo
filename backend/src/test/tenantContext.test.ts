import { describe, it, expect } from 'vitest'
import { tenantStore, getTenantId, isSuperAdmin } from '../utils/tenantContext'

describe('tenantContext', () => {
  it('returns the tenantId set for the running context', () => {
    tenantStore.run({ tenantId: 't1', superAdmin: false }, () => {
      expect(getTenantId()).toBe('t1')
      expect(isSuperAdmin()).toBe(false)
    })
  })
  it('throws when tenantId read outside any context', () => {
    expect(() => getTenantId()).toThrow(/no tenant context/i)
  })
  it('superAdmin context has no tenantId but isSuperAdmin true', () => {
    tenantStore.run({ tenantId: null, superAdmin: true }, () => {
      expect(isSuperAdmin()).toBe(true)
    })
  })
})
