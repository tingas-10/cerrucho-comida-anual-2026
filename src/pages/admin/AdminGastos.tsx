// Gastos: aprobar con beneficiarios, corregir con revisión, rechazar y confirmar transferencias.
import { useState } from 'react'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit } from '../../data/actions'
import { useCollection, useEdition, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import type { BeverageProfile, Expense, Rsvp, Settlement } from '../../data/types'
import { formatArs, parseArs, splitEqual } from '../../domain/expenses'
import { fmtDayShort } from '../../domain/format'
import { Button, Card, Field, Input, Modal, Notice, Pill } from '../../ui/components'
import { useToast } from '../../ui/toast'

export function AdminGastos() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { data: edition } = useEdition()
  const { rows: expenses } = useCollection<Expense>(P.expenses(slug))
  const { rows: settlements } = useCollection<Settlement>(P.settlements(slug))
  const { rows: rsvps } = useCollection<Rsvp>(P.rsvps(slug))
  const { rows: beverages } = useCollection<BeverageProfile>(P.beverages(slug))
  const [target, setTarget] = useState<Expense | null>(null)
  const [participants, setParticipants] = useState<string[]>([])
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const attendees = rsvps.filter((r) => r.status === 'YES' && r.planVersion === (edition?.planVersion ?? 1)).map((r) => r.id)
  const drinkers = beverages.filter((b) => !b.noAlcohol).map((b) => b.id)
  const joiners = rsvps.filter((r) => r.afterparty === 'JOIN').map((r) => r.id)

  function defaultParticipants(e: Expense): string[] {
    const base = attendees.length ? attendees : members.active.map((m) => m.id)
    if (e.category === 'ALCOHOL') return base.filter((id) => drinkers.includes(id))
    if (e.category === 'AFTERPARTY') return base.filter((id) => joiners.includes(id))
    return base
  }

  function openApprove(e: Expense) {
    setTarget(e)
    setParticipants(e.participants.length ? e.participants : defaultParticipants(e))
    setAmount(String(e.amountCents / 100))
    setNote('')
  }

  async function approve() {
    if (!target) return
    const cents = parseArs(amount)
    if (!cents || cents <= 0) {
      toast.error('Importe inválido.')
      return
    }
    if (participants.length === 0) {
      toast.error('Elegí al menos un beneficiario.')
      return
    }
    setBusy(true)
    try {
      const shares = splitEqual(cents, participants)
      const changedAmount = cents !== target.amountCents
      await db.updateDoc(P.expense(slug, target.id), {
        amountCents: cents,
        participants,
        shares,
        state: 'APPROVED',
        revision: target.revision + 1,
        history: [...target.history, { at: Date.now(), by: memberId, note: (changedAmount ? `Importe corregido de ${formatArs(target.amountCents)}. ` : '') + (note.trim() || 'Aprobado') }],
        updatedAt: Date.now(),
      })
      await logAudit(db, slug, memberId!, 'expense.approve', target.id, note.trim())
      setTarget(null)
      toast.ok('Gasto aprobado y repartido')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function reject(e: Expense) {
    try {
      await db.updateDoc(P.expense(slug, e.id), { state: 'REJECTED', revision: e.revision + 1, history: [...e.history, { at: Date.now(), by: memberId, note: 'Rechazado' }], updatedAt: Date.now() })
      await logAudit(db, slug, memberId!, 'expense.reject', e.id)
    } catch (err) {
      toast.error(errorText(err))
    }
  }

  const pending = expenses.filter((e) => e.state === 'PROPOSED')
  const approved = expenses.filter((e) => e.state === 'APPROVED').sort((a, b) => b.date - a.date)

  return (
    <div className="grid gap-4">
      <Card>
        <p className="h3 mb-2">Pendientes de aprobar</p>
        {pending.length === 0 ? <p className="small muted">Nada pendiente.</p> : null}
        {pending.map((e) => (
          <div key={e.id} className="row">
            <span className="small">
              <b>{e.concept}</b> · {formatArs(e.amountCents)} · pagó {members.aliasOf(e.payerId)} · {fmtDayShort(e.date)}
            </span>
            <span className="flex gap-1">
              <Button size="sm" onClick={() => openApprove(e)}>
                Aprobar
              </Button>
              <Button size="sm" variant="line" onClick={() => void reject(e)}>
                Rechazar
              </Button>
            </span>
          </div>
        ))}
      </Card>
      <Card>
        <p className="h3 mb-2">Aprobados</p>
        {approved.length === 0 ? <p className="small muted">Todavía nada.</p> : null}
        {approved.map((e) => (
          <div key={e.id} className="row items-start">
            <span className="small">
              <b>{e.concept}</b> · {formatArs(e.amountCents)} · pagó {members.aliasOf(e.payerId)} · entre {e.participants.length}
              <span className="block tiny muted">{e.history.map((h) => h.note).join(' → ')}</span>
            </span>
            <Button size="sm" variant="line" onClick={() => openApprove(e)}>
              Corregir
            </Button>
          </div>
        ))}
      </Card>
      <Card>
        <p className="h3 mb-2">Transferencias</p>
        {settlements.length === 0 ? <p className="small muted">Ninguna registrada.</p> : null}
        {settlements.map((s) => (
          <div key={s.id} className="row">
            <span className="small">
              {members.aliasOf(s.fromId)} → {members.aliasOf(s.toId)} · {formatArs(s.amountCents)}
            </span>
            {s.state === 'CONFIRMED' ? (
              <Pill tone="ok">Confirmada</Pill>
            ) : (
              <Button size="sm" variant="line" onClick={() => void db.updateDoc(P.settlement(slug, s.id), { state: 'CONFIRMED' })}>
                Confirmar
              </Button>
            )}
          </div>
        ))}
      </Card>

      <Modal open={!!target} onClose={() => setTarget(null)} title={target?.state === 'APPROVED' ? 'Corregir gasto' : 'Aprobar gasto'}>
        {target ? (
          <>
            <p className="small mb-3">
              <b>{target.concept}</b> · pagó {members.aliasOf(target.payerId)}
            </p>
            <Field label="Importe (ARS)" id="ap-amount">
              <Input id="ap-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <p className="label">Beneficiarios ({participants.length})</p>
            <p className="tiny muted mb-2">
              Default por rubro: comida y comunes entre asistentes; alcohol entre quienes toman; salida entre quienes se suman. Quien no toma no comparte alcohol salvo que lo marques.
            </p>
            <div className="grid grid-cols-2 gap-1 mb-3 max-h-60 overflow-y-auto">
              {members.active.map((m) => (
                <label key={m.id} className="flex items-center gap-2 small py-1">
                  <input type="checkbox" checked={participants.includes(m.id)} onChange={(e) => setParticipants((p) => (e.target.checked ? [...p, m.id] : p.filter((x) => x !== m.id)))} />
                  {m.alias}
                </label>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <Button size="sm" variant="line" onClick={() => setParticipants(defaultParticipants(target))}>
                Default del rubro
              </Button>
              <Button size="sm" variant="line" onClick={() => setParticipants(members.active.map((m) => m.id))}>
                Todos
              </Button>
            </div>
            {target.state === 'APPROVED' ? (
              <Field label="Motivo de la corrección" id="ap-note">
                <Input id="ap-note" value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            ) : null}
            {parseArs(amount) ? (
              <Notice>
                Cada uno: {formatArs(Math.floor((parseArs(amount) ?? 0) / Math.max(1, participants.length)))} aprox. Los centavos sobrantes se reparten por orden estable.
              </Notice>
            ) : null}
            <Button variant="gold" className="mt-3" onClick={() => void approve()} loading={busy} disabled={target.state === 'APPROVED' && !note.trim()}>
              {target.state === 'APPROVED' ? 'Guardar corrección' : 'Aprobar y repartir'}
            </Button>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
