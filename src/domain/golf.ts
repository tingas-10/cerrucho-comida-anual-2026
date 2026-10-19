// Reglas puras de golf: hándicap por hoyo, cálculo de tarjetas, posiciones por modalidad,
// Ranking, estadísticas de cada jugador y 1 vs 1.
import { GOLF_MODOS } from '../content/golf'
import type { GolfCard, GolfEntrant, GolfHole, GolfMode, GolfPointsConfig, GolfRound } from '../data/types'
import { yearOf } from './fmo'

export function isTeamMode(mode: GolfMode): boolean {
  return GOLF_MODOS[mode].equipos
}

/** A quién pertenece cada tarjeta: en scramble es una por equipo; en el resto, una por jugador. */
export function cardIds(r: Pick<GolfRound, 'mode' | 'entrants'>): string[] {
  if (r.mode === 'scramble') return r.entrants.map((e) => e.id)
  return r.entrants.flatMap((e) => e.players)
}

export function allPlayers(r: Pick<GolfRound, 'entrants'>): string[] {
  return r.entrants.flatMap((e) => e.players)
}

/** Índices de dificultad válidos (1..N sin repetir); si no, el orden de los hoyos. */
export function siOf(holes: GolfHole[]): number[] {
  const n = holes.length
  const si = holes.map((h) => h.si)
  const ok = si.every((v) => Number.isInteger(v) && v >= 1 && v <= n) && new Set(si).size === n
  return ok ? si : holes.map((_, i) => i + 1)
}

/** Hándicap de juego: el índice redondeado (la mitad en 9 hoyos). */
export function playingHcp(index: number, holes: number): number {
  const v = Number(index) || 0
  return Math.round(holes === 9 ? v / 2 : v)
}

/** Golpes que se reciben en un hoyo según el hándicap de juego y su índice de dificultad. */
export function strokesOn(hcp: number, si: number, n: number): number {
  if (hcp >= 0) return Math.floor(hcp / n) + (si <= hcp % n ? 1 : 0)
  const q = -hcp
  const back = Math.floor(q / n) + (si > n - (q % n) ? 1 : 0)
  return back ? -back : 0
}

export function allowsTotal(mode: GolfMode): boolean {
  return GOLF_MODOS[mode].soloTotal
}

export function usesTotal(card: GolfCard | undefined, mode: GolfMode): boolean {
  return !!card && allowsTotal(mode) && card.total !== null && card.strokes.every((s) => s === null)
}

export function cardComplete(card: GolfCard | undefined, n: number, mode: GolfMode): boolean {
  if (!card) return false
  if (usesTotal(card, mode)) return (card.total ?? 0) > 0
  return card.strokes.length === n && card.strokes.every((s) => Number.isInteger(s) && (s as number) > 0)
}

export interface CardCalc {
  complete: boolean
  holeByHole: boolean
  gross: number | null
  hcp: number // hándicap de juego (0 si la ronda es sin hándicap)
  net: number | null
  stableford: number | null
  holeNet: Array<number | null>
}

export function calcCard(r: Pick<GolfRound, 'course' | 'mode' | 'useHcp'>, card: GolfCard | undefined): CardCalc {
  const holes = r.course.holes
  const n = holes.length
  const si = siOf(holes)
  const hcp = r.useHcp && card ? playingHcp(card.hcp, n) : 0
  const complete = cardComplete(card, n, r.mode)
  const totalOnly = usesTotal(card, r.mode)
  if (!card) return { complete: false, holeByHole: true, gross: null, hcp, net: null, stableford: null, holeNet: holes.map(() => null) }
  if (totalOnly) {
    const gross = card.total
    return { complete, holeByHole: false, gross, hcp, net: gross === null ? null : gross - hcp, stableford: null, holeNet: holes.map(() => null) }
  }
  const holeNet = holes.map((_, i) => {
    const s = card.strokes[i]
    return s === null || s === undefined ? null : s - strokesOn(hcp, si[i], n)
  })
  const gross = complete ? card.strokes.reduce<number>((a, s) => a + (s ?? 0), 0) : null
  let stableford: number | null = null
  if (complete) stableford = holes.reduce((a, h, i) => a + Math.max(0, 2 + h.par - (holeNet[i] as number)), 0)
  return { complete, holeByHole: true, gross, hcp, net: gross === null ? null : gross - hcp, stableford, holeNet }
}

