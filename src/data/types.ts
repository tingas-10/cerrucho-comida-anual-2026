// Tipos de los documentos guardados en Firestore (o en el modo demo).
// Todas las fechas son milisegundos UTC (number). Importes en centavos (number).

export type Role = 'owner' | 'member'
export type MemberStatus = 'draft' | 'active' | 'suspended'

// Perfil público de un miembro (lo puede leer cualquiera, incluso sin entrar).
// status: 'draft' = todavía sin usuario · 'active' = tiene usuario y puede entrar · 'suspended' = acceso pausado.
export interface Member {
  id: string
  alias: string
  name?: string
  status: MemberStatus
  role: Role
  participating: boolean // participa de la edición actual
  vao: boolean // fue al Viaje Anual Obligatorio
  avatarColor?: string
  photo?: string | null // foto de perfil chica (data URL JPEG)
  birthday?: { d: number; m: number } | null // día y mes, públicos (el año es privado)
  giftPrefs?: string // gustos e ideas de regalo, públicos
  profileDone?: boolean // ya completó el primer ingreso
  hasLogin?: boolean
  createdAt: number
  updatedAt: number
  version: number
  // Campos viejos (acceso por mail); ya no se usan.
  uid?: string | null
  hasEmail?: boolean
  consentAt?: number | null
}

// Datos privados: sólo el propio miembro y el administrador.
export interface MemberPrivate {
  username?: string
  authEmail?: string // mail interno del usuario (inventado, nunca se usa para mandar nada)
  uid?: string // cuenta de acceso vigente
  birthYear?: number | null
  updatedAt?: number
}

// logins/{usuario}: para traducir el usuario al mail interno al iniciar sesión.
export interface LoginDoc {
  memberId: string
  email: string
}

// config/roles: quién es el presidente (se cambia desde Administración, sin tocar código).
export interface RolesConfig {
  presidentId: string | null
  golfCommission?: string[] // comisión de golf: sus decisiones necesitan 2 aprobaciones
  updatedAt?: number
}

export type EditionState = 'DRAFT' | 'ORGANIZING' | 'CONFIRMED' | 'RUNNING' | 'CLOSED' | 'ARCHIVED'

export interface VenueInfo {
  name: string
  address?: string
  link?: string
  capacity?: number | null
  costPerPersonCents?: number | null
  reserved?: boolean
  responsibleId?: string | null
  notes?: string
}

export interface FoodInfo {
  name: string
  modality?: string
  costPerPersonCents?: number | null
  includes?: string
  compatibility?: string
  responsibleId?: string | null
}

export interface AfterpartyInfo {
  name: string
  zone?: string
  link?: string
  entryCostCents?: number | null
  reserved?: boolean
  dressCode?: string
  responsibleId?: string | null
}

export interface AgendaItem {
  key: string
  label: string
  offsetMin: number
  startsAt?: number | null // hora oficial (ms) cuando está publicada
  responsibleId?: string | null
  notes?: string
}

export interface BeverageSettings {
  recipes: Record<string, Record<string, number>>
  ingredients: Array<{ id: string; label: string; unidad: 'ml' | 'g'; envaseMl: number; envaseLabel: string; packUnidades?: number }>
  reservePct: number
  waterMlPerAttendee: number
  iceGPerAttendee: number
  stock: Record<string, number> // unidades (envases) en stock por ingrediente
  prices: Record<string, number> // centavos por envase, sólo si se cargó
  pendingScenario: number // asistentes sin respuesta a imputar (default 0)
  extras?: Record<string, number> // envases fijos que se compran igual (gin y vermouth para los finos)
  responsible: Record<string, string | null>
  bought: Record<string, boolean>
  state: 'OPEN' | 'CLOSED'
  closeAt?: number | null
  snapshot?: {
    version: number
    at: number
    attendees: number
    responses: number
    units: Record<string, number>
  } | null
}

