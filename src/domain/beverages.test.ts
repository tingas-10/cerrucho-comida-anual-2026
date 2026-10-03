import { describe, expect, it } from 'vitest'
import cases from '../../docs/spec/06_Casos_reglas.json'
import { AGUA_ML_POR_ASISTENTE, HIELO_G_POR_ASISTENTE, INGREDIENTES, PORCIONES_AL_100, RECETAS, RESERVA_COMPRA_PCT, fraseNivel } from '../content/bebidas'
import type { BeverageProfile, BeverageSettings } from '../data/types'
import { computePurchases, portionsOf, summarize, validateProfile } from './beverages'

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

const full = (pct: Record<string, number>) => ({ fernet: 0, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0, ...pct })

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
  const c = cases.beverage_cases[0]
  it(c.id + ' (4 porciones = nivel 40)', () => {
    // El caso de la especificación usa 4 porciones por persona; con 100% = 10 porciones, eso es nivel 40.
    const level = (4 / PORCIONES_AL_100) * 100
    const profiles = c.profiles.map((p) => profile(level, { fernet: p.fernet_pct, cerveza: p.beer_pct }))
    const r = computePurchases(settings(), profiles, 2)
    const by = Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]))
    expect(by.fernet.rawAmount).toBeCloseTo(c.expected_raw_ml.fernet)
    expect(by.cola.rawAmount).toBeCloseTo(c.expected_raw_ml.cola)
    expect(by.cerveza.rawAmount).toBeCloseTo(c.expected_raw_ml.cerveza)
    expect(by.fernet.units).toBe(c.expected_purchase_units.fernet_750ml_bottle)
    expect(by.cola.units).toBe(c.expected_purchase_units.cola_2250ml_bottle)
    expect(by.cerveza.units).toBe(c.expected_purchase_units.beer_473ml_can)
    expect(by.cerveza.packs).toBe(c.expected_purchase_if_beer_pack_only)
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
