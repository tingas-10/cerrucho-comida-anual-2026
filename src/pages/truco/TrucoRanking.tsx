// Truco · Ranking: el que gana suma 1,5 y el que pierde resta 1 (cada jugador del equipo).
import { useMemo, useState } from 'react'
import { TRUCO, formatoTruco } from '../../content/truco'
import { formatPoints, yearOf } from '../../domain/fmo'
import { computeTrucoStats, trucoRanking, trucoYears } from '../../domain/truco'
import { Avatar, Card, Empty, Loading, PageHeader, Pill, Segmented } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { TrucoTabs, useTrucoMatches } from './trucoShared'

export function TrucoRanking() {
  const { rows, loading } = useTrucoMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>(current)
  const [size, setSize] = useState<'all' | '1' | '2' | '3'>('all')
  const years = useMemo(() => trucoYears(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const table = useMemo(() => trucoRanking(computeTrucoStats(rows, y, size === 'all' ? undefined : Number(size))), [rows, y, size])

  if (loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader
        eyebrow="Truco"
        title="Ranking"
        intro={`Cada partido ganado suma ${formatPoints(TRUCO.puntos.gana)} y cada perdido resta ${formatPoints(-TRUCO.puntos.pierde)}, a cada jugador del equipo. Cuentan también los partidos de los torneos.`}
        actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />}
      />
      <TrucoTabs />
      <div className="mb-3 flex justify-center sm:justify-start">
        <Segmented
          ariaLabel="Formato"
          value={size}
          onChange={setSize}
          options={[{ value: 'all', label: 'Todos' }, ...TRUCO.formatos.map((n) => ({ value: String(n) as '1' | '2' | '3', label: formatoTruco(n) }))]}
        />
      </div>
      {table.length === 0 ? (
        <Empty title="Todavía no hay partidos jugados" text="Anotá un partido y el ranking se arma solo." />
      ) : (
        <Card className="!p-3 sm:!p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="tiny muted text-left">
                <th className="py-2 pr-2 w-8">#</th>
                <th className="py-2 pr-2">Jugador</th>
                <th className="py-2 pr-2 text-right" title="Partidos jugados">PJ</th>
                <th className="py-2 pr-2 text-right" title="Ganados">G</th>
                <th className="py-2 pr-2 text-right" title="Perdidos">P</th>
                <th className="py-2 text-right" title="Puntos">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((s, i) => (
                <tr key={s.id} className={`border-t border-line ${i < 3 ? 'font-semibold' : ''}`}>
                  <td className="py-2 pr-2">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                  <td className="py-2 pr-2 max-w-[150px] sm:max-w-none">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="hidden sm:inline-flex">
                        <Avatar id={s.id} alias={players.nameOf(s.id)} size={24} color={players.byId[s.id]?.color} photo={players.byId[s.id]?.photo} />
                      </span>
                      <span className="truncate">{players.nameOf(s.id)}</span>
                      {players.byId[s.id]?.guest ? <Pill tone="muted">Inv.</Pill> : null}
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.played}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.won}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{s.lost}</td>
                  <td className={`py-2 text-right tabular-nums font-extrabold ${s.points < 0 ? 'text-danger' : 'text-accent'}`}>{formatPoints(s.points)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
