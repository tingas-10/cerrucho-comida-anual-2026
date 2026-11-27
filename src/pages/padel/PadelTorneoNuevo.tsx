// Pádel · Nuevo torneo: nombre, formato, parejas, cómo se arman los grupos o el cuadro,
// formato de los partidos por etapa, puntos de la tabla y punto de oro. Lo puede crear cualquiera de la banda.
import { LayoutGrid, ListOrdered, Network, Plus, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FORMATO_PARTIDO, FORMATO_TORNEO, PADEL_TORNEO } from '../../content/padel'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { P } from '../../data/paths'
import type { PadelFormat, PadelTournament } from '../../data/types'
import { yearOf } from '../../domain/fmo'
import { localToMs } from '../../domain/format'
import { computePadelStats } from '../../domain/padel'
import { buildGroups, koTies, qualifiersCount, roundTitle, rrGames } from '../../domain/padelTorneo'
import { shuffle } from '../../domain/truco'
import { Button, Card, Field, Input, LoginPrompt, Segmented } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { useFmoPlayers } from '../fmo/fmoShared'
import { PlayerPicker } from '../truco/trucoShared'
import { PadelTabs, usePadelMatches } from './padelShared'
import { PadelHeader } from './padelTorneoShared'

type Fmt = PadelTournament['format']
interface Row {
  key: number
  players: [string, string]
  group: number
}

const FORMATS: Array<{ value: Fmt; icon: ReactNode }> = [
  { value: 'groups', icon: <LayoutGrid size={22} /> },
  { value: 'knockout', icon: <Network size={22} /> },
  { value: 'league', icon: <ListOrdered size={22} /> },
]

const MATCH_OPTIONS = (Object.keys(FORMATO_PARTIDO) as PadelFormat[]).map((k) => ({ value: k, label: FORMATO_PARTIDO[k].corto }))

/** Reparte `n` parejas en `g` grupos parejos: cuántas tiene cada grupo. */
function groupSizes(n: number, g: number): number[] {
  return Array.from({ length: g }, (_, i) => Math.floor(n / g) + (i < n % g ? 1 : 0))
}

