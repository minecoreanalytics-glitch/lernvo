/**
 * Service Tarifs — parse Excel multi-format, normalisation IA multi-marques (par tenant)
 */
import * as XLSX from 'xlsx'
import { randomUUID } from 'crypto'
import { prisma } from '../utils/prisma'
import { getTenantId } from '../utils/tenantContext'
import { logger } from '../utils/logger'
import { NotificationService } from './notifications'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

export function brandLabel(brand: string) {
  return brand.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

export type ParsedSheet = {
  sheetName: string
  rows: string[][]
  rowNumbers: number[]
}

export type NormalizedPricingItem = {
  serviceName: string
  description?: string
  price: string
  priceNumeric?: number | null
  currency?: string
  unit?: string
  features?: string[]
  metadata?: Record<string, string>
}

export type NormalizedPricingCategory = {
  name: string
  sheetName?: string
  items: NormalizedPricingItem[]
}

export type NormalizedBrandPricing = {
  brand: string
  categories: NormalizedPricingCategory[]
}

export type MultiBrandPricing = {
  brands: NormalizedBrandPricing[]
}

export type PricingChangeRecord = {
  categoryName: string
  serviceName: string
  changeType: 'added' | 'updated' | 'removed'
  oldPrice?: string
  newPrice?: string
  details?: string
}

export type BrandImportResult = {
  brand: string
  uploadId: string
  itemCount: number
  changeCount: number
  changes: PricingChangeRecord[]
}

export type ImportPricingResult = {
  batchId: string
  fileName: string
  brands: BrandImportResult[]
  totalItems: number
  totalChanges: number
}

type ExistingItem = {
  categoryName: string
  serviceName: string
  price: string
  priceNumeric: number | null
}

function itemKey(categoryName: string, serviceName: string) {
  return `${categoryName.trim().toLowerCase()}::${serviceName.trim().toLowerCase()}`
}

function parsePriceNumeric(price: string): number | null {
  const cleaned = price.replace(/[^\d.,]/g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return Number.isFinite(num) ? num : null
}

function colLetter(col: number): string {
  let s = ''
  let n = col
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s
    n = Math.floor(n / 26) - 1
  }
  return s
}

function toBrandSlug(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'DEFAULT'
}

export function parseExcelSheets(buffer: Buffer): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const maxRows = 150

  return workbook.SheetNames.map(sheetName => {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet?.['!ref']) return null

    const range = XLSX.utils.decode_range(sheet['!ref'])
    const rows: string[][] = []
    const rowNumbers: number[] = []

    for (let R = range.s.r; R <= range.e.r && rows.length < maxRows; R++) {
      const cells: string[] = []
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C })
        const cell = sheet[addr]
        const val = cell ? String(cell.w ?? cell.v ?? '').trim() : ''
        cells.push(val)
      }
      if (cells.some(c => c.length > 0)) {
        rows.push(cells)
        rowNumbers.push(R + 1)
      }
    }

    return rows.length > 0 ? { sheetName, rows, rowNumbers } : null
  }).filter((s): s is ParsedSheet => s !== null)
}

function sheetsToPromptText(sheets: ParsedSheet[], fileName: string): string {
  const header = `FICHIER: "${fileName}" — ${sheets.length} feuille(s)\n`
  const body = sheets.map(s => {
    const lines = s.rows.map((row, i) => {
      const rowNum = s.rowNumbers[i]
      const cells = row
        .map((c, ci) => (c ? `${colLetter(ci)}:${c}` : ''))
        .filter(Boolean)
        .join(' | ')
      return `L${rowNum}: ${cells || '—'}`
    }).join('\n')
    return `=== FEUILLE "${s.sheetName}" (${s.rows.length} lignes) ===\n${lines}`
  }).join('\n\n')
  return header + body
}

