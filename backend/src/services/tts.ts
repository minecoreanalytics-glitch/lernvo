/**
 * Text-to-speech via Gemini (same GEMINI_API_KEY as the rest of the AI features).
 * Model gemini-2.5-flash-preview-tts returns raw PCM 16-bit mono 24 kHz → wrapped as WAV.
 */
import fs from 'fs'
import path from 'path'
import { logger } from '../utils/logger'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts'
const AUDIO_DIR = path.join(process.cwd(), 'uploads', 'audio')

export const TTS_CONFIGURED = !!GEMINI_API_KEY
const MAX_CHARS = 4500 // per request; longer texts are chunked

/** Markdown → plain speakable text (headings kept as sentences, lists as sentences). */
export function markdownToSpeech(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*(.+)$/gm, '$1.')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_`>#|]/g, '')
    .replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n').replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function chunk(text: string): string[] {
  const out: string[] = []; let cur = ''
  for (const sentence of text.split(/(?<=[.!?…])\s+|\n+/)) {
    if ((cur + ' ' + sentence).length > MAX_CHARS && cur) { out.push(cur.trim()); cur = sentence } else cur += (cur ? ' ' : '') + sentence
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

async function synthesizeChunk(text: string, voice: string, style: string): Promise<Buffer> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${style ? style + ' ' : ''}${text}` }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } },
    }),
  })
  if (!res.ok) throw new Error(`Gemini TTS ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const j = await res.json() as { candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }> }
  const part = j.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
  if (!part?.inlineData?.data) throw new Error('Gemini TTS: no audio returned')
  return Buffer.from(part.inlineData.data, 'base64') // PCM s16le 24k mono
}

function wav(pcm: Buffer, sampleRate = 24000, channels = 1, bits = 16): Buffer {
  const header = Buffer.alloc(44)
  const byteRate = sampleRate * channels * bits / 8
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8)
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(byteRate, 28); header.writeUInt16LE(channels * bits / 8, 32); header.writeUInt16LE(bits, 34)
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40)
  return Buffer.concat([header, pcm])
}

/** Synthesize a whole text to a WAV file under uploads/audio. Returns the public URL path. */
export async function synthesizeToFile(text: string, opts: { voice?: string; style?: string; filename: string }): Promise<{ url: string; seconds: number; chunks: number }> {
  if (!TTS_CONFIGURED) throw Object.assign(new Error('TTS non configuré (GEMINI_API_KEY)'), { status: 503 })
  const parts = chunk(text)
  const buffers: Buffer[] = []
  for (const p of parts) buffers.push(await synthesizeChunk(p, opts.voice || 'Kore', opts.style || 'Lis ce texte de formation d\'une voix claire, posée et professionnelle, en français :'))
  const pcm = Buffer.concat(buffers)
  fs.mkdirSync(AUDIO_DIR, { recursive: true })
  const file = path.join(AUDIO_DIR, opts.filename)
  fs.writeFileSync(file, wav(pcm))
  logger.info(`TTS generated ${opts.filename} (${parts.length} chunks, ${(pcm.length / 48000).toFixed(0)}s)`)
  return { url: `/uploads/audio/${opts.filename}`, seconds: Math.round(pcm.length / 48000), chunks: parts.length }
}