export interface DecisionInfo {
  status: 'UNDEFINED' | 'VOTING' | 'CONFIRMED' | 'PENDING_RESERVATION' | 'CLOSED'
  label?: string
  confirmedBy?: string | null
  confirmedAt?: number | null
  reason?: string
  pollId?: string | null
  proposalId?: string | null
}

export interface Edition {
  slug: string
  title: string
  year: number
  state: EditionState
  planVersion: number
  heroPhoto?: string
  date: {
    startsAt: number | null
    label?: string
    confirmedAt?: number | null
    confirmedBy?: string | null
    reason?: string
  }
  venue: VenueInfo | null
  menu: FoodInfo | null
  afterparty: AfterpartyInfo | null
  agenda: AgendaItem[]
  agendaPublished: boolean
  beverage: BeverageSettings
  decisions: Record<string, DecisionInfo>
  companionsEnabled: boolean
  vaoRosterConfirmed: boolean
  dietarySummary?: Record<string, number> | null
  news: Array<{ at: number; text: string }>
  createdAt: number
  updatedAt: number
  version: number
}

export type PollKind = 'dates' | 'food' | 'venue' | 'afterparty' | 'gift_amount' | 'custom'
export type PollMethod = 'AVAILABILITY' | 'APPROVAL' | 'SINGLE'
export type PollState = 'DRAFT' | 'OPEN' | 'CLOSED' | 'VOID'

export interface PollOption {
  id: string
  label: string
  detail?: string
  startsAt?: number | null // sólo para fechas
  special?: 'OTHER' | 'NONE' | null
}

export interface Poll {
  id: string
  kind: PollKind
  title: string
  description?: string
  method: PollMethod
  state: PollState
  options: PollOption[]
  electorate: string[]
  // ALL_ACTIVE: votan todos los miembros activos que participan (sin congelar). FROZEN: sólo `electorate`.
  electorateMode?: 'ALL_ACTIVE' | 'FROZEN'
  audience: 'ALL' | 'AFTERPARTY'
  openAt: number | null
  closeAt: number | null
  quorumPct: number
  version: number
  closure?: { count: number; closedAt: number; lowParticipation: boolean; reason?: string } | null
  decision?: { optionId: string; reason?: string; by: string; at: number } | null
  parentPollId?: string | null // segunda vuelta logística
  createdAt: number
  updatedAt: number
}

export type Availability = 'yes' | 'maybe' | 'no'

export interface PollResponse {
  // AVAILABILITY: { optionId: 'yes'|'maybe'|'no' }, APPROVAL: string[], SINGLE: string
  payload: Record<string, Availability> | string[] | string
  revision: number
  updatedAt: number
}

export type ProposalType = 'food' | 'venue' | 'afterparty' | 'date'
export type ProposalState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN'

export interface Proposal {
  id: string
  type: ProposalType
  authorId: string
  seed?: boolean // opción inicial cargada por el administrador
  label: string
  detail?: string
  link?: string
  startsAt?: number | null
  state: ProposalState
  votes?: Record<string, 'up' | 'down'>
  createdAt: number
  updatedAt: number
}

export type RsvpStatus = 'YES' | 'NO' | 'MAYBE'

export interface Rsvp {
  status: RsvpStatus
  planVersion: number
  arrival?: string
  afterparty: 'JOIN' | 'LEAVE_AFTER_DINNER' | 'STAY_AWARDS' | null
  updatedAt: number
  revision: number
}

export interface DietaryProfile {
  tags: string[]
  note?: string
  updatedAt: number
}

export interface BeverageProfile {
  level: number // 0..100 en pasos de 10; 0 = no toma
  portions: number // derivado del nivel, para el cálculo de compras
  noAlcohol: boolean
  pct: Record<string, number>
  revision: number
  updatedAt: number
}