export interface Standing {
  entrantId: string
  players: string[]
  position: number // 1 = primero; los empatados comparten puesto
  label: string // lo que se muestra: "72 (neto 64)", "36 pts", "6 hoyos"
}

export interface RoundResult {
  standings: Standing[] // ordenadas por puesto; vacío si faltan tarjetas
  complete: boolean
  match?: { aId: string; bId: string; aHoles: number; bHoles: number; halved: number }
}

function rank<T>(items: T[], score: (x: T) => number, better: 'low' | 'high'): Array<T & { position: number }> {
  const sorted = [...items].sort((a, b) => (better === 'low' ? score(a) - score(b) : score(b) - score(a)))
  return sorted.map((x) => ({ ...x, position: 1 + sorted.filter((y) => (better === 'low' ? score(y) < score(x) : score(y) > score(x))).length }))
}

/** Puntos de un hoyo del partidito de a tres: 4/2/0 por puesto; los empatados se reparten lo de sus puestos
 *  (3 y 3 si empatan los dos primeros, 1 y 1 si empatan los dos segundos, 2 cada uno si empatan los tres). */
export function sixesHolePoints(scores: number[]): number[] {
  const values = [4, 2, 0]
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s)
  const out = new Array(scores.length).fill(0)
  let k = 0
  while (k < order.length) {
    let j = k
    while (j + 1 < order.length && order[j + 1].s === order[k].s) j++
    const share = values.slice(k, j + 1).reduce((a, b) => a + b, 0) / (j - k + 1)
    for (let x = k; x <= j; x++) out[order[x].i] = share
    k = j + 1
  }
  return out
}

/** Partidito de a tres: puntos acumulados hoyo por hoyo y neteados (el que va último queda en 0). */
export function sixesTotals(r: GolfRound): { netted: number[]; raw: number[]; thru: number } {
  const n = r.course.holes.length
  const si = siOf(r.course.holes)
  const ids = r.entrants.map((e) => e.players[0])
  const raw = ids.map(() => 0)
  let thru = 0
  for (let i = 0; i < n; i++) {
    const scores = ids.map((id) => {
      const card = r.cards[id]
      const s = card?.strokes[i]
      if (s === null || s === undefined) return null
      return r.useHcp ? s - strokesOn(playingHcp(card.hcp, n), si[i], n) : s
    })
    if (scores.some((x) => x === null)) continue
    thru++
    sixesHolePoints(scores as number[]).forEach((p, k) => (raw[k] += p))
  }
  const min = Math.min(...raw)
  return { raw, netted: raw.map((x) => x - min), thru }
}

