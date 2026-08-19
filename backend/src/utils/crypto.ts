import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'crypto'

// Key derived once from JWT_SECRET (no extra secret to manage). Rotating JWT_SECRET re-encrypts nothing —
// stored secrets become unreadable; connectors must then be re-saved. Documented in NEW_TENANT.md.
const KEY = scryptSync(process.env.JWT_SECRET || 'dev-secret', 'lernvo-secrets-v1', 32)

export function encrypt(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', KEY, iv)
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()])
  return `enc:v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

export function decrypt(value: string): string {
  if (!value.startsWith('enc:v1:')) return value
  const [, , iv, tag, data] = value.split(':')
  const d = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8')
}

export function sha256(s: string): string { return createHash('sha256').update(s).digest('hex') }
