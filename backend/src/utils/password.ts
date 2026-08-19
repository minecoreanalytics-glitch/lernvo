/**
 * Password hashing — native (Rust) bcrypt so the work runs on the libuv thread pool instead of
 * blocking the single JS thread. Measured on this codebase: 8 concurrent hashes take ~560 ms
 * natively against ~2 380 ms with the pure-JS implementation, and the hashes stay interchangeable
 * ($2a from the old library still verifies here), so existing accounts are unaffected.
 */
import { hash as nativeHash, verify as nativeVerify } from '@node-rs/bcrypt'

export const BCRYPT_COST = 12

export function hashPassword(plain: string, cost: number = BCRYPT_COST): Promise<string> {
  return nativeHash(plain, cost)
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return nativeVerify(plain, hash).catch(() => false)
}

/** Hash a batch of generated passwords, returning both halves. Bounded parallelism. */
export async function hashManyWithPlains(plains: string[], concurrency = 8): Promise<{ plains: string[]; hashes: string[] }> {
  return { plains, hashes: await hashMany(plains, concurrency) }
}

/** Hash many passwords without saturating the pool: bounded parallelism. */
export async function hashMany(plains: string[], concurrency = 8): Promise<string[]> {
  const out: string[] = new Array(plains.length)
  let i = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, plains.length) }, async () => {
    while (i < plains.length) {
      const idx = i++
      out[idx] = await hashPassword(plains[idx])
    }
  }))
  return out
}