/** Resultado de una ronda según su modalidad. */
export function roundResult(r: GolfRound): RoundResult {
  const n = r.course.holes.length
  const ids = cardIds(r)
  const minEntrants = r.mode === 'solo' ? 1 : 2
  const complete = r.entrants.length >= minEntrants && ids.length > 0 && ids.every((id) => cardComplete(r.cards[id], n, r.mode))
  if (!complete) return { standings: [], complete: false }
  const c = (id: string) => calcCard(r, r.cards[id])

  if (r.mode === 'medal' || r.mode === 'scramble' || r.mode === 'solo') {
    const rows = r.entrants.map((e) => {
      const cc = c(r.mode === 'scramble' ? e.id : e.players[0])
      const score = r.useHcp ? (cc.net as number) : (cc.gross as number)
      const label = r.useHcp && cc.hcp !== 0 ? `${cc.gross} (neto ${cc.net})` : `${cc.gross}`
      return { entrantId: e.id, players: e.players, score, label }
    })
    return { complete: true, standings: rank(rows, (x) => x.score, 'low').map(({ entrantId, players, position, label }) => ({ entrantId, players, position, label })) }
  }

  if (r.mode === 'stableford') {
    const rows = r.entrants.map((e) => {
      const cc = c(e.players[0])
      return { entrantId: e.id, players: e.players, score: cc.stableford as number, label: `${cc.stableford} pts` }
    })
    return { complete: true, standings: rank(rows, (x) => x.score, 'high').map(({ entrantId, players, position, label }) => ({ entrantId, players, position, label })) }
  }

  if (r.mode === 'fourball') {
    const rows = r.entrants.map((e) => {
      const calcs = e.players.map((p) => ({ p, cc: c(p) }))
      let total = 0
      for (let i = 0; i < n; i++) total += Math.min(...calcs.map(({ p, cc }) => (r.useHcp ? (cc.holeNet[i] as number) : (r.cards[p].strokes[i] as number))))
      return { entrantId: e.id, players: e.players, score: total, label: `${total}${r.useHcp ? ' neto' : ''}` }
    })
    return { complete: true, standings: rank(rows, (x) => x.score, 'low').map(({ entrantId, players, position, label }) => ({ entrantId, players, position, label })) }
  }

  if (r.mode === 'sixes') {
    const t = sixesTotals(r)
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))
    const rows = r.entrants.map((e, k) => ({ entrantId: e.id, players: e.players, score: t.netted[k], label: `${fmt(t.netted[k])} pts` }))
    return { complete: true, standings: rank(rows, (x) => x.score, 'high').map(({ entrantId, players, position, label }) => ({ entrantId, players, position, label })) }
  }

  // Match play: el de más hándicap recibe la diferencia, repartida por dificultad.
  const [ea, eb] = r.entrants
  const a = r.cards[ea.players[0]]
  const b = r.cards[eb.players[0]]
  const si = siOf(r.course.holes)
  const ha = r.useHcp ? playingHcp(a.hcp, n) : 0
  const hb = r.useHcp ? playingHcp(b.hcp, n) : 0
  const diff = ha - hb
  let aHoles = 0
  let bHoles = 0
  let halved = 0
  for (let i = 0; i < n; i++) {
    const na = (a.strokes[i] as number) - (diff > 0 ? strokesOn(diff, si[i], n) : 0)
    const nb = (b.strokes[i] as number) - (diff < 0 ? strokesOn(-diff, si[i], n) : 0)
    if (na < nb) aHoles++
    else if (nb < na) bHoles++
    else halved++
  }
  const winner = aHoles === bHoles ? null : aHoles > bHoles ? ea.id : eb.id
  const standings: Standing[] = [
    { entrantId: ea.id, players: ea.players, position: winner === eb.id ? 2 : 1, label: `${aHoles} hoyos` },
    { entrantId: eb.id, players: eb.players, position: winner === ea.id ? 2 : 1, label: `${bHoles} hoyos` },
  ].sort((x, y) => x.position - y.position)
  return { complete: true, standings, match: { aId: ea.id, bId: eb.id, aHoles, bHoles, halved } }
}

/** Devuelve null si la ronda se puede guardar como jugada, o el motivo. */
export function validateRound(r: GolfRound): string | null {
  const n = r.course.holes.length
  if (n !== 9 && n !== 18) return 'La cancha tiene que tener 9 o 18 hoyos.'
  if (r.course.holes.some((h) => !Number.isInteger(h.par) || h.par < 3 || h.par > 6)) return 'Revisá el par de los hoyos (entre 3 y 6).'
  const players = allPlayers(r)
  if (new Set(players).size !== players.length) return 'Hay un jugador repetido.'
  if (r.mode === 'solo') {
    if (r.entrants.length !== 1) return 'La vuelta individual es de un solo jugador.'
  } else if (r.entrants.length < 2) return isTeamMode(r.mode) ? 'Tiene que haber al menos 2 equipos.' : 'Tiene que haber al menos 2 jugadores.'
  if (r.mode === 'match' && r.entrants.length !== 2) return 'El 1 vs 1 es entre 2 jugadores.'
  if (r.mode === 'sixes' && r.entrants.length !== 3) return 'El partidito de a tres es entre 3 jugadores.'
  if (r.mode === 'fourball' && r.entrants.some((e) => e.players.length !== 2)) return 'En four ball cada pareja tiene 2 jugadores.'
  if (r.mode === 'scramble' && r.entrants.some((e) => e.players.length < 2)) return 'En la laguneada cada equipo tiene al menos 2 jugadores.'
  if (!isTeamMode(r.mode) && r.entrants.some((e) => e.players.length !== 1)) return 'Revisá los jugadores.'
  const missing = cardIds(r).filter((id) => !cardComplete(r.cards[id], n, r.mode))
  if (missing.length) return allowsTotal(r.mode) ? 'Faltan tarjetas: cargá todos los hoyos o el total.' : 'Faltan tarjetas: cargá todos los hoyos.'
  return null
}

/** Arma los participantes al cambiar de modalidad: individuales de a uno, parejas de a 2, equipos de a 2. */
export function regroup(players: string[], mode: GolfMode): GolfEntrant[] {
  if (!isTeamMode(mode)) return players.map((p) => ({ id: p, players: [p] }))
  const out: GolfEntrant[] = []
  for (let i = 0; i < players.length; i += 2) out.push({ id: `t${out.length + 1}`, players: players.slice(i, i + 2) })
  return out
}

