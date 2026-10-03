// Gastos: proponer lo que pagué, ver saldos y transferencias sugeridas.
import { useMemo, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useCollection, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Expense, Settlement } from '../data/types'
import { computeBalances, formatArs, parseArs, suggestTransfers } from '../domain/expenses'
import { fmtDayShort } from '../domain/format'
import { Avatar, Button, Card, Field, Input, Loading, Notice, PageHeader, Pill, Section } from '../ui/components'
import { useToast } from '../ui/toast'

const CATEGORIES: Array<{ value: Expense['category']; label: string }> = [
  { value: 'FOOD', label: 'Comida' },
  { value: 'ALCOHOL', label: 'Alcohol' },
  { value: 'COMMON', label: 'Gastos comunes' },
  { value: 'AFTERPARTY', label: 'Salida' },
  { value: 'OTHER', label: 'Otro' },
]

export function Gastos() {
  const { db, slug, memberId, isAdmin } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { rows: expenses, loading } = useCollection<Expense>(P.expenses(slug))
  const { rows: settlements } = useCollection<Settlement>(P.settlements(slug))
  const [concept, setConcept] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<Expense['category']>('FOOD')
  const [busy, setBusy] = useState(false)
  const [toId, setToId] = useState('')
  const [transfer, setTransfer] = useState('')

  const balances = useMemo(() => computeBalances(expenses, settlements, members.active.map((m) => m.id)), [expenses, settlements, members.active])
  const suggestions = useMemo(() => suggestTransfers(balances), [balances])
  const mine = balances.find((b) => b.memberId === memberId)

  async function propose() {
    const cents = parseArs(amount)
    if (!memberId || !cents || cents <= 0 || concept.trim().length < 2) {
      toast.error('Completá concepto e importe.')
      return
    }
    setBusy(true)
    try {
      const id = db.newId()
      const e: Expense = { id, concept: concept.trim(), payerId: memberId, amountCents: cents, category, date: Date.now(), participants: [], shares: {}, state: 'PROPOSED', revision: 1, history: [{ at: Date.now(), by: memberId, note: 'Propuesto' }], createdAt: Date.now(), updatedAt: Date.now() }
      await db.setDoc(P.expense(slug, id), e)
      setConcept('')
      setAmount('')
      toast.ok('Gasto propuesto. Agus lo aprueba y lo reparte.')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function proposeTransfer() {
    const cents = parseArs(transfer)
    if (!memberId || !toId || !cents || cents <= 0) {
      toast.error('Elegí a quién y cuánto.')
      return
    }
    setBusy(true)
    try {
      const id = db.newId()
      await db.setDoc<Settlement>(P.settlement(slug, id), { id, fromId: memberId, toId, amountCents: cents, state: 'PROPOSED', createdAt: Date.now() })
      setTransfer('')
      toast.ok('Transferencia registrada. La confirma quien la recibe o Agus.')
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmSettlement(s: Settlement) {
    try {
      await db.updateDoc(P.settlement(slug, s.id), { state: 'CONFIRMED' })
      toast.ok('Confirmada')
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  if (loading) return <Loading />
  const approved = expenses.filter((e) => e.state === 'APPROVED').sort((a, b) => b.date - a.date)
  const myProposed = expenses.filter((e) => e.payerId === memberId && e.state !== 'APPROVED')

  return (
    <div>
      <PageHeader eyebrow="Organización" title="Gastos" intro="Proponé lo que pagaste; Agus lo aprueba y lo reparte entre quienes corresponda. El regalo individual no entra acá." />

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Card>
          <p className="tiny muted">Pagué</p>
          <p className="text-2xl font-extrabold">{formatArs(mine?.paid ?? 0)}</p>
        </Card>
        <Card>
          <p className="tiny muted">Me corresponde</p>
          <p className="text-2xl font-extrabold">{formatArs(mine?.owed ?? 0)}</p>
        </Card>
        <Card>
          <p className="tiny muted">Mi saldo</p>
          <p className={`text-2xl font-extrabold ${(mine?.net ?? 0) > 0 ? 'text-ok' : (mine?.net ?? 0) < 0 ? 'text-danger' : ''}`}>{formatArs(mine?.net ?? 0)}</p>
          <p className="tiny muted">{(mine?.net ?? 0) > 0 ? 'te deben' : (mine?.net ?? 0) < 0 ? 'debés' : 'estás a mano'}</p>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <p className="h3 mb-2">Pagué algo</p>
          <Field label="Concepto" id="exp-concept">
            <Input id="exp-concept" value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={80} placeholder="ej. Hielo y carbón" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importe (ARS)" id="exp-amount">
              <Input id="exp-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="ej. 12.500" />
            </Field>
            <Field label="Rubro" id="exp-cat">
              <select id="exp-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as Expense['category'])}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Button onClick={() => void propose()} loading={busy}>
            Proponer gasto
          </Button>
          {myProposed.length ? (
            <div className="mt-3">
              {myProposed.map((e) => (
                <div key={e.id} className="row">
                  <span className="small">
                    {e.concept} · {formatArs(e.amountCents)}
                  </span>
                  <Pill tone={e.state === 'REJECTED' ? 'danger' : 'warn'}>{e.state === 'REJECTED' ? 'Rechazado' : 'Pendiente'}</Pill>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
        <Card>
          <p className="h3 mb-2">Transferí plata</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="A quién" id="tr-to">
              <select id="tr-to" className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
                <option value="">Elegí</option>
                {members.active.filter((m) => m.id !== memberId).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.alias}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cuánto (ARS)" id="tr-amount">
              <Input id="tr-amount" inputMode="decimal" value={transfer} onChange={(e) => setTransfer(e.target.value)} />
            </Field>
          </div>
          <Button onClick={() => void proposeTransfer()} loading={busy}>
            Registrar transferencia
          </Button>
          {settlements.filter((s) => s.toId === memberId && s.state === 'PROPOSED').map((s) => (
            <div key={s.id} className="row">
              <span className="small">
                {members.aliasOf(s.fromId)} dice que te transfirió {formatArs(s.amountCents)}
              </span>
              <Button size="sm" variant="gold" onClick={() => void confirmSettlement(s)}>
                Lo recibí
              </Button>
            </div>
          ))}
        </Card>
      </div>

      {suggestions.length ? (
        <Section title="Para cerrar cuentas">
          <Card>
            <p className="tiny muted mb-2">Sugerencia para que todos queden a mano (no es necesariamente el mínimo de transferencias).</p>
            {suggestions.map((s, i) => (
              <div key={i} className={`row ${s.fromId === memberId || s.toId === memberId ? 'font-semibold' : ''}`}>
                <span className="small">
                  {members.aliasOf(s.fromId)} → {members.aliasOf(s.toId)}
                </span>
                <span>{formatArs(s.amountCents)}</span>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="Gastos aprobados">
        {approved.length === 0 ? <Notice>Todavía no hay gastos aprobados.</Notice> : null}
        {approved.length ? (
          <Card>
            {approved.map((e) => (
              <div key={e.id} className="row items-start">
                <div className="small">
                  <p className="font-semibold">
                    {e.concept} <span className="tiny muted font-normal">· {CATEGORIES.find((c) => c.value === e.category)?.label}</span>
                  </p>
                  <p className="tiny muted">
                    Pagó {members.aliasOf(e.payerId)} · {fmtDayShort(e.date)} · entre {e.participants.length}
                    {e.participants.includes(memberId ?? '') ? ` · te toca ${formatArs(e.shares[memberId ?? ''] ?? 0)}` : ''}
                  </p>
                </div>
                <b>{formatArs(e.amountCents)}</b>
              </div>
            ))}
          </Card>
        ) : null}
      </Section>

      <Section title="Saldos">
        <Card>
          {balances
            .filter((b) => b.paid || b.owed || b.transferredIn || b.transferredOut)
            .map((b) => (
              <div key={b.memberId} className="row">
                <span className="inline-flex items-center gap-2 small">
                  <Avatar id={b.memberId} alias={members.aliasOf(b.memberId)} size={24} color={members.byId[b.memberId]?.avatarColor} />
                  {members.aliasOf(b.memberId)}
                </span>
                <span className={`font-semibold ${b.net > 0 ? 'text-ok' : b.net < 0 ? 'text-danger' : ''}`}>{formatArs(b.net)}</span>
              </div>
            ))}
          {balances.every((b) => !b.paid && !b.owed) ? <p className="small muted">Sin movimientos todavía.</p> : null}
          {isAdmin ? <p className="tiny muted mt-2">Aprobás y repartís gastos desde Administración &gt; Gastos.</p> : null}
        </Card>
      </Section>
    </div>
  )
}
