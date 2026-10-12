// Golf · Partidos: próximos (por jugarse), jugados y armado de un partido nuevo.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { GOLF } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { GolfRound } from '../../data/types'
import { fmtDayLong, fmtTime, localToMs, msToLocalParts } from '../../domain/format'
import { roundResult, upcomingRounds } from '../../domain/golf'
import { Button, Card, Empty, Loading, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers } from '../fmo/fmoShared'
import { GolfTabs, entrantName, modeLabel, useGolfCourses, useGolfRounds } from './golfShared'

export function GolfPartidos() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading } = useGolfRounds()
  const courses = useGolfCourses()
  const players = useFmoPlayers()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!memberId) return
    setBusy(true)
    try {
      const id = db.newId()
      const now = Date.now()
      const c = courses.active[0]
      const holes = c ? c.holes : Array.from({ length: 18 }, (_, i) => ({ par: GOLF.parDefault, si: i + 1 }))
      const r: GolfRound = {
        id,
        playedAt: localToMs(msToLocalParts(now).date, GOLF.horaDefault) ?? now,
        status: 'DRAFT',
        editableUntil: null,
        voided: false,
        courseId: c ? c.id : null,
        course: { name: c ? c.name : 'Cancha sin cargar', holes },
        mode: GOLF.modoDefault,
        useHcp: true,
        entrants: memberId ? [{ id: memberId, players: [memberId] }] : [],
        cards: {},
        notes: '',
        createdBy: memberId,
        updatedBy: memberId,
        createdAt: now,
        updatedAt: now,
        revision: 1,
      }
      await db.setDoc(P.golfRound(id), r)
      navigate(`/golf/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading || players.loading) return <Loading />
  const upcoming = upcomingRounds(rows)
  const played = rows.filter((r) => r.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)

  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Partidos"
        intro="Armá tu partido: elegí cancha, modalidad y con quién jugás. Cargá la tarjeta hoyo por hoyo (o sólo el total en medal y scramble) y guardá el resultado."
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => void create()} loading={busy}>
              Nuevo partido
            </Button>
          ) : null
        }
      />
      <GolfTabs />

      {upcoming.length ? (
        <Section title="Por jugarse" className="mt-0">
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
                  <Pill tone="warn">Por jugarse</Pill>
                </div>
                <p className="small muted mt-1">{modeLabel(r)}</p>
                <p className="small mt-1">{r.entrants.map((e) => entrantName(e, players)).join(' · ') || 'Sin jugadores todavía'}</p>
                <Link to={`/golf/partido/${r.id}`} className="btn btn-sm mt-3">
                  {isMember ? 'Ver o seguir armando' : 'Ver'}
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Jugados">
        {played.length === 0 ? (
          <Empty title="Todavía no hay partidos jugados" text="Cuando guarden el primero, queda acá con el resultado." />
        ) : (
          <div className="grid gap-3">
            {played.map((r) => {
              const res = roundResult(r)
              return (
                <Card key={r.id} className={r.voided ? 'opacity-60' : ''}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="tiny muted">
                      {fmtDayLong(r.playedAt)} · {r.course.name} · {modeLabel(r)}
                    </p>
                    <span className="flex items-center gap-2">
                      {r.voided ? <Pill tone="danger">Anulada</Pill> : null}
                      <Link to={`/golf/partido/${r.id}`} className="tiny underline text-accent">
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
        )}
      </Section>
    </div>
  )
}
