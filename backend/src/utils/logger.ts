import winston from 'winston'
import 'winston-daily-rotate-file'

const isProd = process.env.NODE_ENV === 'production'

const prodTransports: winston.transport[] = [
  // Error log: 30-day retention, max 100MB per file, max 500MB total
  new winston.transports.DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '100m',
    maxFiles: '30d',
    zippedArchive: true
  }),
  // Combined log: 14-day retention, max 100MB per file, max 1GB total
  new winston.transports.DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '100m',
    maxFiles: '14d',
    zippedArchive: true
  })
]

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    isProd
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
  ),
  transports: [
    new winston.transports.Console(),
    ...(isProd ? prodTransports : [])
  ]
})
