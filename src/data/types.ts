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
  // Parejas: [drive, revés]. '' = lugar vacío. Ids de miembro o de invitado (fmoGuests).
  pairA: [string, string]
  pairB: [string, string]
  sets: PadelSet[]
  status: 'DRAFT' | 'PLAYED'
  notes?: string
  createdBy: string
  updatedBy: string
  createdAt: number
  updatedAt: number
  revision: number
}
