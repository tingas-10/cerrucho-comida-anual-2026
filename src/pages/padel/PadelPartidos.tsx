// Pádel · Partidos: historial y armado de un partido nuevo.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PADEL, formatoLabel } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { PadelMatch } from '../../data/types'
import { formatPoints } from '../../domain/fmo'
import { fmtDayLong } from '../../domain/format'
import { playersOf, setsText, tally, winnerOf } from '../../domain/padel'
import { Button, Card, Empty, Loading, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers } from '../fmo/fmoShared'
import { PadelTabs, pairName, usePadelMatches } from './padelShared'

export function PadelPartidos() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading } = usePadelMatches()
  const players = useFmoPlayers()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!memberId) return
    setBusy(true)
    try {
      const id = db.newId()
      const now = Date.now()
      const m: PadelMatch = { id, playedAt: now, bestOf: PADEL.formatoDefault, pairA: ['', ''], pairB: ['', ''], sets: [{ a: 0, b: 0 }], status: 'DRAFT', notes: '', createdBy: memberId, updatedBy: memberId, createdAt: now, updatedAt: now, revision: 1 }
      await db.setDoc(P.padelMatch(id), m)
      navigate(`/padel/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading || players.loading) return <Loading />
  const drafts = rows.filter((m) => m.status === 'DRAFT').sort((a, b) => b.updatedAt - a.updatedAt)
  const played = rows.filter((m) => m.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)

  return (
    <div>
      <PageHeader
        eyebrow="Pádel"
        title="Partidos"
        intro={`Armá las parejas en la cancha, cargá los sets y guardá. A 1 set suma ${PADEL.puntos[1]}, al mejor de 3 suma ${PADEL.puntos[3]} y al mejor de 5 suma ${PADEL.puntos[5]} a cada uno de la pareja que gana.`}
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => void create()} loading={busy}>
              Nuevo partido
            </Button>
          ) : null
        }
      />
      <PadelTabs />

      {isMember && drafts.length ? (
        <Section title="Armados, sin jugar" className="mt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {drafts.map((m) => (
              <Card key={m.id}>
                <div className="flex justify-between items-center gap-2">
                  <p className="font-bold truncate">
                    {pairName(m, 'A', players)} vs {pairName(m, 'B', players)}
                  </p>
                  <Pill tone="warn">Sin jugar</Pill>
                </div>
                <p className="small muted mt-1">
                  {playersOf(m).length} de 4 · {formatoLabel(m.bestOf)}
                </p>
                <Link to={`/padel/partido/${m.id}`} className="btn btn-sm mt-3">
                  Seguir armando
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Historial">
        {played.length === 0 ? (
          <Empty title="Todavía no hay partidos jugados" text="Cuando guarden el primero, queda acá con el resultado y los sets." />
        ) : (
          <div className="grid gap-3">
            {played.map((m) => {
              const t = tally(m)
              const w = winnerOf(m)
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="tiny muted">
                      {fmtDayLong(m.playedAt)} · {formatoLabel(m.bestOf)}
                    </p>
                    <Link to={`/padel/partido/${m.id}`} className="tiny underline text-accent">
                      {isMember ? 'Ver o editar' : 'Ver'}
                    </Link>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
                    <p className={`text-right font-bold ${w === 'A' ? '' : 'muted'}`}>{pairName(m, 'A', players)}</p>
                    <p className="text-3xl font-extrabold tracking-tight tabular-nums">
                      {t.a} – {t.b}
                    </p>
                    <p className={`font-bold ${w === 'B' ? '' : 'muted'}`}>{pairName(m, 'B', players)}</p>
                  </div>
                  <p className="small muted text-center mt-2">
                    {setsText(m)}
                    {w ? ` · +${formatPoints(PADEL.puntos[m.bestOf] ?? 0)} c/u` : ''}
                  </p>
                </Card>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