async function callGeminiJson(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY non configurée')

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
    signal: AbortSignal.timeout(240_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userPrompt }] }],
      generationConfig: {
        maxOutputTokens: 32000,
        temperature: 0.15,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    })
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${err}`)
  }

  const data = await response.json() as {
    candidates: Array<{ content: { parts: Array<{ text?: string; thought?: boolean }> } }>
  }
  const parts = data.candidates?.[0]?.content?.parts ?? []
  const text = parts.find(p => !p.thought)?.text?.trim() || parts[0]?.text?.trim() || ''
  if (!text) throw new Error('Réponse IA vide')
  return text
}

function sanitizeItem(i: NormalizedPricingItem): NormalizedPricingItem | null {
  if (!i.serviceName?.trim()) return null

  const price = i.price?.trim()
    || (i.features?.length ? i.features.join(' · ') : '')
    || i.description?.trim()
    || 'Voir grille'

  return {
    serviceName: i.serviceName.trim(),
    description: i.description?.trim(),
    price,
    priceNumeric: i.priceNumeric ?? parsePriceNumeric(price),
    currency: i.currency?.trim() || 'HTG',
    unit: i.unit?.trim(),
    features: (i.features || []).map(f => String(f).trim()).filter(Boolean),
    metadata: i.metadata || {}
  }
}

function sanitizeCategories(categories: NormalizedPricingCategory[]): NormalizedPricingCategory[] {
  return categories
    .filter(c => c.name && Array.isArray(c.items))
    .map(c => ({
      name: c.name.trim(),
      sheetName: c.sheetName?.trim(),
      items: c.items.map(sanitizeItem).filter((item): item is NormalizedPricingItem => item !== null)
    }))
    .filter(c => c.items.length > 0)
}

export async function normalizePricingWithAI(
  sheets: ParsedSheet[],
  fileName: string,
  filterBrand?: string
): Promise<MultiBrandPricing> {
  const systemPrompt = `Tu es un expert en analyse de grilles tarifaires (télécom, services, abonnements).

Tu reçois des données brutes extraites d'un fichier Excel. Les formats varient:
- Tableaux horizontaux (plusieurs produits côte à côte)
- Sections POSTPAID / Prepaid / Plans journaliers
- Parfois pas de prix numérique mais débit, volume, ou validité

MARQUES (brand = identifiant UPPER_SNAKE par bloc):
- Chaque feuille ou gamme = une marque. Génère un slug UPPER_SNAKE depuis le nom de la feuille (ex: "Fibre Pro" → FIBRE_PRO, "Ligne Éco" → LIGNE_ECO).
- Regroupe chaque catégorie sous la marque correspondant à sa feuille.

RÈGLES:
1. Lire CHAQUE feuille et CHAQUE tableau
2. Une catégorie = section logique
3. Chaque plan/ligne = un item avec serviceName obligatoire
4. price: montant principal OU description tarifaire si pas de montant
5. priceNumeric: nombre extrait si possible, sinon null
6. features: colonnes secondaires
7. metadata: notes, promotions, frais d'entrée
8. Ne pas inventer de données
9. Classer chaque catégorie sous la bonne marque (brand)

