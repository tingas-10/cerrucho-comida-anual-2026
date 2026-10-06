import { describe, expect, it } from 'vitest'
import { AGUA_ML_POR_ASISTENTE, EXTRAS_FINOS, HIELO_G_POR_ASISTENTE, INGREDIENTES, RECETAS, RESERVA_COMPRA_PCT, fraseNivel } from '../content/bebidas'
import type { BeverageProfile, BeverageSettings } from '../data/types'
import { cleanPct, computePurchases, portionsOf, summarize, validateProfile } from './beverages'

function settings(over: Partial<BeverageSettings> = {}): BeverageSettings {
  return {
    recipes: RECETAS,
    ingredients: INGREDIENTES,
    reservePct: RESERVA_COMPRA_PCT,
    waterMlPerAttendee: AGUA_ML_POR_ASISTENTE,
    iceGPerAttendee: HIELO_G_POR_ASISTENTE,
    stock: {},
    prices: {},
    pendingScenario: 0,
    responsible: {},
    bought: {},
    state: 'OPEN',
    ...over,
  }
}

const full = (pct: Record<string, number>) => ({ fernet: 0, cerveza: 0, vino: 0, ...pct })

function profile(level: number, pct: Record<string, number>): BeverageProfile {
  return { level, portions: portionsOf(level), noAlcohol: level === 0, pct: full(pct), revision: 1, updatedAt: 0 }
}

describe('bebidas · validación', () => {
  it('rechaza 99 y 101', () => {
    expect(validateProfile({ level: 50, pct: full({ fernet: 99 }) })).toMatch(/faltan 1/)
    expect(validateProfile({ level: 50, pct: full({ fernet: 51, cerveza: 50 }) })).toMatch(/pasaste por 1/)
  })
  it('rechaza negativos y niveles fuera de la escala', () => {
    expect(validateProfile({ level: 50, pct: full({ fernet: 110, cerveza: -10 }) })).not.toBeNull()
    expect(validateProfile({ level: 55, pct: full({ fernet: 100 }) })).not.toBeNull()
    expect(validateProfile({ level: 110, pct: full({ fernet: 100 }) })).not.toBeNull()
  })
  it('nivel 0 (no toma) es respuesta completa sin porcentajes', () => {
    expect(validateProfile({ level: 0, pct: full({}) })).toBeNull()
  })
  it('frases por nivel', () => {
    expect(fraseNivel(0)).toMatch(/dewinne/)
    expect(fraseNivel(20)).toMatch(/chocli/)
    expect(fraseNivel(40)).toMatch(/yaggermaister/)
    expect(fraseNivel(60)).toMatch(/al medio/)
    expect(fraseNivel(90)).toMatch(/latas/)
    expect(fraseNivel(100)).toMatch(/zubel/)
  })
})

describe('bebidas · compras', () => {
  // Pedido de Agus (6/10/2026): alguien en 50% que reparte 50% fernet y 50% cerveza toma medio fernet
  // de 750 ml, 1,5 L de coca y 3 cervezas de ½ L. Con 50% vino, 0,5 L de vino.
  it('50% de nivel, mitad fernet y mitad cerveza', () => {
    const r = computePurchases(settings({ reservePct: 0 }), [profile(50, { fernet: 50, cerveza: 50 })], 0)
    const by = Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]))
    expect(by.fernet.rawAmount).toBeCloseTo(375)
    expect(by.cola.rawAmount).toBeCloseTo(1500)
    expect(by.cerveza.rawAmount).toBeCloseTo(1500)
    expect(by.cerveza.units).toBe(3)
  })
  it('50% de nivel, mitad vino', () => {
    const r = computePurchases(settings({ reservePct: 0 }), [profile(50, { vino: 50, fernet: 50 })], 0)
    expect(r.lines.find((l) => l.ingredientId === 'vino')!.rawAmount).toBeCloseTo(500)
  })
  it('la reserva se suma antes de redondear', () => {
    const r = computePurchases(settings(), [profile(50, { fernet: 50, cerveza: 50 })], 0)
    const fernet = r.lines.find((l) => l.ingredientId === 'fernet')!
    expect(fernet.protectedAmount).toBeCloseTo(412.5)
    expect(fernet.units).toBe(1)
  })
  it('gin y vermouth para los finos: fijos, sin reserva', () => {
    const r = computePurchases(settings({ extras: EXTRAS_FINOS }), [profile(50, { fernet: 100 })], 0)
    const by = Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]))
    expect(by.gin.units).toBe(1)
    expect(by.vermut.units).toBe(1)
    expect(by.gin.assumption).toMatch(/finos/)
  })
  it('respuestas viejas con gin o aperol en 0 se limpian', () => {
    expect(cleanPct({ fernet: 50, cerveza: 50, gin: 0, aperol: 0 })).toEqual({ fernet: 50, cerveza: 50, vino: 0 })
    expect(validateProfile({ level: 50, pct: cleanPct({ fernet: 50, cerveza: 50, gin: 0 }) })).toBeNull()
  })
  it('ponderado por nivel: 10% vs 100%', () => {
    const s = summarize([profile(10, { fernet: 100 }), profile(100, { cerveza: 100 })])
    expect(s.share.cerveza).toBeCloseTo(90.9, 0)
    expect(s.share.fernet).toBeCloseTo(9.1, 0)
  })
  it('todos en 0: sin división por cero, agua e hielo por asistente', () => {
    const r = computePurchases(settings(), [profile(0, {}), profile(0, {})], 2)
    const by = Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]))
    expect(by.agua.units).toBe(Math.ceil((2 * AGUA_ML_POR_ASISTENTE) / 1500))
    expect(by.hielo.units).toBe(1)
    expect(by.fernet).toBeUndefined()
  })
  it('stock mayor que la necesidad compra cero, nunca negativo', () => {
    const r = computePurchases(settings({ stock: { fernet: 3 } }), [profile(40, { fernet: 100 })], 1)
    const fernet = r.lines.find((l) => l.ingredientId === 'fernet')!
    expect(fernet.units).toBe(0)
    expect(fernet.pendingAmount).toBe(0)
  })
  it('faltan precios: total parcial identificado', () => {
    const r = computePurchases(settings({ prices: { fernet: 1500000 } }), [profile(40, { fernet: 50, cerveza: 50 })], 1)
    expect(r.pricesMissing).toBe(true)
    expect(r.totalCents).toBe(1500000)
  })
})
