// Encuesta logística (aprobación múltiple o voto único) con recuento visible.
import { useEffect, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDoc, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Poll, PollResponse } from '../data/types'
import { fmtDateTime, timeLeft } from '../domain/format'
import { isPollOpen, participation, tallyApproval, tallySingle, validateResponse } from '../domain/polls'
import { Button, Card, Pill } from './components'
import { useToast } from './toast'

export async function saveResponse(
  db: ReturnType<typeof useSession>['db'],
  slug: string,
  poll: Poll,
  memberId: string,
  payload: PollResponse['payload'],
  expectedRevision: number,
) {
  const err = validateResponse(poll, payload)
  if (err) throw new DataError('VALIDATION_ERROR', err)
  if (!isPollOpen(poll, Date.now())) throw new DataError('POLL_CLOSED', 'La consulta ya cerró.')
  if (!poll.electorate.includes(memberId)) throw new DataError('ACCESS_DENIED', 'No sos elector de esta consulta.')
  await db.runTransaction(async (tx) => {
    const cur = await tx.get<PollResponse>(P.response(slug, poll.id, memberId))
    const rev = cur?.revision ?? 0
    if (rev !== expectedRevision) throw new DataError('REVISION_CONFLICT')
    tx.set(P.response(slug, poll.id, memberId), { payload, revision: rev + 1, updatedAt: Date.now() })
  })
}

export function PollCard({ poll, aliasOf, hideCounts }: { poll: Poll; aliasOf?: (id: string) => string; hideCounts?: boolean }) {
  const { db, slug, memberId, isAdmin } = useSession()
  const toast = useToast()
  const now = useNow()
  const mine = useDoc<PollResponse>(memberId ? P.response(slug, poll.id, memberId) : null)
  const { rows: responses } = useCollection<PollResponse>(P.responses(slug, poll.id))
  const [sel, setSel] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (dirty) return
    const p = mine.data?.payload
    if (Array.isArray(p)) setSel(p)
    else if (typeof p === 'string') setSel([p])
    else setSel([])
  }, [mine.data, dirty])

  const open = isPollOpen(poll, now)
  const isElector = !!memberId && poll.electorate.includes(memberId)
  const counts = poll.method === 'APPROVAL' ? tallyApproval(poll, responses) : tallySingle(poll, responses)
  const part = participation(poll, responses.length)
  const showCounts = !hideCounts
  const max = Math.max(1, ...Object.values(counts))

  function toggle(id: string) {
    setDirty(true)
    if (poll.method === 'SINGLE') setSel([id])
    else setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }

  async function save() {
    if (!memberId) return
    setBusy(true)
    try {
      await saveResponse(db, slug, poll, memberId, poll.method === 'SINGLE' ? sel[0] : sel, mine.data?.revision ?? 0)
      setDirty(false)
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="h3">{poll.title}</p>
          {poll.description ? <p className="small muted mt-1">{poll.description}</p> : null}
        </div>
        {poll.state === 'OPEN' ? <Pill tone={open ? 'accent' : 'muted'}>{open ? timeLeft(poll.closeAt, now) : 'Cerró'}</Pill> : null}
        {poll.state === 'CLOSED' ? <Pill tone="muted">Cerrada</Pill> : null}
        {poll.state === 'DRAFT' ? <Pill tone="muted">Borrador</Pill> : null}
      </div>
      <p className="tiny muted mb-3">
        {poll.method === 'APPROVAL' ? 'Podés marcar todas las opciones que te sirvan.' : 'Elegí una sola opción.'}
        {poll.closeAt ? ` Cierra ${fmtDateTime(poll.closeAt)}.` : ''}
      </p>
      <div className="grid gap-2" role={poll.method === 'SINGLE' ? 'radiogroup' : 'group'} aria-label={poll.title}>
        {poll.options.map((o) => {
          const chosen = sel.includes(o.id)
          const n = counts[o.id] ?? 0
          return (
            <button
              key={o.id}
              type="button"
              className="choice flex-col items-stretch"
              role={poll.method === 'SINGLE' ? 'radio' : 'checkbox'}
              aria-checked={chosen}
              disabled={!open || !isElector}
              onClick={() => toggle(o.id)}
            >
              <span className="flex justify-between gap-2">
                <span>
                  {o.label}
                  {o.detail ? <span className="block tiny muted font-normal">{o.detail}</span> : null}
                </span>
                {showCounts ? (
                  <span className="tiny muted whitespace-nowrap">
                    {n} {poll.method === 'APPROVAL' ? `de ${poll.electorate.length}` : ''}
                  </span>
                ) : null}
              </span>
              {showCounts ? (
                <span className="bar mt-2" aria-hidden>
                  <span style={{ width: `${(n / max) * 100}%` }} />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
        <p className="tiny muted">
          Respondieron {responses.length} de {poll.electorate.length}
          {poll.quorumPct ? ` · quórum ${poll.quorumPct}% ${part.quorumMet ? 'alcanzado' : 'pendiente'}` : ''}
        </p>
        {open && isElector ? (
          <Button variant="gold" onClick={() => void save()} loading={busy} disabled={!dirty && !!mine.data}>
            {mine.data ? (dirty ? 'Guardar cambios' : 'Ya votaste') : 'Guardar'}
          </Button>
        ) : null}
        {open && !isElector && memberId ? <span className="tiny muted">No estás en el padrón de esta consulta.</span> : null}
      </div>
      {poll.decision && aliasOf ? (
        <p className="small mt-3">
          <b>Decisión oficial:</b> {poll.options.find((o) => o.id === poll.decision!.optionId)?.label ?? '—'} · confirmó {aliasOf(poll.decision.by)}
          {poll.decision.reason ? ` · ${poll.decision.reason}` : ''}
        </p>
      ) : null}
      {isAdmin && poll.state === 'OPEN' && !open ? <p className="tiny text-warn mt-2">Venció el plazo. Cerrala desde Administración.</p> : null}
    </Card>
  )
}
