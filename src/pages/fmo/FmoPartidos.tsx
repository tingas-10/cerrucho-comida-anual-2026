// FMO · Partidos: historial y armado de un partido nuevo.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FMO } from '../../content/fmo'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { FmoMatch } from '../../data/types'
import { scoreOf, teamOf } from '../../domain/fmo'
import { fmtDayLong } from '../../domain/format'
import { Button, Card, Empty, Loading, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { FmoTabs, useFmoMatches, useFmoPlayers } from './fmoShared'

export function FmoPartidos() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading } = useFmoMatches()
  const players = useFmoPlayers()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!memberId) return
    setBusy(true)
    try {
      const id = db.newId()
      const now = Date.now()
      const m: FmoMatch = { id, playedAt: now, size: FMO.tamanioDefault, nameA: FMO.equipoA, nameB: FMO.equipoB, players: {}, otherA: 0, otherB: 0, status: 'DRAFT', notes: '', createdBy: memberId, updatedBy: memberId, createdAt: now, updatedAt: now, revision: 1 }
      await db.setDoc(P.fmoMatch(id), m)
      navigate(`/fmo/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />
  const drafts = rows.filter((m) => m.status === 'DRAFT').sort((a, b) => b.updatedAt - a.updatedAt)
  const played = rows.filter((m) => m.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)

  return (
    <div>
      <PageHeader
        eyebrow="FMO"
        title="Partidos"
        intro="Armá los equipos en la canchita, cargá los goles al terminar y guardá el partido. Cualquiera de la banda puede crear y editar."
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => void create()} loading={busy}>
              Nuevo partido
            </Button>
          ) : null
        }
      />
      <FmoTabs />

      {isMember && drafts.length ? (
        <Section title="Armados, sin jugar" className="mt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {drafts.map((m) => (
              <Card key={m.id}>
                <div className="flex justify-between items-center gap-2">
                  <p className="h3">
                    {m.nameA} vs {m.nameB}
                  </p>
                  <Pill tone="warn">Sin jugar</Pill>
                </div>
                <p className="small muted mt-1">
                  {teamOf(m, 'A').length} vs {teamOf(m, 'B').length} · {m.size} por equipo
                </p>
                <Link to={`/fmo/partido/${m.id}`} className="btn btn-sm mt-3">
                  Seguir armando
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Historial">
        {played.length === 0 ? (
          <Empty title="Todavía no hay partidos jugados" text="Cuando guarden el primero, queda acá con el resultado y los goles." />
        ) : (
          <div className="grid gap-3">
            {played.map((m) => {
              const s = scoreOf(m)
              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="tiny muted">{fmtDayLong(m.playedAt)}</p>
                    <Link to={`/fmo/partido/${m.id}`} className="tiny underline text-accent">
                      {isMember ? 'Ver, editar o bajar la historia' : 'Ver o bajar la historia'}
                    </Link>
                  </div>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
                    <p className={`text-right font-bold ${s.a > s.b ? '' : 'muted'}`}>{m.nameA}</p>
                    <p className="text-3xl font-extrabold tracking-tight tabular-nums">
                      {s.a} – {s.b}
                    </p>
                    <p className={`font-bold ${s.b > s.a ? '' : 'muted'}`}>{m.nameB}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3 small">
                    {(['A', 'B'] as const).map((t) => (
                      <p key={t} className={t === 'A' ? 'text-right muted' : 'muted'}>
                        {teamOf(m, t)
                          .map((id) => `${players.nameOf(id)}${m.players[id].goals ? ` ⚽${m.players[id].goals > 1 ? m.players[id].goals : ''}` : ''}`)
                          .join(' · ')}
                      </p>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
