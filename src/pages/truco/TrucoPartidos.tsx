// Truco · Partidos: en juego (se ven en vivo), armados y el historial. Cualquiera de la banda arma uno.
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TRUCO, aCuantoLabel, formatoTruco } from '../../content/truco'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { TrucoMatch } from '../../data/types'
import { formatPoints } from '../../domain/fmo'
import { fmtDayLong } from '../../domain/format'
import { winnerOf } from '../../domain/truco'
import { Button, Card, Empty, Loading, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { TrucoTabs, teamLabel, useTrucoMatches, useTrucoTournaments } from './trucoShared'

export function newTrucoMatch(id: string, by: string, over: Partial<TrucoMatch> = {}): TrucoMatch {
  const now = Date.now()
  const size = over.size ?? 1
  return {
    id,
    playedAt: now,
    size,
    target: TRUCO.aCuantoDefault,
    teamA: Array.from({ length: size }, () => ''),
    teamB: Array.from({ length: size }, () => ''),
    nameA: TRUCO.equipoA,
    nameB: TRUCO.equipoB,
    scoreA: 0,
    scoreB: 0,
    log: [],
    status: 'DRAFT',
    resultOnly: false,
    tournamentId: null,
    fixtureId: null,
    entrantA: null,
    entrantB: null,
    notes: '',
    createdBy: by,
    updatedBy: by,
    createdAt: now,
    updatedAt: now,
    revision: 1,
    ...over,
  }
}

export function TrucoPartidos() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { rows, loading } = useTrucoMatches()
  const { rows: tournaments } = useTrucoTournaments()
  const players = useFmoPlayers()
  const [busy, setBusy] = useState(false)

  async function create() {
    if (!memberId) return
    setBusy(true)
    try {
      const id = db.newId()
      await db.setDoc(P.trucoMatch(id), newTrucoMatch(id, memberId))
      navigate(`/truco/partido/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (loading || players.loading) return <Loading />
  const live = rows.filter((m) => m.status === 'LIVE').sort((a, b) => b.updatedAt - a.updatedAt)
  const drafts = rows.filter((m) => m.status === 'DRAFT').sort((a, b) => b.updatedAt - a.updatedAt)
  const played = rows.filter((m) => m.status === 'PLAYED').sort((a, b) => b.playedAt - a.playedAt)
  const tName = (id?: string | null) => (id ? tournaments.find((t) => t.id === id)?.name : undefined)

  return (
    <div>
      <PageHeader
        eyebrow="Truco"
        title="Partidos"
        intro={`Anotá los partidos con los fósforos, como en el papel. El que gana suma ${formatPoints(TRUCO.puntos.gana)} y el que pierde resta ${formatPoints(-TRUCO.puntos.pierde)}.`}
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => void create()} loading={busy}>
              Nuevo partido
            </Button>
          ) : null
        }
      />
      <TrucoTabs />

      {live.length ? (
        <Section title="Jugándose ahora" className="mt-0">
          <div className="grid sm:grid-cols-2 gap-3">
            {live.map((m) => (
              <Link key={m.id} to={`/truco/partido/${m.id}`} className="card p-4 hover:bg-soft/60">
                <div className="flex justify-between items-center gap-2">
                  <p className="tiny muted truncate">{tName(m.tournamentId) ?? formatoTruco(m.size)}</p>
                  <Pill tone="ok">● En vivo</Pill>
                </div>
                <Score m={m} players={players} />
              </Link>
            ))}
          </div>
        </Section>
      ) : null}

      {isMember && drafts.length ? (
        <Section title="Armados, sin jugar" className={live.length ? '' : 'mt-0'}>
          <div className="grid sm:grid-cols-2 gap-3">
            {drafts.map((m) => (
              <Card key={m.id}>
                <p className="font-bold truncate">
                  {teamLabel(m, 'A', players)} vs {teamLabel(m, 'B', players)}
                </p>
                <p className="small muted mt-1">
                  {tName(m.tournamentId) ? `${tName(m.tournamentId)} · ` : ''}
                  {formatoTruco(m.size)} · {aCuantoLabel(m.target)}
                </p>
                <Link to={`/truco/partido/${m.id}`} className="btn btn-sm mt-3">
                  Seguir
                </Link>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}

      <Section title="Historial">
        {played.length === 0 ? (
          <Empty title="Todavía no hay partidos" text="Armá uno, anotá con los fósforos y queda acá." />
        ) : (
          <div className="grid gap-3">
            {played.map((m) => (
              <Link key={m.id} to={`/truco/partido/${m.id}`} className="card p-4 hover:bg-soft/60">
                <p className="tiny muted">
                  {fmtDayLong(m.playedAt)} · {formatoTruco(m.size)}
                  {tName(m.tournamentId) ? ` · ${tName(m.tournamentId)}` : ''}
                </p>
                <Score m={m} players={players} />
              </Link>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}

function Score({ m, players }: { m: TrucoMatch; players: FmoPlayers }) {
  const w = winnerOf(m)
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mt-2">
      <p className={`text-right font-bold truncate ${w && w !== 'A' ? 'muted' : ''}`}>{teamLabel(m, 'A', players)}</p>
      {m.resultOnly ? (
        <p className="font-extrabold text-center whitespace-nowrap">{w === 'A' ? '← Ganó' : w === 'B' ? 'Ganó →' : '—'}</p>
      ) : (
        <p className="text-3xl font-extrabold tracking-tight tabular-nums whitespace-nowrap">
          {Math.min(m.scoreA, m.target)} – {Math.min(m.scoreB, m.target)}
        </p>
      )}
      <p className={`font-bold truncate ${w && w !== 'B' ? 'muted' : ''}`}>{teamLabel(m, 'B', players)}</p>
    </div>
  )
}