export type AwardState =
  | 'DRAFT'
  | 'ROUND1_OPEN'
  | 'ROUND1_CLOSED'
  | 'RUNOFF_READY'
  | 'ROUND2_OPEN'
  | 'SEALED'
  | 'REVEALED'
  | 'VOID'

export type Outcome = 'WINNER' | 'TIE' | 'DESERTED' | 'NO_VOTES' | 'RUNOFF_REQUIRED'

export interface AwardResult {
  outcome: Exclude<Outcome, 'RUNOFF_REQUIRED'>
  winner?: string | null
  tied?: string[]
  counts: Record<string, number>
  round: 1 | 2
  participation: number
  electorateSize: number
  manual?: boolean
  corrected?: { reason: string; at: number } | null
}

export interface Award {
  code: string
  label: string
  description: string
  eligibility: 'VAO' | 'EDITION'
  order: number
  enabled: boolean
  anioSiguiente?: boolean
  state: AwardState
  candidates: string[]
  electorate: string[]
  round1: { openAt: number; closeAt: number } | null
  round2: { openAt: number; closeAt: number } | null
  finalists: string[] | null // sólo cuando se abre el ballotage
  result: AwardResult | null // sólo después de revelar
  revealedAt?: number | null
  version: number
  completedCount?: number // cuántos completaron esta categoría (sin decir qué votaron)
  createdAt: number
  updatedAt: number
}

export interface Ballot {
  r1: string | null
  r2: string | null
  revision: number
  updatedAt: number
}

export interface SealedResult {
  round: 1 | 2
  counts: Record<string, number>
  outcome: Outcome
  winner?: string | null
  tied?: string[]
  finalists?: string[]
  participation: number
  electorateSize: number
  computedAt: number
  nomineesIfDirect?: string[]
}

export type CeremonyStage = 'WELCOME' | 'CATEGORY' | 'NOMINEES' | 'ENVELOPE' | 'RESULT' | 'END'

export interface Ceremony {
  state: 'IDLE' | 'RUNNING' | 'PAUSED' | 'ENDED'
  stage: CeremonyStage
  currentCode: string | null
  order: string[]
  nominees: Record<string, string[]>
  sequence: number
  replayAt?: number | null
  updatedAt: number
}

export type GiftState = 'DRAFT' | 'ENROLLMENT_OPEN' | 'ENROLLMENT_CLOSED' | 'DRAW_PUBLISHED' | 'DELIVERY' | 'ARCHIVED'

export interface GiftCampaign {
  state: GiftState
  amountCents: number | null
  tolerancePct: number
  enrollCloseAt: number | null
  drawVersion: number
  drawnAt?: number | null
  roster: string[] // congelado al cerrar inscripción
  budgetVersion: number
  stats: { participants: number; viewed: number; ready: number; delivered: number }
  version: number
  updatedAt: number
}

export interface GiftParticipant {
  accepted: boolean
  acceptedBudgetVersion: number
  attending: boolean
  delegateId: string | null
  wishes?: string
  avoid?: string
  updatedAt: number
}

export interface GiftAssignment {
  receiverId: string
  version: number
  viewedAt: number | null
  readyAt: number | null
  deliveredAt: number | null
  revealedAt: number | null // el dador decidió revelarse al receptor
  giverRevealedId?: string | null
}

export interface GiftReceived {
  receivedAt: number | null
  giverRevealedId?: string | null
}

export type TaskStatus = 'DRAFT' | 'OPEN' | 'DONE' | 'ARCHIVED'

export interface Task {
  id: string
  title: string
  description?: string
  quantity?: number | null
  unit?: string
  dueAt?: number | null
  capacity: number
  status: TaskStatus
  volunteers: Record<string, { quantity: number; status: 'OFFERED' | 'DONE'; at: number }>
  estimatedCostCents?: number | null
  order: number
  createdAt: number
  updatedAt: number
}

export type ExpenseState = 'PROPOSED' | 'APPROVED' | 'REJECTED'

