import Redis from 'ioredis'
import { logger } from './logger'

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times) => Math.min(times * 50, 2000)
})

redis.on('connect', () => logger.info('Redis connected'))
redis.on('error', (err) => logger.error('Redis error', err))

export const CACHE_TTL = {
  LEADERBOARD: 60,       // 1 min
  USER_PROFILE: 300,     // 5 min
  MODULE_LIST: 600,      // 10 min
  KB_ARTICLE: 3600,      // 1 hr
}
