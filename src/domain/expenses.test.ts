import { describe, expect, it } from 'vitest'
import cases from '../../docs/spec/06_Casos_reglas.json'
import type { Expense, Settlement } from '../data/types'
import { computeBalances, formatArs, parseArs, splitEqual, suggestTransfers } from './expenses'

describe('gastos · reparto', () => {
  for (const c of cases.expense_cases) {
    it(`reparte ${c.amount_cents} entre ${c.beneficiaries_sorted.length}`, () => {
      const shares = splitEqual(c.amount_cents, c.beneficiaries_sorted)
      expect(c.beneficiaries_sorted.map((id) => shares[id])).toEqual(c.expected_shares_cents)
      expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(c.amount_cents)
    })
  }
  it('rechaza sin beneficiarios y duplicados', () => {
    expect(() => splitEqual(100, [])).toThrow()
    expect(() => splitEqual(100, ['A', 'A'])).toThrow()
  })
})

describe('gastos · saldos', () => {
  const exp = (id: string, payer: string, amount: number, parts: string[], state: Expense['state'] = 'APPROVED'): Expense => ({
    id,
    concept: id,
    payerId: payer,
    amountCents: amount,
    category: 'COMMON',
    date: 0,
    participants: parts,
    shares: splitEqual(amount, parts),
    state,
    revision: 1,
    history: [],
    createdAt: 0,
    updatedAt: 0,
  })
  it('suma cero y sólo cuenta aprobados', () => {
    const balances = computeBalances([exp('e1', 'A', 100000, ['A', 'B', 'C']), exp('e2', 'B', 50000, ['A', 'B'], 'PROPOSED')], [], ['A', 'B', 'C'])
    const total = balances.reduce((a, b) => a + b.net, 0)
    expect(total).toBe(0)
    expect(balances.find((b) => b.memberId === 'A')!.net).toBe(100000 - 33334)
  })
  it('las transferencias confirmadas ajustan saldos', () => {
    const settlements: Settlement[] = [{ id: 's1', fromId: 'B', toId: 'A', amountCents: 33333, state: 'CONFIRMED', createdAt: 0 }]
    const balances = computeBalances([exp('e1', 'A', 100000, ['A', 'B', 'C'])], settlements, ['A', 'B', 'C'])
    expect(balances.find((b) => b.memberId === 'B')!.net).toBe(0)
    expect(balances.reduce((a, b) => a + b.net, 0)).toBe(0)
  })
  it('sugiere transferencias que cubren los saldos', () => {
    const balances = computeBalances([exp('e1', 'A', 100000, ['A', 'B', 'C'])], [], ['A', 'B', 'C'])
    const t = suggestTransfers(balances)
    expect(t.reduce((a, b) => a + b.amountCents, 0)).toBe(66666)
    expect(t.every((x) => x.toId === 'A')).toBe(true)
  })
})

describe('gastos · formato', () => {
  it('formatea ARS', () => {
    expect(formatArs(123456789)).toBe('$ 1.234.567,89')
    expect(formatArs(100000)).toBe('$ 1.000')
    expect(formatArs(-50)).toBe('-$ 0,50')
  })
  it('parsea ARS', () => {
    expect(parseArs('1.234,50')).toBe(123450)
    expect(parseArs('$ 1000')).toBe(100000)
    expect(parseArs('abc')).toBeNull()
  })
})
