// Reglas puras de gastos: reparto en centavos, saldos y transferencias sugeridas.
import type { Expense, Settlement } from '../data/types'

/** Reparte A centavos entre n beneficiarios; el resto va de a 1 centavo a los primeros por id. */
export function splitEqual(amountCents: number, beneficiaries: string[]): Record<string, number> {
  if (beneficiaries.length === 0) throw new Error('Sin beneficiarios')
  if (new Set(beneficiaries).size !== beneficiaries.length) throw new Error('Beneficiarios duplicados')
  const sorted = [...beneficiaries].sort()
  const sign = amountCents < 0 ? -1 : 1
  const abs = Math.abs(Math.round(amountCents))
  const base = Math.floor(abs / sorted.length)
  const rest = abs - base * sorted.length
  const out: Record<string, number> = {}
  sorted.forEach((id, i) => {
    out[id] = sign * (base + (i < rest ? 1 : 0))
  })
  return out
}

export interface Balance {
  memberId: string
  paid: number
  owed: number
  transferredOut: number
  transferredIn: number
  net: number // positivo: debe recibir
}

export function computeBalances(expenses: Expense[], settlements: Settlement[], memberIds: string[]): Balance[] {
  const map = new Map<string, Balance>()
  const get = (id: string) => {
    if (!map.has(id)) map.set(id, { memberId: id, paid: 0, owed: 0, transferredOut: 0, transferredIn: 0, net: 0 })
    return map.get(id)!
  }
  for (const id of memberIds) get(id)
  for (const e of expenses) {
    if (e.state !== 'APPROVED') continue
    get(e.payerId).paid += e.amountCents
    for (const [id, cents] of Object.entries(e.shares)) get(id).owed += cents
  }
  for (const s of settlements) {
    if (s.state !== 'CONFIRMED') continue
    get(s.fromId).transferredOut += s.amountCents
    get(s.toId).transferredIn += s.amountCents
  }
  for (const b of map.values()) b.net = b.paid - b.owed + b.transferredOut - b.transferredIn
  return Array.from(map.values()).sort((a, b) => a.memberId.localeCompare(b.memberId))
}

export interface SuggestedTransfer {
  fromId: string
  toId: string
  amountCents: number
}

/** Empareja deudores y acreedores por saldo absoluto descendente. Reproducible, no mínimo garantizado. */
export function suggestTransfers(balances: Balance[]): SuggestedTransfer[] {
  const debtors = balances
    .filter((b) => b.net < 0)
    .map((b) => ({ id: b.memberId, amount: -b.net }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
  const creditors = balances
    .filter((b) => b.net > 0)
    .map((b) => ({ id: b.memberId, amount: b.net }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id))
  const out: SuggestedTransfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(d.amount, c.amount)
    if (amount > 0) out.push({ fromId: d.id, toId: c.id, amountCents: amount })
    d.amount -= amount
    c.amount -= amount
    if (d.amount === 0) i++
    if (c.amount === 0) j++
  }
  return out
}

export function formatArs(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const pesos = Math.floor(abs / 100)
  const rest = abs % 100
  const pesosStr = pesos.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}$ ${pesosStr}${rest ? ',' + rest.toString().padStart(2, '0') : ''}`
}

export function parseArs(input: string): number | null {
  const clean = input.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (!clean) return null
  const n = Number(clean)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100)
}