export interface Expense {
  id: string
  concept: string
  payerId: string
  amountCents: number
  category: 'FOOD' | 'ALCOHOL' | 'AFTERPARTY' | 'COMMON' | 'OTHER'
  date: number
  participants: string[]
  shares: Record<string, number>
  state: ExpenseState
  revision: number
  history: Array<{ at: number; by: string; note: string }>
  createdAt: number
  updatedAt: number
}

export interface Settlement {
  id: string
  fromId: string
  toId: string
  amountCents: number
  state: 'PROPOSED' | 'CONFIRMED'
  createdAt: number
}

export interface TransportEntry {
  id: string
  memberId: string
  kind: 'NEED' | 'OFFER' | 'TAXI'
  leg: 'DINNER' | 'AFTERPARTY'
  seats: number
  originHint?: string
  time?: string
  passengers: string[]
  createdAt: number
}

export interface Checklist {
  items: Record<string, boolean>
  updatedAt: number
}

export interface Reaction {
  photoId: string
  memberId: string
  emoji: string
}

export interface AuditEntry {
  id: string
  actorId: string
  action: string
  entity: string
  reason?: string
  at: number
}

export interface ArchiveEntry {
  slug: string
  title: string
  year: number
  date?: string
  venue?: string
  awards: Array<{ label: string; winner: string; manual?: boolean }>
  updatedAt: number
}

