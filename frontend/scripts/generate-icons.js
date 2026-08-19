/**
 * Generate PWA icons from favicon.svg
 * Run: node scripts/generate-icons.js
 * Requires: sharp (npm install -D sharp)
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgBuffer = readFileSync(resolve(__dirname, '../public/favicon.svg'))

const sizes = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of sizes) {
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(resolve(__dirname, `../public/${name}`))
  console.log(`✅ Generated ${name} (${size}x${size})`)
}

console.log('\n🎉 All PWA icons generated!')
