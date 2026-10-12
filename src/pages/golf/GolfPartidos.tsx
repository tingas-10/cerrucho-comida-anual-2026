// Golf · Partidos: en juego, por jugarse, jugados y vueltas individuales. Armado de un partido nuevo o de una vuelta.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GOLF } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { newRound } from '../../data/golf'
import { P } from '../../data/paths'
import type { GolfRound } from '../../data/types'
import { fmtDayLong, fmtTime } from '../../domain/format'
import { liveBoard, roundResult } from '../../domain/golf'
import { Button, Card, Empty, Loading, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { GolfTabs, entrantName, modeLabel, useGolfCourses, useGolfHcps, useGolfRounds } from './golfShared'

export function GolfPartidos() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading } = useGolfRounds()
  const courses = useGolfCourses()
  const hcps = useGolfHcps()
  const players = useFmoPlayers()
  const [busy, setBusy] = useState<'match' | 'solo' | null>(null)

  async function create(kind: 'match' | 'solo') {
    if (!memberId) return
    setBusy(kind)
    try {
      const id = db.newId()
      const r = newRound({ id, by: memberId, mode: kind === 'solo' ? 'solo' : GOLF.modoDefault, course: courses.active[0] ?? null, entrants: [{ id: memberId, players: [memberId] }], hcpOf: hcps.hcpOf })
      await db.setDoc(P.golfRound(id), r)
      navigate(`/golf/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  if (loading || players.loading) return <Loading />
  const drafts = rows.filter((r) => r.status === 'DRAFT').sort((a, b) => a.playedAt - b.playedAt)
  const live = drafts.filter((r) => r.live)
  const upcoming = drafts.filter((r) => !r.live && r.mode !== 'solo')
  const playedAll = rows.filter((r) => r.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)
  const played = playedAll.filter((r) => r.mode !== 'solo')
  const solos = [...playedAll.filter((r) => r.mode === 'solo'), ...drafts.filter((r) => r.mode === 'solo' && !r.live && r.createdBy === memberId)].slice(0, 12)

  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Partidos"
        intro="Armá tu partido (1 vs 1, four ball o laguneada), elegí la cancha y con quién jugás. Mientras juegan, cada línea carga sus golpes en vivo y todos ven cómo viene cada una."
        actions={
          isMember ? (
            <span className="flex gap-2 flex-wrap">
              <Button variant="gold" onClick={() => void create('match')} loading={busy === 'match'}>
                Nuevo partido
              </Button>
              <Button variant="line" onClick={() => void create('solo')} loading={busy === 'solo'}>
                Cargar vuelta individual
              </Button>
            </span>
          ) : null
        }
      />
      <GolfTabs />

      {live.length ? (
        <Section title="En juego" className="mt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {live.map((r) => (
              <Card key={r.id}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="h3 truncate">{r.course.name}</p>
                    <p className="small muted">{modeLabel(r)}</p>
                  </div>
                  <Pill tone="ok">● En vivo</Pill>
                </div>
                <div className="mt-2 grid gap-1">
                  {liveBoard(r)
                    .slice(0, 4)
                    .map((row) => (
                      <div key={row.entrantId} className="flex justify-between gap-2 small">
                        <span className="truncate">{entrantName(r.entrants.find((e) => e.id === row.entrantId)!, players)}</span>
                        <span className="tabular-nums shrink-0">{row.label}</span>
                      </div>
                    ))}
                </div>
                <Link to={`/golf/partido/${r.id}`} className="btn btn-sm mt-3">
                  {isMember ? 'Cargar o seguir' : 'Seguir en vivo'}
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      {upcoming.length ? (
        <Section title="Por jugarse" className={live.length ? '' : 'mt-0'}>
          <div className="grid sm:grid-cols-2 gap-3">
            {upcoming.map((r) => (
              <Card key={r.id}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="h3 truncate">{r.course.name}</p>
                    <p className="small text-accent font-semibold">
                      {fmtDayLong(r.playedAt)} · {fmtTime(r.playedAt)} h
                    </p>
                  </div>
                  <span className="flex flex-col items-end gap-1">
                    <Pill tone="warn">Por jugarse</Pill>
                    {r.challengeId ? <Pill tone="accent">Desafío</Pill> : null}
                  </span>
                </div>
                <p className="small muted mt-1">{modeLabel(r)}</p>
                <p className="small mt-1">{r.entrants.map((e) => entrantName(e, players)).join(' vs ') || 'Sin jugadores todavía'}</p>
                <Link to={`/golf/partido/${r.id}`} className="btn btn-sm mt-3">
                  {isMember ? 'Ver o seguir armando' : 'Ver'}
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Jugados">
        {played.length === 0 ? <Empty title="Todavía no hay partidos jugados" text="Cuando guarden el primero, queda acá con el resultado." /> : <PlayedList rounds={played} players={players} />}
      </Section>

      {solos.length ? (
        <Section title="Vueltas individuales">
          <p className="tiny muted mb-2">No suman puntos, pero cuentan para el historial de cada uno y de la cancha.</p>
          <Card>
            {solos.map((r) => {
              const res = roundResult(r)
              return (
                <Link key={r.id} to={`/golf/partido/${r.id}`} className="row">
                  <span className="small min-w-0">
                    <span className="tiny muted block">
                      {fmtDayLong(r.playedAt)} · {r.course.name}
                    </span>
                    <span className="font-semibold">{players.nameOf(r.entrants[0]?.players[0] ?? '')}</span>
                  </span>
                  {r.status === 'DRAFT' ? <Pill tone="warn">Sin terminar</Pill> : <span className="tabular-nums small shrink-0">{res.standings[0]?.label ?? ''}</span>}
                </Link>
              )
            })}
          </Card>
        </Section>
      ) : null}
    </div>
  )
}

function PlayedList({ rounds, players }: { rounds: GolfRound[]; players: FmoPlayers }) {
  return (
    <div className="grid gap-3">
      {rounds.map((r) => {
        const res = roundResult(r)
        return (
          <Card key={r.id} className={r.voided ? 'opacity-60' : ''}>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="tiny muted">
                {fmtDayLong(r.playedAt)} · {r.course.name} · {modeLabel(r)}
              </p>
              <span className="flex items-center gap-2">
                {r.challengeId ? <Pill tone="accent">Desafío</Pill> : null}
                {r.voided ? <Pill tone="danger">Anulado</Pill> : null}
                <Link to={`/golf/partido/${r.id}`} className="text-link">
                  Ver
                </Link>
              </span>
            </div>
            <div className="mt-2 grid gap-1">
              {res.standings.slice(0, 3).map((s) => {
                const e = r.entrants.find((x) => x.id === s.entrantId)!
                return (
                  <div key={s.entrantId} className="flex justify-between gap-3">
                    <span className={`truncate ${s.position === 1 ? 'font-bold' : ''}`}>
                      {s.position === 1 ? '🥇' : s.position === 2 ? '🥈' : s.position === 3 ? '🥉' : `${s.position}º`} {entrantName(e, players)}
                    </span>
                    <span className="tabular-nums small shrink-0">{s.label}</span>
                  </div>
                )
              })}
              {res.standings.length > 3 ? <p className="tiny muted">y {res.standings.length - 3} más</p> : null}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