// ---------- FMO (fútbol) ----------
export interface FmoGuest {
  id: string
  name: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface FmoMatchPlayer {
  team: 'A' | 'B'
  x: number // posición en la cancha, 0..100
  y: number // 0..100; menos de 50 es el equipo A (arriba)
  goals: number
  sub?: boolean // suplente: no ocupa lugar en la cancha (ilimitados); juega y suma igual
}

export interface FmoMatch {
  id: string
  playedAt: number
  size: number // jugadores por equipo (5 a 8)
  nameA: string
  nameB: string
  players: Record<string, FmoMatchPlayer> // id de miembro o de invitado
  otherA: number // goles en contra o sin dueño a favor de A
  otherB: number
  status: 'DRAFT' | 'PLAYED' // DRAFT = por jugarse (armado, sin resultado)
  // "Sólo sé quién ganó": no se acuerdan el resultado. Suma a la tabla (G/E/P), pero no tiene goles.
  resultOnly?: boolean
  winner?: 'A' | 'B' | null // con resultOnly: equipo ganador (null = empate)
  notes?: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  revision: number
}

export interface PadelSet {
  a: number // games de la pareja de arriba
  b: number // games de la pareja de abajo
}

export interface PadelMatch {
  id: string
  playedAt: number
  bestOf: 1 | 3 | 5
  // Games por set: 6 (normal) o 4 (set corto, "a 4 games": en 3-3 hay tie-break y termina 4-3). Sin el campo, 6.
  games?: 4 | 6
  // Parejas: [drive, revés]. '' = lugar vacío. Ids de miembro o de invitado (fmoGuests).
  pairA: [string, string]
  pairB: [string, string]
  sets: PadelSet[]
  // LIVE: partido de torneo que se está jugando ahora (todavía sin resultado).
  status: 'DRAFT' | 'LIVE' | 'PLAYED'
  // "Sólo sé quién ganó": se elige el formato y la pareja ganadora, sin sets. Suma puntos, no sets ni games.
  resultOnly?: boolean
  winner?: 'A' | 'B' | null
  // Empate (sólo en la fase de liga o grupos de un torneo, por ejemplo 1 set cada uno): no suma al ranking general.
  draw?: boolean
  // Partido de un torneo: qué torneo, qué cruce y qué parejas del torneo juegan.
  tournamentId?: string | null
  fixtureId?: string | null
  entrantA?: string | null
  entrantB?: string | null
  notes?: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  revision: number
}

// ---------- Pádel · torneos ----------
// Formato de cada partido del torneo: a 4 games (un set corto), a 1 set o al mejor de 3 sets.
export type PadelFormat = 'g4' | 's1' | 'bo3'

export interface PadelTPair {
  id: string
  players: [string, string]
}

/** Un partido del fixture de la liga o de un grupo: fecha (`r`) y las dos parejas. */
export interface PadelTGame {
  r: number
  a: string
  b: string
}

export interface PadelTournament {
  id: string
  name: string
  format: 'league' | 'knockout' | 'groups' // liga · eliminación directa · grupos + eliminación
  pairs: PadelTPair[] // en eliminación directa, en orden de cabeza de serie
  games: PadelTGame[] | null // liga: el fixture completo
  groups: Array<{ name: string; ids: string[]; games: PadelTGame[] }> | null
  advance: 1 | 2 | 3 | 'all' | null // grupos: cuántos pasan de cada grupo
  // Formato de los partidos: `rr` para la liga o los grupos; `ko` por ronda, según cuántos cruces tiene (1 final, 2 semis, 4 cuartos…).
  formats: { rr: PadelFormat; ko: Record<string, PadelFormat> }
  // Puntos de la tabla del torneo (liga o grupos). No tocan el ranking general.
  points: { win: number; draw: number; loss: number }
  deuce: 'oro' | 'ventaja' // 40 iguales: punto de oro o deuce (ventaja)
  // Sets a 4 games: en 3-3 tie-break (termina 4-3) o siguen hasta 4-4 y recién ahí tie-break (termina 5-3 o 5-4). Sin el campo, 3.
  tiebreak4?: 3 | 4
  date: number | null
  place: string | null
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
}

// ---------- Golf ----------
export type GolfMode = 'match' | 'fourball' | 'scramble' | 'sixes' | 'solo' | 'medal' | 'stableford'

export interface GolfHole {
  par: number
  si: number // índice de dificultad del hoyo (1 = el más difícil)
  yards?: number | null // largo en yardas desde los tees de hombres (en golf, siempre yardas)
  tip?: string | null // consejo de caddy
  mapRef?: string | null // hoyo en el mapa del club (public/golf/mapas/<club>.json)
}

export interface GolfCourse {
  id: string
  name: string
  holes: GolfHole[] // 9 o 18
  archived: boolean
  club?: string | null // mapa del club (public/golf/mapas/<club>.json)
  mapCourse?: string | null // recorrido dentro del mapa (ej. 'C' Colorada, 'Azul')
  source?: string | null // de dónde salen par, dificultad y yardas
  lastProposal?: string
  updatedAt: number
}

export interface GolfCard {
  strokes: Array<number | null> // golpes por hoyo (null = sin cargar)
  total: number | null // si se cargó sólo el total (medal y scramble)
  hcp: number // hándicap usado en esta ronda (en scramble, el del equipo)
}

export interface GolfEntrant {
  id: string // en modalidades individuales es el id del jugador; en equipos, 't1', 't2'...
  players: string[]
}

export interface GolfRound {
  id: string
  playedAt: number
  status: 'DRAFT' | 'PLAYED' // DRAFT = por jugarse
  editableUntil: number | null // hasta cuándo la pueden corregir los jugadores después de guardarla jugada
  voided?: boolean // anulada por la comisión
  courseId: string | null // null = cancha cargada a mano en la ronda
  course: { name: string; holes: GolfHole[] } // copia de la cancha al momento de jugar
  mode: GolfMode
  useHcp: boolean
  entrants: GolfEntrant[]
  cards: Record<string, GolfCard> // por jugador (o por equipo en scramble)
  lines?: GolfLine[] // líneas (grupos que salen juntos); cada uno carga sus golpes en vivo
  live?: boolean // arrancó: se cargan los golpes hoyo por hoyo y todos ven cómo viene cada línea
  challengeId?: string | null // si salió de un desafío
  // "Sólo sé cómo salió": sin tarjetas, se marca el puesto de cada jugador o equipo (los empatados comparten).
  // Suma al ranking, pero no a golpes, promedios, birdies ni récords de cancha.
  resultOnly?: boolean
  places?: Record<string, number> // por participante (entrant.id): 1 = primero
  notes?: string
  lastProposal?: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  revision: number
}

export interface GolfLine {
  id: string
  players: string[]
}

export interface GolfChallenge {
  id: string
  mode: 'match' | 'fourball'
  challengers: string[] // quien desafía (1, o 2 en four ball)
  challenged: string[] // a quién desafían
  playAt: number | null
  courseId: string | null
  message: string
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED'
  roundId: string | null
  createdBy: string
  createdAt: number
  updatedAt: number
  answeredBy?: string | null
}

export interface GolfPointsConfig {
  participation: number // puntos por jugar un partido
  positions: number[] // puntos extra por puesto cuando juegan 4 o más (jugadores o equipos): [1º, 2º, 3º, ...]
  byField?: Record<string, number[]> // puntos por puesto según cuántos juegan: { '2': [5, 0], '3': [7, 3, 0] }
}

export interface GolfConfig {
  points: GolfPointsConfig
  lastProposal?: string
  updatedAt: number
}

export interface GolfPlayerDoc {
  hcp: number
  history: Array<{ at: number; hcp: number; by: string; proposalId?: string }>
  lastProposal?: string
  updatedAt: number
}

export type GolfProposalType = 'points' | 'course' | 'round_fix' | 'round_void' | 'hcp'

export interface GolfProposal {
  id: string
  type: GolfProposalType
  summary: string
  payload: Record<string, unknown>
  proposedBy: string
  approvals: Record<string, number> // quién aprobó y cuándo (quien propone ya aprueba)
  rejections: Record<string, number>
  status: 'OPEN' | 'APPLIED' | 'REJECTED' | 'WITHDRAWN'
  createdAt: number
  updatedAt: number
  appliedAt?: number | null
  appliedBy?: string | null
}


// ---------- Truco ----------
export interface TrucoLogEntry {
  t: 'A' | 'B' // a qué equipo se anotó
  n: number // cuántos puntos (negativo = se sacó)
  at: number
}

export interface TrucoMatch {
  id: string
  playedAt: number
  size: 1 | 2 | 3 // jugadores por equipo
  target: 15 | 30 // a cuántos puntos
  teamA: string[] // ids de miembro o de invitado (fmoGuests); '' = lugar vacío
  teamB: string[]
  nameA: string
  nameB: string
  scoreA: number
  scoreB: number
  log?: TrucoLogEntry[] // cada anotación del anotador (para deshacer)
  // DRAFT = armado o por jugarse · LIVE = anotando en vivo · PLAYED = terminado, cuenta para el ranking
  status: 'DRAFT' | 'LIVE' | 'PLAYED'
  resultOnly?: boolean // "Sólo sé quién ganó": sin tantos
  winner?: 'A' | 'B' | null // con resultOnly
  tournamentId?: string | null // si es un partido de un torneo
  fixtureId?: string | null // qué cruce del torneo
  entrantA?: string | null // participante del torneo que juega de A
  entrantB?: string | null
  notes?: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  revision: number
}

export interface TrucoEntrant {
  id: string
  name: string
  players: string[]
}

export interface TrucoTournament {
  id: string
  name: string
  size: 1 | 2 | 3
  target: 15 | 30
  format: 'league' | 'knockout' | 'groups' // liga · eliminación directa · grupos + eliminación
  legs: 1 | 2 // liga y grupos: sólo ida o ida y vuelta
  entrants: TrucoEntrant[] // en eliminación, en orden de cabezas de serie
  groups: Array<{ name: string; ids: string[] }> | null
  advance: 1 | 2 | 3 | 'all' | null // grupos: cuántos pasan de cada grupo
  createdBy: string
  createdAt: number
  updatedAt: number
}
