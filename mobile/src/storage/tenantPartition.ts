export type TenantPartition = Readonly<{
  tenantId: string;
  userId: string;
  key: string;
}>;

function validateId(name: 'tenantId' | 'userId', value: string) {
  if (!value || value.includes(':')) {
    throw new Error(`${name} must be a non-empty identifier without colons`);
  }
}

export function tenantPartition(tenantId: string, userId: string): TenantPartition {
  validateId('tenantId', tenantId);
  validateId('userId', userId);
  return { tenantId, userId, key: `${tenantId}:${userId}` };
}