export function PadelTorneoNuevo() {
  const { db, memberId, isMember } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const players = useFmoPlayers()
  const { rows: matches } = usePadelMatches()
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [place, setPlace] = useState('')
  const [format, setFormat] = useState<Fmt>('groups')
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: 4 }, (_, i) => ({ key: i, players: ['', ''], group: i % 2 })))
  const [nGroups, setNGroups] = useState(2)
  const [advance, setAdvance] = useState<1 | 2 | 3 | 'all'>(2)
  const [groupMode, setGroupMode] = useState<'sorteo' | 'ranking' | 'mano'>('sorteo')
  const [seeding, setSeeding] = useState<'sorteo' | 'ranking' | 'lista'>('sorteo')
  const [legs, setLegs] = useState<1 | 2>(1)
  const [rrFormat, setRrFormat] = useState<PadelFormat>(PADEL_TORNEO.formatoTabla)
  const [koFormats, setKoFormats] = useState<Record<string, PadelFormat>>({})
  const [points, setPoints] = useState(PADEL_TORNEO.puntos)
  const [deuce, setDeuce] = useState<'oro' | 'ventaja'>('oro')
  const [busy, setBusy] = useState(false)

  const n = rows.length
  const sizes = useMemo(() => {
    if (format !== 'groups') return []
    if (groupMode === 'mano') return Array.from({ length: nGroups }, (_, g) => rows.filter((r) => r.group === g).length)
    return groupSizes(n, nGroups)
  }, [format, groupMode, nGroups, rows, n])
  const koEntrants = format === 'knockout' ? n : format === 'groups' ? qualifiersCount(sizes, advance) : 0
  const ties = koTies(koEntrants)
  const koFmt = (t: number): PadelFormat => koFormats[String(t)] ?? PADEL_TORNEO.formatoLlave
  const totalMatches =
    format === 'league' ? ((n * (n - 1)) / 2) * legs : format === 'knockout' ? Math.max(0, n - 1) : sizes.reduce((a, s) => a + (s * (s - 1)) / 2, 0) + Math.max(0, koEntrants - 1)

  const used = rows.flatMap((r) => r.players).filter(Boolean)
  const problem = (() => {
    if (name.trim().length < 2) return 'Ponele nombre al torneo.'
    if (rows.some((r) => !r.players[0] || !r.players[1])) return 'Completá las dos personas de cada pareja (o sacá la pareja que sobra).'
    if (new Set(used).size !== used.length) return 'Hay alguien en dos parejas.'
    if (format === 'league' && n < 3) return 'Una liga necesita al menos 3 parejas.'
    if (format === 'knockout' && n < 2) return 'Hacen falta al menos 2 parejas.'
    if (format === 'groups') {
      if (sizes.some((s) => s < 2)) return 'Cada grupo necesita al menos 2 parejas.'
      if (koEntrants < 2) return 'Tienen que pasar al menos 2 parejas al cuadro.'
    }
    return null
  })()

  function setPlayer(i: number, slot: 0 | 1, id: string) {
    setRows((cur) => cur.map((r, j) => (j === i ? { ...r, players: (slot === 0 ? [id, r.players[1]] : [r.players[0], id]) as [string, string] } : r)))
  }

  /** Fuerza de una pareja para ordenar por ranking: puntos del año de los dos jugadores. */
  const strength = useMemo(() => {
    const st = computePadelStats(matches, yearOf(Date.now()))
    return (r: Row) => r.players.reduce((acc, id) => acc + (st[id]?.points ?? 0), 0)
  }, [matches])

  async function create() {
    if (!memberId || problem) return
    setBusy(true)
    try {
      const id = db.newId()
      const now = Date.now()
      const withIds = rows.map((r, i) => ({ ...r, id: `p${i + 1}` }))
      const byRanking = [...withIds].sort((x, y) => strength(y) - strength(x))
      let ordered = withIds
      let groups: PadelTournament['groups'] = null
      let games: PadelTournament['games'] = null
      if (format === 'knockout') ordered = seeding === 'sorteo' ? shuffle(withIds) : seeding === 'ranking' ? byRanking : withIds
      if (format === 'league') games = rrGames(shuffle(withIds).map((r) => r.id), legs)
      if (format === 'groups') {
        if (groupMode === 'mano') {
          groups = Array.from({ length: nGroups }, (_, g) => {
            const ids = withIds.filter((r) => r.group === g).map((r) => r.id)
            return { name: `Grupo ${String.fromCharCode(65 + g)}`, ids, games: rrGames(ids) }
          })
        } else {
          const order = groupMode === 'ranking' ? byRanking : shuffle(withIds)
          groups = buildGroups(
            order.map((r) => r.id),
            nGroups,
          )
        }
      }
      const t: PadelTournament = {
        id,
        name: name.trim(),
        format,
        pairs: ordered.map((r) => ({ id: r.id, players: r.players })),
        games,
        groups,
        advance: format === 'groups' ? advance : null,
        formats: { rr: rrFormat, ko: Object.fromEntries(ties.map((x) => [String(x), koFmt(x)])) },
        points,
        deuce,
        date: date ? localToMs(date, '10:00') : null,
        place: place.trim() || null,
        createdBy: memberId,
        updatedBy: memberId,
        createdAt: now,
        updatedAt: now,
      }
      await db.setDoc(P.padelTournament(id), t)
      toast.ok('Torneo creado')
      navigate(`/padel/torneo/${id}`)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  if (!isMember) {
    return (
      <div>
        <PadelHeader title="Nuevo torneo" />
        <LoginPrompt text="Entrá con tu usuario para armar un torneo." />
      </div>
    )
  }

  const num = (v: number, set: (x: number) => void, label: string) => (
    <Field label={label} id={`pt-${label}`}>
      <Input id={`pt-${label}`} type="number" inputMode="decimal" step="0.5" value={v} onFocus={(e) => e.target.select()} onChange={(e) => set(Number(e.target.value) || 0)} />
    </Field>
  )

  return (
    <div>
      <Link to="/padel/torneos" className="back-link">
        ← Torneos
      </Link>
      <PadelHeader title="Nuevo torneo" intro="Elegí el formato, cargá las parejas y las reglas. Después se puede cambiar el formato de los partidos de cada etapa y los puntos." />
      <PadelTabs />

      <div className="grid gap-4 max-w-3xl">
        <Card>
          <p className="h3 mb-3">1. El torneo</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3">
              <Field label="Nombre" id="pt-name">
                <Input id="pt-name" value={name} maxLength={40} placeholder="Ej.: Tucan Open" onChange={(e) => setName(e.target.value)} />
              </Field>
            </div>
            <Field label="Día (opcional)" id="pt-date">
              <Input id="pt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Dónde (opcional)" id="pt-place">
                <Input id="pt-place" value={place} maxLength={60} placeholder="Ej.: canchas del club" onChange={(e) => setPlace(e.target.value)} />
              </Field>
            </div>
          </div>
        </Card>

        <Card>
          <p className="h3 mb-3">2. Formato</p>
          <div className="grid sm:grid-cols-3 gap-2">
            {FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={format === f.value}
                onClick={() => setFormat(f.value)}
                className={`text-left rounded-xl border-2 p-3 transition ${format === f.value ? 'border-[#06112a] bg-[#06112a] text-white' : 'border-line hover:border-[#06112a]/40'}`}
              >
                <span className={format === f.value ? 'text-[#d6f21d]' : 'text-accent'}>{f.icon}</span>
                <span className="block font-extrabold mt-1">{FORMATO_TORNEO[f.value].label}</span>
                <span className={`block tiny mt-0.5 ${format === f.value ? 'text-white/75' : 'muted'}`}>{FORMATO_TORNEO[f.value].text}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="h3">3. Parejas ({n})</p>
          </div>
          <div className="grid gap-3">
            {rows.map((r, i) => (
              <div key={r.key} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="small font-bold">Pareja {i + 1}</p>
                  <div className="flex items-center gap-2">
                    {format === 'groups' && groupMode === 'mano' ? (
                      <select className="input !min-h-[40px] !py-1 w-auto" aria-label={`Grupo de la pareja ${i + 1}`} value={r.group} onChange={(e) => setRows((cur) => cur.map((x, j) => (j === i ? { ...x, group: Number(e.target.value) } : x)))}>
                        {Array.from({ length: nGroups }, (_, g) => (
                          <option key={g} value={g}>
                            Grupo {String.fromCharCode(65 + g)}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button type="button" className="btn btn-line btn-sm px-2" aria-label={`Sacar la pareja ${i + 1}`} onClick={() => setRows((cur) => cur.filter((_, j) => j !== i))}>
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {([0, 1] as const).map((slot) => (
                    <PlayerPicker key={slot} label={`Pareja ${i + 1}, jugador ${slot + 1}`} value={r.players[slot]} players={players} exclude={used} onChange={(id) => setPlayer(i, slot, id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Button variant="line" className="mt-3 w-full sm:w-auto" onClick={() => setRows((cur) => [...cur, { key: Math.max(0, ...cur.map((x) => x.key)) + 1, players: ['', ''], group: cur.length % nGroups }])}>
            <Plus size={16} /> Sumar pareja
          </Button>
          <p className="tiny muted mt-2">Si alguien no es de la banda, elegí "+ Otro que no es de la banda…" al final de la lista.</p>
        </Card>

        <Card>
          <p className="h3 mb-3">4. {format === 'groups' ? 'Grupos' : format === 'knockout' ? 'Cuadro' : 'Fixture'}</p>
          {format === 'groups' ? (
            <div className="grid gap-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Cuántos grupos" id="pt-ng">
                  <select id="pt-ng" className="input" value={nGroups} onChange={(e) => setNGroups(Number(e.target.value))}>
                    {[1, 2, 3, 4, 6, 8].map((g) => (
                      <option key={g} value={g}>
                        {g === 1 ? '1 grupo' : `${g} grupos`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pasan al cuadro" id="pt-adv">
                  <select id="pt-adv" className="input" value={String(advance)} onChange={(e) => setAdvance(e.target.value === 'all' ? 'all' : (Number(e.target.value) as 1 | 2 | 3))}>
                    <option value="1">El 1° de cada grupo</option>
                    <option value="2">Los 2 primeros de cada grupo</option>
                    <option value="3">Los 3 primeros de cada grupo</option>
                    <option value="all">Todos, según la posición</option>
                  </select>
                </Field>
              </div>
              <div>
                <p className="small font-semibold mb-1.5">Cómo se arman los grupos</p>
                <Segmented
                  ariaLabel="Cómo se arman los grupos"
                  value={groupMode}
                  onChange={setGroupMode}
                  options={[
                    { value: 'sorteo', label: 'Sorteo' },
                    { value: 'ranking', label: 'Por ranking' },
                    { value: 'mano', label: 'A mano' },
                  ]}
                />
                <p className="tiny muted mt-1.5">
                  {groupMode === 'mano'
                    ? 'Elegí el grupo de cada pareja arriba, al lado de su nombre.'
                    : groupMode === 'ranking'
                      ? 'Las mejores del ranking quedan en grupos distintos.'
                      : 'Se sortean al crear el torneo.'}{' '}
                  {sizes.length ? `Quedan ${sizes.map((s, g) => `${String.fromCharCode(65 + g)}: ${s}`).join(' · ')}.` : ''}
                </p>
              </div>
              {advance === 2 && nGroups % 2 === 0 ? <p className="tiny muted">El cuadro se cruza como en el Mundial: el 1° de un grupo juega contra el 2° del otro.</p> : null}
            </div>
          ) : format === 'knockout' ? (
            <div>
              <p className="small font-semibold mb-1.5">Cómo se arma el cuadro</p>
              <Segmented
                ariaLabel="Cómo se arma el cuadro"
                value={seeding}
                onChange={setSeeding}
                options={[
                  { value: 'sorteo', label: 'Sorteo' },
                  { value: 'ranking', label: 'Por ranking' },
                  { value: 'lista', label: 'Como está la lista' },
                ]}
              />
              <p className="tiny muted mt-1.5">Si no son 2, 4, 8 o 16 parejas, las primeras pasan directo a la segunda ronda.</p>
            </div>
          ) : (
            <div>
              <p className="small font-semibold mb-1.5">Vueltas</p>
              <Segmented
                ariaLabel="Vueltas"
                value={String(legs) as '1' | '2'}
                onChange={(v) => setLegs(Number(v) as 1 | 2)}
                options={[
                  { value: '1', label: 'Sólo ida' },
                  { value: '2', label: 'Ida y vuelta' },
                ]}
              />
            </div>
          )}
        </Card>

        <Card>
          <p className="h3 mb-1">5. Partidos</p>
          <p className="small muted mb-3">Cada etapa puede tener su formato.</p>
          <div className="grid gap-3">
            {format !== 'knockout' ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <span className="small font-semibold">{format === 'league' ? 'Liga' : 'Fase de grupos'}</span>
                <Segmented ariaLabel="Formato de la liga o los grupos" value={rrFormat} onChange={setRrFormat} options={MATCH_OPTIONS} />
              </div>
            ) : null}
            {ties.map((x) => (
              <div key={x} className="flex items-center justify-between gap-3 flex-wrap border-t border-line pt-3">
                <span className="small font-semibold">{roundTitle(x)}</span>
                <Segmented ariaLabel={`Formato de ${roundTitle(x)}`} value={koFmt(x)} onChange={(v) => setKoFormats((c) => ({ ...c, [String(x)]: v }))} options={MATCH_OPTIONS} />
              </div>
            ))}
          </div>
          <p className="tiny muted mt-3">A 4 games: en 3-3 hay tie-break y termina 4-3. Para el ranking general, ganar a 4 games suma medio punto, a 1 set 1 y al mejor de 3, 2.</p>
        </Card>

        <Card>
          <p className="h3 mb-1">6. Puntos y reglas</p>
          {format !== 'knockout' ? (
            <>
              <p className="small muted mb-3">Puntos de la tabla del torneo. No cambian el ranking general.</p>
              <div className="grid grid-cols-3 gap-2 max-w-md">
                {num(points.win, (x) => setPoints((p) => ({ ...p, win: x })), 'Ganado')}
                {num(points.draw, (x) => setPoints((p) => ({ ...p, draw: x })), 'Empatado')}
                {num(points.loss, (x) => setPoints((p) => ({ ...p, loss: x })), 'Perdido')}
              </div>
              <p className="tiny muted mt-1 mb-4">Si empatan en puntos: si son dos, manda el partido entre ellos; después la diferencia de sets, la de games y los games a favor.</p>
            </>
          ) : null}
          <p className="small font-semibold mb-1.5">En 40 iguales</p>
          <Segmented
            ariaLabel="En 40 iguales"
            value={deuce}
            onChange={setDeuce}
            options={[
              { value: 'oro', label: 'Punto de oro' },
              { value: 'ventaja', label: 'Ventaja' },
            ]}
          />
        </Card>

        <div className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] md:static z-10 rounded-xl border border-line bg-card p-3 shadow-lg md:shadow-none">
          <p className={`small mb-2 ${problem ? 'text-danger' : 'muted'}`}>{problem ?? `${n} parejas · ${totalMatches} partidos en total.`}</p>
          <Button variant="lime" className="w-full sm:w-auto" onClick={() => void create()} loading={busy} disabled={!!problem}>
            Crear torneo
          </Button>
        </div>
      </div>
    </div>
  )
}