export function emptyCard(holes: number, hcp: number): GolfCard {
  return { strokes: Array.from({ length: holes }, () => null), total: null, hcp }
}

function counted(rounds: GolfRound[], year?: number): GolfRound[] {
  return rounds.filter((r) => r.status === 'PLAYED' && !r.voided && (year === undefined || yearOf(r.playedAt) === year))
}

export interface MeritRow {
  playerId: string
  rounds: number
  wins: number
  podiums: number
  points: number
}

/** Ranking: puntos por jugar y por puesto en cada partido jugado (los empatados comparten puesto).
 *  Las vueltas individuales no suman. Con `mode`, sólo los partidos de esa modalidad. */
export function meritTable(rounds: GolfRound[], cfg: GolfPointsConfig, year?: number, mode?: GolfMode): MeritRow[] {
  const out: Record<string, MeritRow> = {}
  for (const r of counted(rounds, year)) {
    if (r.mode === 'solo' || (mode && r.mode !== mode)) continue
    const res = roundResult(r)
    if (!res.complete) continue
    for (const s of res.standings) {
      for (const p of s.players) {
        const row = (out[p] ??= { playerId: p, rounds: 0, wins: 0, podiums: 0, points: 0 })
        row.rounds++
        row.points += cfg.participation + (positionsFor(cfg, res.standings.length)[s.position - 1] ?? 0)
        if (s.position === 1) row.wins++
        if (s.position <= 3) row.podiums++
      }
    }
  }
  return Object.values(out).sort((a, b) => b.points - a.points || b.wins - a.wins || b.rounds - a.rounds || a.playerId.localeCompare(b.playerId))
}

export interface GolfPlayerStats {
  rounds: number // partidos (sin las vueltas individuales)
  solos: number // vueltas individuales
  wins: number
  podiums: number
  best18: number | null
  avg18: number | null
  best9: number | null
  bestStableford: number | null
  birdies: number
  eagles: number
  aces: number
}

/** Estadísticas de un jugador. Los golpes y los logros salen de sus tarjetas propias (no del scramble). */
export function golfPlayerStats(rounds: GolfRound[], playerId: string, year?: number): GolfPlayerStats {
  const st: GolfPlayerStats = { rounds: 0, solos: 0, wins: 0, podiums: 0, best18: null, avg18: null, best9: null, bestStableford: null, birdies: 0, eagles: 0, aces: 0 }
  const gross18: number[] = []
  for (const r of counted(rounds, year)) {
    const entrant = r.entrants.find((e) => e.players.includes(playerId))
    if (!entrant) continue
    const res = roundResult(r)
    if (!res.complete) continue
    if (r.mode === 'solo') st.solos++
    else {
      st.rounds++
      const pos = res.standings.find((s) => s.entrantId === entrant.id)?.position ?? 99
      if (pos === 1) st.wins++
      if (pos <= 3) st.podiums++
    }
    if (r.mode === 'scramble') continue
    const card = r.cards[playerId]
    const cc = calcCard(r, card)
    const n = r.course.holes.length
    if (cc.gross !== null) {
      if (n === 18) gross18.push(cc.gross)
      if (n === 18) st.best18 = st.best18 === null ? cc.gross : Math.min(st.best18, cc.gross)
      if (n === 9) st.best9 = st.best9 === null ? cc.gross : Math.min(st.best9, cc.gross)
    }
    if (r.mode === 'stableford' && cc.stableford !== null) st.bestStableford = st.bestStableford === null ? cc.stableford : Math.max(st.bestStableford, cc.stableford)
    if (cc.holeByHole) {
      r.course.holes.forEach((h, i) => {
        const s = card.strokes[i]
        if (!s) return
        if (s === 1) st.aces++
        else if (s <= h.par - 2) st.eagles++
        else if (s === h.par - 1) st.birdies++
      })
    }
  }
  if (gross18.length) st.avg18 = Math.round((gross18.reduce((a, b) => a + b, 0) / gross18.length) * 10) / 10
  return st
}

export interface GolfVersus {
  together: number // rondas que jugaron los dos
  aAhead: number // terminó más arriba (en equipos distintos)
  bAhead: number
  even: number
  partners: number // en la misma pareja o equipo
  partnersWon: number
  matchA: number // match play entre ellos
  matchB: number
  matchHalved: number
}