Réponds UNIQUEMENT en JSON:
{
  "brands": [
    {
      "brand": "FIBRE_PRO",
      "categories": [
        {
          "name": "Fiber",
          "sheetName": "Fibre Pro",
          "items": [
            {
              "serviceName": "Fiber Home Starter",
              "description": "",
              "price": "100 Mbps / 30 Mbps",
              "priceNumeric": null,
              "currency": "HTG",
              "unit": "/mois",
              "features": ["DL 100 Mbps"],
              "metadata": {}
            }
          ]
        }
      ]
    }
  ]
}`

  const filterNote = filterBrand
    ? `\n\nIMPORTANT: Ne retourner QUE la marque ${filterBrand}.`
    : '\n\nRetourner TOUTES les marques détectées dans le fichier.'

  const userPrompt = `Analyse ce fichier Excel:\n\n${sheetsToPromptText(sheets, fileName)}${filterNote}`

  const raw = await callGeminiJson(systemPrompt, userPrompt)
  const parsed = JSON.parse(raw) as MultiBrandPricing

  if (!parsed.brands || !Array.isArray(parsed.brands)) {
    throw new Error('Format IA invalide: brands manquants')
  }

  const brands = parsed.brands
    .filter(b => b.brand)
    .map(b => ({
      brand: toBrandSlug(String(b.brand)),
      categories: sanitizeCategories(b.categories || [])
    }))
    .filter(b => b.categories.length > 0)

  if (filterBrand) {
    const slug = toBrandSlug(filterBrand)
    return { brands: brands.filter(b => b.brand === slug) }
  }

  return { brands }
}

export function diffPricing(
  existing: ExistingItem[],
  categories: NormalizedPricingCategory[]
): PricingChangeRecord[] {
  const changes: PricingChangeRecord[] = []
  const oldMap = new Map(existing.map(e => [itemKey(e.categoryName, e.serviceName), e]))
  const newMap = new Map<string, { categoryName: string; item: NormalizedPricingItem }>()

  for (const cat of categories) {
    for (const row of cat.items) {
      newMap.set(itemKey(cat.name, row.serviceName), { categoryName: cat.name, item: row })
    }
  }

  for (const [key, { categoryName, item: row }] of newMap) {
    const old = oldMap.get(key)
    if (!old) {
      changes.push({ categoryName, serviceName: row.serviceName, changeType: 'added', newPrice: row.price })
      continue
    }

    const priceChanged =
      old.price.trim() !== row.price.trim() ||
      (old.priceNumeric != null && row.priceNumeric != null && old.priceNumeric !== row.priceNumeric)

    if (priceChanged) {
      changes.push({
        categoryName,
        serviceName: row.serviceName,
        changeType: 'updated',
        oldPrice: old.price,
        newPrice: row.price,
        details: old.priceNumeric !== row.priceNumeric
          ? `Prix: ${old.priceNumeric ?? '—'} → ${row.priceNumeric ?? '—'}`
          : undefined
      })
    }
  }

  for (const [key, old] of oldMap) {
    if (!newMap.has(key)) {
      changes.push({
        categoryName: old.categoryName,
        serviceName: old.serviceName,
        changeType: 'removed',
        oldPrice: old.price
      })
    }
  }

  return changes
}

function buildChangeSummary(brand: string, changes: PricingChangeRecord[]): string {
  const label = brandLabel(brand)
  const added = changes.filter(c => c.changeType === 'added').length
  const updated = changes.filter(c => c.changeType === 'updated').length
  const removed = changes.filter(c => c.changeType === 'removed').length

  const lines = changes.slice(0, 12).map(c => {
    if (c.changeType === 'added') return `+ ${c.categoryName} — ${c.serviceName}: ${c.newPrice}`
    if (c.changeType === 'removed') return `− ${c.categoryName} — ${c.serviceName}: ${c.oldPrice}`
    return `↔ ${c.categoryName} — ${c.serviceName}: ${c.oldPrice} → ${c.newPrice}`
  })

  const more = changes.length > 12 ? `\n... et ${changes.length - 12} autre(s)` : ''
  return `[${label}] ${added} ajout(s), ${updated} modif., ${removed} retrait(s).\n${lines.join('\n')}${more}`
}

async function persistBrandPricing(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any,
  tenantId: string,
  brand: string,
  categories: NormalizedPricingCategory[],
  fileName: string,
  uploadedById: string,
  importBatchId: string
): Promise<BrandImportResult> {
  const existingRows = await tx.pricingItem.findMany({
    where: { tenantId, category: { brand } },
    include: { category: { select: { name: true } } }
  })

  const existing: ExistingItem[] = existingRows.map((r: {
    serviceName: string; price: string; priceNumeric: number | null; category: { name: string }
  }) => ({
    categoryName: r.category.name,
    serviceName: r.serviceName,
    price: r.price,
    priceNumeric: r.priceNumeric
  }))

  const changes = diffPricing(existing, categories)

  await tx.pricingItem.deleteMany({ where: { tenantId, category: { brand } } })
  await tx.pricingCategory.deleteMany({ where: { tenantId, brand } })

  let itemCount = 0
  for (let ci = 0; ci < categories.length; ci++) {
    const cat = categories[ci]
    const category = await tx.pricingCategory.create({
      data: {
        tenantId,
        brand,
        name: cat.name,
        sheetName: cat.sheetName,
        order: ci
      }
    })

    for (let ii = 0; ii < cat.items.length; ii++) {
      const row = cat.items[ii]
      await tx.pricingItem.create({
        data: {
          tenantId,
          categoryId: category.id,
          serviceName: row.serviceName,
          description: row.description,
          price: row.price,
          priceNumeric: row.priceNumeric,
          currency: row.currency || 'HTG',
          unit: row.unit,
          features: row.features || [],
          metadata: row.metadata || {},
          order: ii
        }
      })
      itemCount++
    }
  }

  const upload = await tx.pricingUpload.create({
    data: {
      tenantId,
      brand,
      fileName,
      uploadedById,
      itemCount,
      changeCount: changes.length,
      importBatchId
    }
  })

  if (changes.length > 0) {
    await tx.pricingChange.createMany({
      data: changes.map(c => ({
        tenantId,
        uploadId: upload.id,
        brand,
        categoryName: c.categoryName,
        serviceName: c.serviceName,
        changeType: c.changeType,
        oldPrice: c.oldPrice,
        newPrice: c.newPrice,
        details: c.details
      }))
    })

    await tx.pricingAlert.create({
      data: {
        tenantId,
        brand,
        uploadId: upload.id,
        summary: buildChangeSummary(brand, changes),
        isActive: true
      }
    })
  }

  return { brand, uploadId: upload.id, itemCount, changeCount: changes.length, changes }
}

export async function importPricingFromExcel(
  buffer: Buffer,
  fileName: string,
  uploadedById: string,
  filterBrand?: string
): Promise<ImportPricingResult> {
  const tenantId = getTenantId()
  const sheets = parseExcelSheets(buffer)
  if (sheets.length === 0) {
    throw new Error('Le fichier Excel est vide ou illisible')
  }

  const normalized = await normalizePricingWithAI(sheets, fileName, filterBrand)

  if (normalized.brands.length === 0) {
    throw new Error(
      filterBrand
        ? `Aucun tarif détecté pour ${brandLabel(filterBrand)}. Vérifiez le fichier.`
        : 'Aucun tarif détecté. Vérifiez que le fichier contient des grilles lisibles.'
    )
  }

  const batchId = randomUUID()
  const brandResults: BrandImportResult[] = []

  await prisma.$transaction(async tx => {
    for (const brandData of normalized.brands) {
      const result = await persistBrandPricing(
        tx,
        tenantId,
        brandData.brand,
        brandData.categories,
        fileName,
        uploadedById,
        batchId
      )
      brandResults.push(result)
    }
  })

  for (const result of brandResults) {
    if (result.changeCount > 0) {
      await NotificationService.broadcastPricingUpdate(result.brand, result.changes, result.uploadId)
    }
    logger.info(`Pricing import: ${result.brand} — ${result.itemCount} items, ${result.changeCount} changes`)
  }

  const totalItems = brandResults.reduce((n, r) => n + r.itemCount, 0)
  const totalChanges = brandResults.reduce((n, r) => n + r.changeCount, 0)

  return {
    batchId,
    fileName,
    brands: brandResults,
    totalItems,
    totalChanges
  }
}

export async function getPricingByBrand(brand?: string) {
  return prisma.pricingCategory.findMany({
    where: brand ? { brand } : undefined,
    orderBy: [{ brand: 'asc' }, { order: 'asc' }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: { order: 'asc' }
      }
    }
  })
}

export async function listPricingBrands() {
  const rows = await prisma.pricingCategory.groupBy({
    by: ['brand'],
    _count: { _all: true },
    orderBy: { brand: 'asc' }
  })
  return rows.map(r => ({ brand: r.brand, label: brandLabel(r.brand), categoryCount: r._count._all }))
}

export async function getActivePricingAlerts() {
  return prisma.pricingAlert.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      upload: {
        select: {
          id: true,
          fileName: true,
          changeCount: true,
          importBatchId: true,
          createdAt: true,
          uploadedBy: { select: { firstName: true, lastName: true } }
        }
      }
    }
  })
}

export async function getPricingUploadHistory(brand?: string) {
  return prisma.pricingUpload.findMany({
    where: brand ? { brand } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { changes: true } }
    }
  })
}

export async function getUploadChanges(uploadId: string) {
  return prisma.pricingChange.findMany({
    where: { uploadId },
    orderBy: { createdAt: 'asc' }
  })
}

export async function getBatchUploads(batchId: string) {
  return prisma.pricingUpload.findMany({
    where: { importBatchId: batchId },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      _count: { select: { changes: true } }
    }
  })
}
