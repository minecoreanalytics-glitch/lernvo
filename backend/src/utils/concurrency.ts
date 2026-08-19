/**
 * Bounded concurrency for long, CPU/network-heavy jobs (AI generation, speech synthesis).
 * These run inside the request, so without a cap a handful of admins can hold every connection
 * for a minute each. Callers get a clear 503 instead of a silent queue.
 */
export class Semaphore {
  private active = 0
  private readonly waiting: Array<() => void> = []
  constructor(private readonly limit: number, private readonly maxWaiting = 0) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.limit) {
      if (this.waiting.length >= this.maxWaiting) {
        throw Object.assign(new Error('Trop de générations en cours, réessayez dans un instant.'), { status: 503 })
      }
      await new Promise<void>(resolve => this.waiting.push(resolve))
    }
    this.active++
    try { return await fn() } finally {
      this.active--
      this.waiting.shift()?.()
    }
  }
}

/** One heavy AI job at a time, with a short queue — the box also serves the rest of the product. */
export const heavyAi = new Semaphore(Number(process.env.AI_CONCURRENCY ?? 2), Number(process.env.AI_QUEUE ?? 4))
