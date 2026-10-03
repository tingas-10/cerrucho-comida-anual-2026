import { describe, expect, it } from 'vitest'
import cases from '../../docs/spec/06_Casos_reglas.json'
import {
  AGUA_ML_POR_ASISTENTE,
  HIELO_G_POR_ASISTENTE,
  INGREDIENTES,
  RECETAS,
  RESERVA_COMPRA_PCT,
} from '../content/bebidas'
import type { BeverageProfile, BeverageSettings } from '../data/types'
import { computePurchases, summarize, validateProfile } from './beverages'

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

function profile(portions: number, pct: Record<string, number>, noAlcohol = false): BeverageProfile {
  return { portions, noAlcohol, pct: { fernet: 0, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0, ...pct }, revision: 1, updatedAt: 0 }
}

describe('bebidas · validación', () => {
  it('rechaza 99 y 101', () => {
    expect(validateProfile({ portions: 4, noAlcohol: false, pct: { fernet: 99, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 } })).toMatch(/faltan 1/)
    expect(validateProfile({ portions: 4, noAlcohol: false, pct: { fernet: 51, cerveza: 50, gin: 0, vodka: 0, vino: 0, aperol: 0 } })).toMatch(/pasaste por 1/)
  })
  it('rechaza negativos y porciones fuera de rango', () => {
    expect(validateProfile({ portions: 4, noAlcohol: false, pct: { fernet: 110, cerveza: -10, gin: 0, vodka: 0, vino: 0, aperol: 0 } })).not.toBeNull()
    expect(validateProfile({ portions: 0, noAlcohol: false, pct: { fernet: 100, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 } })).not.toBeNull()
    expect(validateProfile({ portions: 21, noAlcohol: false, pct: { fernet: 100, cerveza: 0, gin: 0, vodka: 0, vino: 0, aperol: 0 } })).not.toBeNull()
  })
  it('no tomo alcohol es respuesta completa', () => {
    expect(validateProfile({ portions: 0, noAlcohol: true, pct: {} })).toBeNull()
  })
})

describe('bebidas · compras', () => {
  const c = cases.beverage_cases[0]
  it(c.id, () => {
    const profiles = c.profiles.map((p) => profile(p.portions, { fernet: p.fernet_pct, cerveza: p.beer_pct }))
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
  it('ponderado por porciones: 1 porción vs 10', () => {
    const s = summarize([profile(1, { fernet: 100 }), profile(10, { cerveza: 100 })])
    expect(s.share.cerveza).toBeCloseTo(90.9, 0)
    expect(s.share.fernet).toBeCloseTo(9.1, 0)
  })
  it('todos no toman: sin división por cero, agua e hielo por asistente', () => {
    const r = computePurchases(settings(), [profile(0, {}, true), profile(0, {}, true)], 2)
    const by = Object.fromEntries(r.lines.map((l) => [l.ingredientId, l]))
    expect(by.agua.units).toBe(Math.ceil((2 * AGUA_ML_POR_ASISTENTE) / 1500))
    expect(by.hielo.units).toBe(1)
    expect(by.fernet).toBeUndefined()
  })
  it('stock mayor que la necesidad compra cero, nunca negativo', () => {
    const r = computePurchases(settings({ stock: { fernet: 3 } }), [profile(4, { fernet: 100 })], 1)
    const fernet = r.lines.find((l) => l.ingredientId === 'fernet')!
    expect(fernet.units).toBe(0)
    expect(fernet.pendingAmount).toBe(0)
  })
  it('faltan precios: total parcial identificado', () => {
    const r = computePurchases(settings({ prices: { fernet: 1500000 } }), [profile(4, { fernet: 50, cerveza: 50 })], 1)
    expect(r.pricesMissing).toBe(true)
    expect(r.totalCents).toBe(1500000)
  })
})
