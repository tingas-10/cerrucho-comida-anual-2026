// FMO · Jugadores: historial personal y gestión de invitados.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { FmoGuest } from '../../data/types'
import { computeStats, emptyStats, formatPoints, resultFor, scoreOf, yearOf, yearsWithMatches } from '../../domain/fmo'
import { fmtDayShort } from '../../domain/format'
import { Button, Card, Loading, PageHeader, Pill, Section, Stat } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { FmoTabs, YearSelect, useFmoMatches, useFmoPlayers } from './fmoShared'

export function FmoJugadores() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const { rows, loading } = useFmoMatches()
  const players = useFmoPlayers()
  const current = yearOf(Date.now())
  const [year, setYear] = useState<number | 'all'>('all')
  const [who, setWho] = useState<string>('')
  const [guestName, setGuestName] = useState('')
  useEffect(() => {
    if (!who && memberId) setWho(memberId)
  }, [who, memberId])

  const years = useMemo(() => yearsWithMatches(rows, current), [rows, current])
  const y = year === 'all' ? undefined : year
  const stats = useMemo(() => computeStats(rows, y)[who] ?? emptyStats(who), [rows, y, who])
  const history = useMemo(
    () => rows.filter((m) => m.status === 'PLAYED' && m.players[who] && (y === undefined || yearOf(m.playedAt) === y)).sort((a, b) => b.playedAt - a.playedAt),
    [rows, who, y],
  )
  const guests = players.list.filter((p) => p.guest)
  const guestHasMatches = (id: string) => rows.some((m) => m.players[id])

  async function addGuest() {
    const name = guestName.trim()
    if (name.length < 2 || !memberId) return
    try {
      const id = 'g-' + db.newId().slice(0, 10).toLowerCase()
      await db.setDoc<FmoGuest>(P.fmoGuest(id), { id, name, createdBy: memberId, createdAt: Date.now(), updatedAt: Date.now() })
      setGuestName('')
      toast.ok('Invitado agregado')
    } catch (e) {
      toast.error(errorText(e))
    }
  }
  async function renameGuest(id: string, name: string) {
    if (name.trim().length < 2) return
    try {
      await db.updateDoc(P.fmoGuest(id), { name: name.trim(), updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  if (loading || players.loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="FMO" title="Jugadores" intro="El historial de cada uno: partidos, goles y puntos." />
      <FmoTabs />
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
        <Stat label="Empatados" value={stats.drawn} />
        <Stat label="Perdidos" value={stats.lost} />
        <Stat label="Goles" value={stats.goals} />
        <Stat label="Puntos" value={formatPoints(stats.points)} />
      </div>

      <Section title="Sus partidos">
        <Card>
          {history.length === 0 ? <p className="small muted">Todavía no jugó ningún partido guardado{y ? ` en ${y}` : ''}.</p> : null}
          {history.map((m) => {
            const r = resultFor(m, who)
            const s = scoreOf(m)
            const mine = m.players[who]
            return (
              <Link key={m.id} to={`/fmo/partido/${m.id}`} className="row">
                <span className="small">
                  <span className="tiny muted block">{fmtDayShort(m.playedAt)}</span>
                  {m.nameA} {s.a} – {s.b} {m.nameB}
                  <span className="tiny muted"> · jugó en {mine.team === 'A' ? m.nameA : m.nameB}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {mine.goals ? <span className="small">⚽ {mine.goals}</span> : null}
                  {r === 'W' ? <Pill tone="ok">Ganó</Pill> : r === 'D' ? <Pill tone="warn">Empató</Pill> : <Pill tone="danger">Perdió</Pill>}
                </span>
              </Link>
            )
          })}
        </Card>
      </Section>

      {isMember ? (
      <Section title="Invitados">
        <Card>
          <p className="small muted mb-3">Gente que juega con nosotros pero no es de la banda. Tienen estadísticas, no entran a la web.</p>
          {guests.length === 0 ? <p className="small muted">Todavía no hay invitados.</p> : null}
          {guests.map((g) => (
            <GuestRow key={g.id} id={g.id} name={g.name} canDelete={!guestHasMatches(g.id)} onRename={renameGuest} onDelete={async () => {
              try {
                await db.deleteDoc(P.fmoGuest(g.id))
              } catch (e) {
                toast.error(errorText(e))
              }
            }} />
          ))}
          <div className="flex gap-2 mt-3">
            <input className="input" placeholder="Nombre del invitado" value={guestName} maxLength={30} onChange={(e) => setGuestName(e.target.value)} aria-label="Nombre del invitado" />
            <Button onClick={() => void addGuest()} disabled={guestName.trim().length < 2}>
              Agregar
            </Button>
          </div>
        </Card>
      </Section>
      ) : null}
    </div>
  )
}

function GuestRow({ id, name, canDelete, onRename, onDelete }: { id: string; name: string; canDelete: boolean; onRename: (id: string, name: string) => void; onDelete: () => void }) {
  const [value, setValue] = useState(name)
  useEffect(() => setValue(name), [name])
  return (
    <div className="row">
      <input className="input" value={value} maxLength={30} onChange={(e) => setValue(e.target.value)} aria-label={`Nombre de ${name}`} />
      <span className="flex gap-1 shrink-0">
        {value.trim() !== name ? (
          <Button size="sm" onClick={() => onRename(id, value)}>
            Guardar
          </Button>
        ) : null}
        <Button size="sm" variant="line" disabled={!canDelete} title={canDelete ? '' : 'Tiene partidos cargados'} onClick={onDelete}>
          Borrar
        </Button>
      </span>
    </div>
  )
}
