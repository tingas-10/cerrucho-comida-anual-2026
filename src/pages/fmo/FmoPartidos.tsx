// FMO · Partidos: próximos (por jugarse), historial y armado de un partido nuevo.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FMO } from '../../content/fmo'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { FmoMatch } from '../../data/types'
import { scoreOf, startersOf, subsOf, teamOf, upcomingMatches } from '../../domain/fmo'
import { fmtDayLong, fmtTime, localToMs, msToLocalParts } from '../../domain/format'
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
      const m: FmoMatch = { id, playedAt: localToMs(msToLocalParts(now).date, '21:00') ?? now, size: FMO.tamanioDefault, nameA: FMO.equipoA, nameB: FMO.equipoB, players: {}, otherA: 0, otherB: 0, status: 'DRAFT', notes: '', createdBy: memberId, updatedBy: memberId, createdAt: now, updatedAt: now, revision: 1 }
      await db.setDoc(P.fmoMatch(id), m)
      navigate(`/fmo/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Loading />
  const drafts = upcomingMatches(rows)
  const played = rows.filter((m) => m.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)

  return (
    <div>
      <PageHeader
        eyebrow="FMO"
        title="Partidos"
        intro="Armá los equipos en la canchita (con los suplentes que quieran) y guardalo por jugarse. Cuando se juegue, cargá los goles y guardá el resultado. Cualquiera de la banda puede crear y editar."
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => void create()} loading={busy}>
              Nuevo partido
            </Button>
          ) : null
        }
      />
      <FmoTabs />

      {drafts.length ? (
        <Section title="Por jugarse" className="mt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {drafts.map((m) => (
              <Card key={m.id}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="h3 truncate">
                      {m.nameA} vs {m.nameB}
                    </p>
                    <p className="small text-accent font-semibold">
                      {fmtDayLong(m.playedAt)} · {fmtTime(m.playedAt)} h
                    </p>
                  </div>
                  <Pill tone="warn">Por jugarse</Pill>
                </div>
                <div className="grid grid-cols-2 gap-3 mt-2 tiny">
                  {(['A', 'B'] as const).map((t) => (
                    <p key={t} className="muted">
                      <b className="text-[var(--text)]">{t === 'A' ? m.nameA : m.nameB}</b>
                      <br />
                      {startersOf(m, t).map(players.nameOf).join(', ') || 'Sin titulares'}
                      {subsOf(m, t).length ? <span className="block">Sup.: {subsOf(m, t).map(players.nameOf).join(', ')}</span> : null}
                    </p>
                  ))}
                </div>
                <p className="tiny muted mt-1">
                  {startersOf(m, 'A').length} vs {startersOf(m, 'B').length} · {m.size} por equipo
                </p>
                <Link to={`/fmo/partido/${m.id}`} className="btn btn-sm mt-3">
                  {isMember ? 'Ver o seguir armando' : 'Ver'}
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
                          .map((id) => `${players.nameOf(id)}${m.players[id].sub ? ' (s)' : ''}${m.players[id].goals ? ` ⚽${m.players[id].goals > 1 ? m.players[id].goals : ''}` : ''}`)
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
