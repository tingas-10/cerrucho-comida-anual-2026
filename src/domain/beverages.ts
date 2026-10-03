// Reglas puras de bebidas: validación del perfil, reparto grupal y lista de compras.
import { BEBIDAS, PORCIONES_MAX, PORCIONES_MIN, type BebidaKey } from '../content/bebidas'
import type { BeverageProfile, BeverageSettings } from '../data/types'

export interface ProfileInput {
  portions: number
  noAlcohol: boolean
  pct: Record<string, number>
}

export function emptyPct(): Record<BebidaKey, number> {
  return { fernet: 0, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 }
}

export function pctTotal(pct: Record<string, number>): number {
  return BEBIDAS.reduce((a, k) => a + (Number(pct[k]) || 0), 0)
}

/** Devuelve null si es válido, o el mensaje de error. */
export function validateProfile(p: ProfileInput): string | null {
  if (p.noAlcohol) return null
  if (!Number.isInteger(p.portions) || p.portions < PORCIONES_MIN || p.portions > PORCIONES_MAX)
    return `Las porciones tienen que ser un entero entre ${PORCIONES_MIN} y ${PORCIONES_MAX}.`
  for (const k of BEBIDAS) {
    const v = p.pct[k]
    if (!Number.isInteger(v) || v < 0 || v > 100) return 'Cada porcentaje tiene que ser un entero entre 0 y 100.'
  }
  const extra = Object.keys(p.pct).filter((k) => !(BEBIDAS as readonly string[]).includes(k))
  if (extra.length) return 'Hay bebidas que no corresponden.'
  const total = pctTotal(p.pct)
  if (total < 100) return `Te faltan ${100 - total} puntos.`
  if (total > 100) return `Te pasaste por ${total - 100}.`
  return null
}

/** Porciones por bebida de un perfil. */
export function servingsOf(p: ProfileInput): Record<BebidaKey, number> {
  const out = emptyPct()
  if (p.noAlcohol) return out
  for (const k of BEBIDAS) out[k] = (p.portions * (p.pct[k] ?? 0)) / 100
  return out
}

export interface GroupSummary {
  servings: Record<BebidaKey, number>
  totalServings: number
  share: Record<BebidaKey, number> // 0..100 ponderado por porciones
  responded: number
  drinkers: number
  nonDrinkers: number
}

export function summarize(profiles: ProfileInput[]): GroupSummary {
  const servings = emptyPct()
  let drinkers = 0
  let nonDrinkers = 0
  for (const p of profiles) {
    if (p.noAlcohol) {
      nonDrinkers++
      continue
    }
    drinkers++
    const s = servingsOf(p)
    for (const k of BEBIDAS) servings[k] += s[k]
  }
  const totalServings = BEBIDAS.reduce((a, k) => a + servings[k], 0)
  const share = emptyPct()
  if (totalServings > 0) for (const k of BEBIDAS) share[k] = Math.round((servings[k] / totalServings) * 1000) / 10
  return { servings, totalServings, share, responded: profiles.length, drinkers, nonDrinkers }
}

export interface PurchaseLine {
  ingredientId: string
  label: string
  unit: 'ml' | 'g'
  rawAmount: number // sin reserva
  protectedAmount: number // con reserva
  stockUnits: number
  stockAmount: number
  pendingAmount: number
  units: number // envases a comprar
  packs: number | null // packs a comprar si se vende por pack
  packUnits: number | null
  envaseLabel: string
  priceCents: number | null
  totalCents: number | null
  bought: boolean
  responsibleId: string | null
  assumption?: string
}

export interface PurchaseResult {
  lines: PurchaseLine[]
  attendees: number
  responses: number
  totalCents: number
  pricesMissing: boolean
}

/**
 * Lista de compras: suma ingredientes de todos los asistentes con respuesta,
 * aplica reserva, resta stock una sola vez y redondea hacia arriba por envase.
 * `pendingScenario` agrega asistentes sin respuesta con el promedio del grupo (default 0).
 */
export function computePurchases(
  settings: BeverageSettings,
  profiles: BeverageProfile[],
  attendees: number,
): PurchaseResult {
  const reserve = 1 + settings.reservePct / 100
  const amounts: Record<string, number> = {}
  const add = (id: string, ml: number) => {
    amounts[id] = (amounts[id] ?? 0) + ml
  }
  const summary = summarize(profiles)
  const pending = Math.max(0, settings.pendingScenario || 0)
  const scale = profiles.length > 0 && pending > 0 ? (profiles.length + pending) / profiles.length : 1
  for (const k of BEBIDAS) {
    const servings = summary.servings[k] * scale
    if (servings <= 0) continue
    const recipe = settings.recipes[k] ?? {}
    for (const [ing, ml] of Object.entries(recipe)) add(ing, servings * ml)
  }
  if (attendees > 0) {
    add('agua', attendees * settings.waterMlPerAttendee)
    add('hielo', attendees * settings.iceGPerAttendee)
  }
  const lines: PurchaseLine[] = []
  let totalCents = 0
  let pricesMissing = false
  for (const ing of settings.ingredients) {
    const raw = amounts[ing.id] ?? 0
    if (raw <= 0 && !(settings.stock[ing.id] > 0)) continue
    const isAssumption = ing.id === 'agua' || ing.id === 'hielo'
    const protectedAmount = isAssumption ? raw : raw * reserve
    const stockUnits = settings.stock[ing.id] ?? 0
    const stockAmount = stockUnits * ing.envaseMl
    const pendingAmount = Math.max(0, protectedAmount - stockAmount)
    const units = pendingAmount > 0 ? Math.ceil(pendingAmount / ing.envaseMl) : 0
    const packs = ing.packUnidades ? (pendingAmount > 0 ? Math.ceil(pendingAmount / (ing.envaseMl * ing.packUnidades)) : 0) : null
    const price = settings.prices[ing.id]
    const priceCents = typeof price === 'number' && price > 0 ? price : null
    const buyUnits = packs !== null && ing.packUnidades ? packs * ing.packUnidades : units
    const lineTotal = priceCents !== null ? priceCents * buyUnits : null
    if (lineTotal !== null) totalCents += lineTotal
    else if (buyUnits > 0) pricesMissing = true
    lines.push({
      ingredientId: ing.id,
      label: ing.label,
      unit: ing.unidad,
      rawAmount: raw,
      protectedAmount,
      stockUnits,
      stockAmount,
      pendingAmount,
      units,
      packs,
      packUnits: ing.packUnidades ?? null,
      envaseLabel: ing.envaseLabel,
      priceCents,
      totalCents: lineTotal,
      bought: settings.bought?.[ing.id] ?? false,
      responsibleId: settings.responsible?.[ing.id] ?? null,
      assumption: isAssumption ? 'Supuesto de compra por asistente' : undefined,
    })
  }
  return { lines, attendees, responses: profiles.length, totalCents, pricesMissing }
}

export function formatAmount(ml: number, unit: 'ml' | 'g'): string {
  if (unit === 'g') return ml >= 1000 ? `${(ml / 1000).toFixed(1).replace('.0', '')} kg` : `${Math.round(ml)} g`
  return ml >= 1000 ? `${(ml / 1000).toFixed(1).replace('.0', '')} L` : `${Math.round(ml)} ml`
}
