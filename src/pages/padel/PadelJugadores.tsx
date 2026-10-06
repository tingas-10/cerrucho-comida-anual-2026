// Pádel · Jugadores: historial personal y con quién juega mejor.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { formatPoints, yearOf } from '../../domain/fmo'
import { fmtDayShort } from '../../domain/format'
import { computePadelStats, emptyPadelStats, padelYears, pairOf, partnersOf, setsText, tally, winnerOf } from '../../domain/padel'
import { Card, Loading, PageHeader, Pill, Section, Stat } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { PadelTabs, pairName, usePadelMatches } from './padelShared'

export function PadelJugadores() {
  const { memberId } = useSession()
  const { rows, loading } = usePadelMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>('all')
  const [who, setWho] = useState('')
  useEffect(() => {
    if (!who && memberId) setWho(memberId)
    else if (!who && players.list.length) setWho(players.list[0].id)
  }, [who, memberId, players.list])

  const years = useMemo(() => padelYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const stats = useMemo(() => computePadelStats(rows, y)[who] ?? emptyPadelStats(who), [rows, y, who])
  const partners = useMemo(() => partnersOf(rows, who, y), [rows, who, y])
  const history = useMemo(
    () => rows.filter((m) => m.status === 'PLAYED' && pairOf(m, who) && (y === undefined || yearOf(m.playedAt) === y)).sort((a, b) => b.playedAt - a.playedAt),
    [rows, who, y],
  )

  if (loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="Pádel" title="Jugadores" intro="El historial de cada uno: partidos, sets, puntos y con quién le va mejor." />
      <PadelTabs />
      <div className="flex gap-2 flex-wrap mb-4">
        <select className="input w-auto" aria-label="Jugador" value={who} onChange={(e) => setWho(e.target.value)}>
          {players.list.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.guest ? ' (invitado)' : ''}
            </option>
          ))}
        </select>
        <YearSelect value={year} onChange={setYear} years={years} allowAll />
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <Stat label="Jugados" value={stats.played} />
        <Stat label="Ganados" value={stats.won} />
        <Stat label="Perdidos" value={stats.lost} />
        <Stat label="Sets ganados" value={stats.setsWon} />
        <Stat label="Sets perdidos" value={stats.setsLost} />
        <Stat label="Puntos" value={formatPoints(stats.points)} />
      </div>

      <Section title="Con quién jugó">
        <Card>
          {partners.length === 0 ? <p className="small muted">Todavía no jugó ningún partido guardado{y ? ` en ${y}` : ''}.</p> : null}
          {partners.map((p) => (
            <div key={p.id} className="row">
              <span className="font-semibold">{players.nameOf(p.id)}</span>
              <span className="small muted shrink-0">
                {p.played} PJ · {p.won} G · {p.lost} P
              </span>
            </div>
          ))}
        </Card>
      </Section>

      <Section title="Sus partidos">
        <Card>
          {history.length === 0 ? <p className="small muted">Sin partidos.</p> : null}
          {history.map((m) => {
            const side = pairOf(m, who)!
            const other = side === 'A' ? 'B' : 'A'
            const t = tally(m)
            const won = winnerOf(m) === side
            return (
              <Link key={m.id} to={`/padel/partido/${m.id}`} className="row">
                <span className="small min-w-0">
                  <span className="tiny muted block">
                    {fmtDayShort(m.playedAt)} · {setsText(m)}
                  </span>
                  <span className="block truncate">
                    {pairName(m, side, players)} {side === 'A' ? `${t.a}–${t.b}` : `${t.b}–${t.a}`} {pairName(m, other, players)}
                  </span>
                </span>
                {won ? <Pill tone="ok">Ganó</Pill> : <Pill tone="danger">Perdió</Pill>}
              </Link>
            )
          })}
        </Card>
      </Section>
      <p className="tiny muted mt-4">Los invitados son los mismos de FMO: se renombran o borran desde FMO → Jugadores.</p>
    </div>
  )
}