export function golfVersus(rounds: GolfRound[], a: string, b: string, year?: number): GolfVersus {
  const v: GolfVersus = { together: 0, aAhead: 0, bAhead: 0, even: 0, partners: 0, partnersWon: 0, matchA: 0, matchB: 0, matchHalved: 0 }
  for (const r of counted(rounds, year)) {
    const ea = r.entrants.find((e) => e.players.includes(a))
    const eb = r.entrants.find((e) => e.players.includes(b))
    if (!ea || !eb) continue
    const res = roundResult(r)
    if (!res.complete) continue
    v.together++
    const pa = res.standings.find((s) => s.entrantId === ea.id)!.position
    const pb = res.standings.find((s) => s.entrantId === eb.id)!.position
    if (ea.id === eb.id) {
      v.partners++
      if (pa === 1) v.partnersWon++
      continue
    }
    if (pa < pb) v.aAhead++
    else if (pb < pa) v.bAhead++
    else v.even++
    if (r.mode === 'match') {
      if (pa < pb) v.matchA++
      else if (pb < pa) v.matchB++
      else v.matchHalved++
    }
  }
  return v
}

export function golfYears(rounds: GolfRound[], currentYear: number): number[] {
  const set = new Set<number>([currentYear])
  for (const r of rounds) if (r.status === 'PLAYED' && !r.voided) set.add(yearOf(r.playedAt))
  return Array.from(set).sort((x, y) => y - x)
}

export function upcomingRounds(rounds: GolfRound[]): GolfRound[] {
  return rounds.filter((r) => r.status === 'DRAFT').sort((a, b) => a.playedAt - b.playedAt)
}

export function parTotal(holes: GolfHole[]): number {
  return holes.reduce((a, h) => a + h.par, 0)
}

/** Puntos por puesto según cuántos juegan (jugadores o equipos). Si no hay una fila para esa cantidad, la general. */
export function positionsFor(cfg: GolfPointsConfig, entrants: number): number[] {
  return cfg.byField?.[String(entrants)] ?? cfg.positions
}

/** Texto corto del sistema de puntos: "1 por jugar · entre 2: 5/0 · entre 3: 7/3/0 · 4 o más: 10/6/4". */
export function pointsText(cfg: GolfPointsConfig): string {
  const fmt = (p: number[]) => (p.length ? p.join('/') : 'nada')
  const rows = Object.entries(cfg.byField ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([n, p]) => `entre ${n}: ${fmt(p)}`)
  const sizes = Object.keys(cfg.byField ?? {}).map(Number)
  const general = sizes.length ? `${Math.max(...sizes) + 1} o más: ${fmt(cfg.positions)}` : `por puesto: ${fmt(cfg.positions)}`
  return [`${cfg.participation} por jugar`, ...rows, general].join(' · ')
}

export interface LiveRow {
  entrantId: string
  players: string[]
  thru: number // hoyos completos
  toPar: number | null // golpes respecto del par en los hoyos jugados (neto si la ronda es con hándicap)
  label: string // "+3 (hoyo 7)", "2 arriba (hoyo 9)"
}

