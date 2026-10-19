// Golf · Ranking del año, con el sistema de puntos que define la comisión.
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { GolfMode } from '../../data/types'
import { Link } from 'react-router-dom'
import { yearOf } from '../../domain/fmo'
import { golfYears, meritTable, pointsText } from '../../domain/golf'
import { Avatar, Card, Empty, Loading, PageHeader, Pill, Segmented } from '../../ui/components'
import { YearSelect, useFmoPlayers } from '../fmo/fmoShared'
import { GolfTabs, useGolfConfig, useGolfRounds } from './golfShared'

export function GolfRanking() {
  const { rows, loading } = useGolfRounds()
  const cfg = useGolfConfig()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>(current)
  const years = useMemo(() => golfYears(rows, current), [rows, current])
  const [params, setParams] = useSearchParams()
  const mode = (['match', 'fourball', 'scramble', 'sixes'].includes(params.get('m') ?? '') ? params.get('m') : 'all') as GolfMode | 'all'
  const table = useMemo(() => meritTable(rows, cfg.points, year === 'all' ? undefined : year, mode === 'all' ? undefined : mode), [rows, cfg.points, year, mode])

  if (loading || cfg.loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Ranking"
        intro={
          <>
            Puntos: {pointsText(cfg.points)}. Los empatados comparten el puesto. Las vueltas individuales no suman. El sistema lo define la <Link to="/golf/comision" className="underline">comisión</Link>.
          </>
        }
        actions={<YearSelect value={year} onChange={setYear} years={years} allowAll />}
      />
      <GolfTabs />
      <div className="mb-4 overflow-x-auto">
        <Segmented
          ariaLabel="Ranking"
          value={mode}
          onChange={(v) => setParams(v === 'all' ? {} : { m: v }, { replace: true })}
          options={[
            { value: 'all', label: 'General' },
            { value: 'match', label: '1 vs 1' },
            { value: 'fourball', label: 'Four ball' },
            { value: 'scramble', label: 'Laguneada' },
            { value: 'sixes', label: 'De a tres' },
          ]}
        />
      </div>
      {table.length === 0 ? (
        <Empty title="Todavía no hay partidos jugados" text="Guarden un partido y el ranking se arma solo." />
      ) : (
        <Card className="!p-3 sm:!p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="tiny muted text-left">
                  <th className="py-2 pr-2 w-8">#</th>
                  <th className="py-2 pr-2">Jugador</th>
                  <th className="py-2 pr-2 text-right" title="Partidos jugados">Partidos</th>
                  <th className="py-2 pr-2 text-right" title="Primeros puestos">1º</th>
                  <th className="py-2 pr-2 text-right" title="Podios (top 3)">Podios</th>
                  <th className="py-2 text-right" title="Puntos">Pts</th>
                </tr>
              </thead>
              <tbody>
                {table.map((s, i) => (
                  <tr key={s.playerId} className={`border-t border-line ${i < 3 ? 'font-semibold' : ''}`}>
                    <td className="py-2 pr-2">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</td>
                    <td className="py-2 pr-2 max-w-[140px] sm:max-w-none">
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="hidden sm:inline-flex">
                          <Avatar id={s.playerId} alias={players.nameOf(s.playerId)} size={24} color={players.byId[s.playerId]?.color} photo={players.byId[s.playerId]?.photo} />
                        </span>
                        <span className="truncate">{players.nameOf(s.playerId)}</span>
                        {players.byId[s.playerId]?.guest ? <Pill tone="muted">Inv.</Pill> : null}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.rounds}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.wins}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{s.podiums}</td>
                    <td className="py-2 text-right tabular-nums text-accent font-extrabold">{s.points}</td>
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
