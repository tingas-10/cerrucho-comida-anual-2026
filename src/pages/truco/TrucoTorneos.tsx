// Truco · Torneos: la lista y el armado de uno nuevo (liga, eliminación directa o grupos + eliminación;
// 1 vs 1, 2 vs 2 o 3 vs 3). Los partidos del torneo se anotan como cualquier otro y suman al ranking.
import { Shuffle, Trophy, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TRUCO, aCuantoLabel, formatoTruco } from '../../content/truco'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { TrucoEntrant, TrucoTournament } from '../../data/types'
import { computeTrucoStats, shuffle, splitGroups, tournamentState } from '../../domain/truco'
import { Button, Card, Empty, Field, Input, Loading, Modal, PageHeader, Pill, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers, type FmoPlayers } from '../fmo/fmoShared'
import { PlayerPicker, TrucoTabs, useTrucoMatches, useTrucoTournaments } from './trucoShared'

export const FORMATO_TORNEO: Record<TrucoTournament['format'], { label: string; desc: string }> = {
  league: { label: 'Liga', desc: 'Todos contra todos. Gana el que más partidos gana.' },
  knockout: { label: 'Eliminación directa', desc: 'El que pierde queda afuera, hasta la final.' },
  groups: { label: 'Grupos + eliminación', desc: 'Primero grupos todos contra todos; los mejores de cada grupo pasan a una llave de eliminación.' },
}

export function entrantName(t: TrucoTournament, id: string | null, players: FmoPlayers): string {
  if (!id) return 'A definir'
  const e = t.entrants.find((x) => x.id === id)
  if (!e) return '—'
  return t.size === 1 ? players.nameOf(e.players[0]) : e.name
}

export function TrucoTorneos() {
  const { isMember } = useSession()
  const { rows, loading } = useTrucoTournaments()
  const { rows: matches } = useTrucoMatches()
  const players = useFmoPlayers()
  const [creating, setCreating] = useState(false)

  if (loading || players.loading) return <Loading />
  const list = [...rows].sort((a, b) => b.createdAt - a.createdAt)
  return (
    <div>
      <PageHeader
        eyebrow="Truco"
        title="Torneos"
        intro="Armá un torneo en liga, eliminación directa o grupos con eliminación. Cada partido se anota con los fósforos y también suma al ranking."
        actions={
          isMember ? (
            <Button variant="gold" onClick={() => setCreating(true)}>
              Nuevo torneo
            </Button>
          ) : null
        }
      />
      <TrucoTabs />
      {list.length === 0 ? (
        <Empty title="Todavía no hay torneos" text="Armá el primero: elegís el formato, quiénes juegan y la web arma los cruces." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((t) => {
            const st = tournamentState(t, matches)
            return (
              <Link key={t.id} to={`/truco/torneo/${t.id}`} className="card p-4 hover:bg-soft/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{t.name}</p>
                  {st.champion ? <Pill tone="ok">Terminado</Pill> : <Pill tone="warn">En juego</Pill>}
                </div>
                <p className="small muted mt-1">
                  {FORMATO_TORNEO[t.format].label} · {formatoTruco(t.size)} · {t.entrants.length} {t.size === 1 ? 'jugadores' : 'equipos'}
                </p>
                {st.champion ? (
                  <p className="small mt-2 flex items-center gap-1">
                    <Trophy size={14} className="text-accent" /> Campeón: <b>{entrantName(t, st.champion, players)}</b>
                  </p>
                ) : (
                  <p className="small mt-2">
                    {st.played} de {st.total || '—'} partidos jugados
                  </p>
                )}
              </Link>
            )
          })}
        </div>
      )}
      {creating ? <NewTournament onClose={() => setCreating(false)} /> : null}
    </div>
  )
}