/** Cómo viene cada uno mientras juegan: hasta qué hoyo cargó y cómo está respecto del par. */
export function liveBoard(r: GolfRound): LiveRow[] {
  const holes = r.course.holes
  const n = holes.length
  const si = siOf(holes)
  const played = (cid: string) => (r.cards[cid]?.strokes ?? []).map((s) => s !== null && s !== undefined)
  const netOn = (cid: string, i: number) => {
    const card = r.cards[cid]
    const s = card?.strokes[i]
    if (s === null || s === undefined) return null
    return r.useHcp ? s - strokesOn(playingHcp(card.hcp, n), si[i], n) : s
  }
  const fmt = (v: number) => (v === 0 ? 'par' : v > 0 ? `+${v}` : String(v))
  if (r.mode === 'sixes' && r.entrants.length === 3) {
    const t = sixesTotals(r)
    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ','))
    return r.entrants
      .map((e, k) => ({ entrantId: e.id, players: e.players, thru: t.thru, toPar: -t.netted[k], label: t.thru ? `${fmt(t.netted[k])} pts (hoyo ${t.thru})` : 'sin empezar' }))
      .sort((x, y) => (x.toPar ?? 0) - (y.toPar ?? 0))
  }
  if (r.mode === 'match' && r.entrants.length === 2) {
    const [a, b] = r.entrants.map((e) => e.players[0])
    const ca = r.cards[a]
    const cb = r.cards[b]
    const diff = r.useHcp && ca && cb ? playingHcp(ca.hcp, n) - playingHcp(cb.hcp, n) : 0
    let up = 0
    let thru = 0
    for (let i = 0; i < n; i++) {
      const sa = ca?.strokes[i]
      const sb = cb?.strokes[i]
      if (sa == null || sb == null) continue
      thru++
      const na = sa - (diff > 0 ? strokesOn(diff, si[i], n) : 0)
      const nb = sb - (diff < 0 ? strokesOn(-diff, si[i], n) : 0)
      if (na < nb) up++
      else if (nb < na) up--
    }
    const label = (v: number) => (v === 0 ? 'iguales' : v > 0 ? `${v} arriba` : `${-v} abajo`)
    return [
      { entrantId: r.entrants[0].id, players: r.entrants[0].players, thru, toPar: -up, label: `${label(up)}${thru ? ` (hoyo ${thru})` : ''}` },
      { entrantId: r.entrants[1].id, players: r.entrants[1].players, thru, toPar: up, label: `${label(-up)}${thru ? ` (hoyo ${thru})` : ''}` },
    ].sort((x, y) => (x.toPar ?? 0) - (y.toPar ?? 0))
  }
  const rows: LiveRow[] = r.entrants.map((e) => {
    const cids = r.mode === 'scramble' ? [e.id] : e.players
    let thru = 0
    let toPar = 0
    for (let i = 0; i < n; i++) {
      const vals = cids.map((cid) => netOn(cid, i)).filter((v): v is number => v !== null)
      const allIn = r.mode === 'fourball' ? vals.length > 0 && cids.every((cid) => played(cid)[i]) : vals.length === cids.length
      if (!allIn) continue
      thru++
      toPar += Math.min(...vals) - holes[i].par
    }
    return { entrantId: e.id, players: e.players, thru, toPar: thru ? toPar : null, label: thru ? `${fmt(toPar)} (hoyo ${thru})` : 'sin empezar' }
  })
  return rows.sort((x, y) => (x.toPar ?? 999) - (y.toPar ?? 999) || y.thru - x.thru)
}

/** Líneas por defecto: de a 4 en el orden en que se anotaron (las parejas o equipos no se separan). */
export function defaultLines(r: Pick<GolfRound, 'entrants'>, perLine = 4): Array<{ id: string; players: string[] }> {
  const out: Array<{ id: string; players: string[] }> = []
  let cur: string[] = []
  for (const e of r.entrants) {
    if (cur.length && cur.length + e.players.length > perLine) {
      out.push({ id: `l${out.length + 1}`, players: cur })
      cur = []
    }
    cur = cur.concat(e.players)
  }
  if (cur.length) out.push({ id: `l${out.length + 1}`, players: cur })
  return out
}

export interface CourseRecord {
  playerId: string
  rounds: number
  best: number | null // mejor gross (18 o 9 según la cancha)
  avg: number | null
  last: number // fecha del último partido o vuelta
}

/** Historial de una cancha: récord y promedio de cada jugador (tarjetas propias, incluye vueltas individuales). */
export function courseHistory(rounds: GolfRound[], courseId: string): CourseRecord[] {
  const out: Record<string, { rounds: number; scores: number[]; last: number }> = {}
  for (const r of rounds) {
    if (r.status !== 'PLAYED' || r.voided || r.courseId !== courseId || r.mode === 'scramble') continue
    for (const pid of allPlayers(r)) {
      const cc = calcCard(r, r.cards[pid])
      const row = (out[pid] ??= { rounds: 0, scores: [], last: 0 })
      row.rounds++
      row.last = Math.max(row.last, r.playedAt)
      if (cc.gross !== null) row.scores.push(cc.gross)
    }
  }
  return Object.entries(out)
    .map(([playerId, v]) => ({
      playerId,
      rounds: v.rounds,
      best: v.scores.length ? Math.min(...v.scores) : null,
      avg: v.scores.length ? Math.round((v.scores.reduce((a, b) => a + b, 0) / v.scores.length) * 10) / 10 : null,
      last: v.last,
    }))
    .sort((a, b) => (a.best ?? 999) - (b.best ?? 999) || b.rounds - a.rounds)
}

