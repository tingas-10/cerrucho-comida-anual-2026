// FMO · Ranking anual por puntos.
import { useMemo, useState } from 'react'
import { FMO } from '../../content/fmo'
import { computeStats, formatPoints, ranking, yearOf, yearsWithMatches } from '../../domain/fmo'
import { Avatar, Card, Empty, Loading, PageHeader, Pill } from '../../ui/components'
import { FmoTabs, YearSelect, useFmoMatches, useFmoPlayers } from './fmoShared'

export function FmoRanking() {
  const { rows, loading } = useFmoMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>(current)
  const years = useMemo(() => yearsWithMatches(rows, current), [rows, current])
  const table = useMemo(() => ranking(computeStats(rows, year === 'all' ? undefined : year)), [rows, year])
  const p = FMO.puntos

  if (loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="FMO" title="Ranking" intro={`Ganado ${p.ganado} puntos · empatado ${p.empatado} · perdido ${p.perdido} · cada gol ${formatPoints(p.gol)}.`} actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />} />
      <FmoTabs />
      {table.length === 0 ? (
        <Empty title={year === 'all' ? 'Todavía no hay partidos jugados' : `Todavía no hay partidos jugados en ${year}`} text="Guardá un partido y el ranking se arma solo." />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tiny muted text-left">
                  <th className="py-2 pr-2 w-8">#</th>
                  <th className="py-2 pr-2">Jugador</th>
                  <th className="py-2 pr-2 text-right" title="Partidos jugados">PJ</th>
                  <th className="py-2 pr-2 text-right" title="Ganados">G</th>
                  <th className="py-2 pr-2 text-right" title="Empatados">E</th>
                  <th className="py-2 pr-2 text-right" title="Perdidos">P</th>
                  <th className="py-2 pr-2 text-right">Goles</th>
                  <th className="py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {table.map((s, i) => (
                  <tr key={s.playerId} className={`border-t border-line ${i < 3 ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-2">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2">
                        <Avatar id={s.playerId} alias={players.nameOf(s.playerId)} size={24} color={players.byId[s.playerId]?.color} />
                        {players.nameOf(s.playerId)}
                        {players.byId[s.playerId]?.guest ? <Pill tone="muted">Invitado</Pill> : null}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.played}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.won}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.drawn}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.lost}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.goals}</td>
                    <td className="py-2 text-right tabular-nums text-accent font-extrabold">{formatPoints(s.points)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