function NewTournament({ onClose }: { onClose: () => void }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const players = useFmoPlayers()
  const { rows: matches } = useTrucoMatches()
  const month = new Date().toLocaleDateString('es-AR', { month: 'long', timeZone: 'America/Argentina/Buenos_Aires' })
  const [name, setName] = useState(`Torneo de ${month}`)
  const [format, setFormat] = useState<TrucoTournament['format']>('league')
  const [size, setSize] = useState<'1' | '2' | '3'>('1')
  const [target, setTarget] = useState<'30' | '15'>('30')
  const [legs, setLegs] = useState<'1' | '2'>('1')
  const [groupsN, setGroupsN] = useState(2)
  const [advance, setAdvance] = useState<'1' | '2' | '3' | 'all'>('2')
  const [seeding, setSeeding] = useState<'random' | 'ranking'>('random')
  const [picked, setPicked] = useState<string[]>([])
  const [teams, setTeams] = useState<string[][]>([])
  const [busy, setBusy] = useState(false)
  const n = Number(size)
  const stats = useMemo(() => computeTrucoStats(matches), [matches])

  function toggle(id: string) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
    setTeams([])
  }
  function drawTeams() {
    if (picked.length % n) return toast.error(`Para ${formatoTruco(n)} hacen falta jugadores en múltiplos de ${n} (hay ${picked.length}).`)
    const order = shuffle(picked)
    setTeams(Array.from({ length: order.length / n }, (_, i) => order.slice(i * n, i * n + n)))
  }
  function setTeamSlot(ti: number, si: number, pid: string) {
    setTeams((cur) => cur.map((t, i) => (i === ti ? t.map((x, j) => (j === si ? pid : x)) : t)))
  }

  const entrantCount = n === 1 ? picked.length : teams.length
  const maxGroups = Math.max(2, Math.floor(entrantCount / 2))

  async function create() {
    if (!memberId) return
    let entrants: TrucoEntrant[]
    if (n === 1) entrants = picked.map((id) => ({ id, name: players.nameOf(id), players: [id] }))
    else {
      if (!teams.length) return toast.error('Sorteá los equipos (o armalos) antes de crear el torneo.')
      const flat = teams.flat()
      if (flat.some((x) => !x) || new Set(flat).size !== flat.length) return toast.error('Revisá los equipos: hay un lugar vacío o un jugador repetido.')
      entrants = teams.map((t, i) => ({ id: `e${i + 1}`, name: t.map(players.nameOf).join(' / '), players: t }))
    }
    if (entrants.length < 2) return toast.error('Hacen falta al menos 2 para un torneo.')
    if (format === 'groups' && entrants.length < groupsN * 2) return toast.error(`Con ${groupsN} grupos hacen falta al menos ${groupsN * 2} ${n === 1 ? 'jugadores' : 'equipos'}.`)
    // Orden: al azar, o según el ranking (promedio de puntos del equipo) para que los mejores no se crucen antes.
    const strength = (e: TrucoEntrant) => e.players.reduce((s, id) => s + (stats[id]?.points ?? 0), 0) / e.players.length
    const ordered = seeding === 'ranking' && format !== 'league' ? [...entrants].sort((x, y) => strength(y) - strength(x)) : shuffle(entrants)
    const groups = format === 'groups' ? splitGroups(ordered.map((e) => e.id), groupsN) : null
    const minGroup = groups ? Math.min(...groups.map((g) => g.ids.length)) : 0
    const adv = format === 'groups' ? (advance === 'all' ? 'all' : (Math.min(Number(advance), minGroup) as 1 | 2 | 3)) : null
    setBusy(true)
    try {
      const id = db.newId()
      const now = Date.now()
      const t: TrucoTournament = {
        id,
        name: name.trim() || 'Torneo de truco',
        size: n as 1 | 2 | 3,
        target: Number(target) as 15 | 30,
        format,
        legs: Number(legs) as 1 | 2,
        entrants: ordered,
        groups,
        advance: adv,
        createdBy: memberId,
        createdAt: now,
        updatedAt: now,
      }
      await db.setDoc(P.trucoTournament(id), t)
      toast.ok('¡Torneo armado! Ya están los cruces.')
      navigate(`/truco/torneo/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Nuevo torneo" wide>
      <div className="grid gap-4">
        <Field label="Nombre" id="tt-name">
          <Input id="tt-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div>
          <p className="label">Formato</p>
          <Segmented ariaLabel="Formato del torneo" value={format} onChange={setFormat} options={(['league', 'knockout', 'groups'] as const).map((k) => ({ value: k, label: FORMATO_TORNEO[k].label }))} />
          <p className="tiny muted mt-1">{FORMATO_TORNEO[format].desc}</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <p className="label">Jugadores por equipo</p>
            <Segmented
              ariaLabel="Jugadores por equipo"
              value={size}
              onChange={(v) => {
                setSize(v)
                setTeams([])
              }}
              options={TRUCO.formatos.map((k) => ({ value: String(k) as '1' | '2' | '3', label: formatoTruco(k) }))}
            />
          </div>
          <div>
            <p className="label">A cuántos</p>
            <Segmented ariaLabel="A cuántos" value={target} onChange={setTarget} options={TRUCO.aCuanto.map((k) => ({ value: String(k) as '30' | '15', label: aCuantoLabel(k) }))} />
          </div>
          {format !== 'knockout' ? (
            <div>
              <p className="label">{format === 'groups' ? 'Partidos en cada grupo' : 'Vueltas'}</p>
              <Segmented
                ariaLabel="Vueltas"
                value={legs}
                onChange={setLegs}
                options={[
                  { value: '1', label: 'Sólo ida' },
                  { value: '2', label: 'Ida y vuelta' },
                ]}
              />
            </div>
          ) : null}
          {format !== 'league' ? (
            <div>
              <p className="label">{format === 'groups' ? 'Grupos' : 'Cruces'}</p>
              <Segmented
                ariaLabel="Cómo se arman"
                value={seeding}
                onChange={setSeeding}
                options={[
                  { value: 'random', label: 'Al azar' },
                  { value: 'ranking', label: 'Según el ranking' },
                ]}
              />
            </div>
          ) : null}
          {format === 'groups' ? (
            <>
              <Field label="Cantidad de grupos" id="tt-groups">
                <select id="tt-groups" className="input" value={groupsN} onChange={(e) => setGroupsN(Number(e.target.value))}>
                  {Array.from({ length: Math.max(1, maxGroups - 1) }, (_, i) => i + 2).map((k) => (
                    <option key={k} value={k}>
                      {k} grupos
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pasan de cada grupo" id="tt-adv">
                <select id="tt-adv" className="input" value={advance} onChange={(e) => setAdvance(e.target.value as '1' | '2' | '3' | 'all')}>
                  <option value="1">El mejor</option>
                  <option value="2">Los 2 mejores</option>
                  <option value="3">Los 3 mejores</option>
                  <option value="all">Todos (en orden de posiciones)</option>
                </select>
              </Field>
            </>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="label !mb-0">Quiénes juegan</p>
            <span className="tiny muted">{picked.length} elegidos</span>
          </div>
          <PlayerPicker value="" onChange={(id) => id && toggle(id)} players={players} exclude={picked} label="Sumar un jugador al torneo" placeholder="+ Sumar un jugador…" />
          <p className="tiny muted mt-1">Están todos los de la banda y los invitados. Si juega alguien nuevo, al final del desplegable: «+ Otro que no es de la banda…».</p>
          {picked.length ? (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {picked.map((id) => (
                <span key={id} className="pill flex items-center gap-1">
                  {players.nameOf(id)}
                  {players.byId[id]?.guest ? <span className="tiny muted">(inv.)</span> : null}
                  <button type="button" className="ml-1 min-w-[24px] min-h-[24px]" aria-label={`Sacar a ${players.nameOf(id)}`} onClick={() => toggle(id)}>
                    <X size={14} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {n > 1 ? (
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <p className="label !mb-0">Equipos</p>
              <Button size="sm" variant="line" onClick={drawTeams} disabled={picked.length < n * 2}>
                <Shuffle size={14} /> {teams.length ? 'Volver a sortear' : 'Sortear equipos'}
              </Button>
            </div>
            {teams.length === 0 ? (
              <p className="tiny muted">Elegí a los que juegan (en múltiplos de {n}) y sorteá los equipos. Después podés cambiar a mano quién va con quién.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2">
                {teams.map((t, ti) => (
                  <Card key={ti} className="!p-3">
                    <p className="small font-bold mb-1">Equipo {ti + 1}</p>
                    <div className="grid gap-1.5">
                      {t.map((pid, si) => (
                        <select key={si} className="input" value={pid} onChange={(e) => setTeamSlot(ti, si, e.target.value)} aria-label={`Equipo ${ti + 1}, jugador ${si + 1}`}>
                          {picked.map((id) => (
                            <option key={id} value={id}>
                              {players.nameOf(id)}
                            </option>
                          ))}
                        </select>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <Button variant="gold" className="w-full" onClick={() => void create()} loading={busy} disabled={entrantCount < 2}>
          <Trophy size={16} /> Armar el torneo ({entrantCount} {n === 1 ? 'jugadores' : 'equipos'})
        </Button>
      </div>
    </Modal>
  )
}
