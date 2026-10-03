// Tipos de los documentos guardados en Firestore (o en el modo demo).
// Todas las fechas son milisegundos UTC (number). Importes en centavos (number).

export type Role = 'owner' | 'member'
export type MemberStatus = 'draft' | 'active' | 'suspended'

export interface Member {
  id: string
  alias: string
  name?: string
  status: MemberStatus
  role: Role
  uid?: string | null
  participating: boolean // participa de la edición actual
  vao: boolean // fue al Viaje Anual Obligatorio
  avatarColor?: string
  hasEmail: boolean
  consentAt?: number | null
  createdAt: number
  updatedAt: number
  version: number
}

export interface MemberPrivate {
  email: string // normalizado en minúsculas
  invitedAt?: number | null
  notes?: string
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
  label: string
  detail?: string
  link?: string
  startsAt?: number | null
  state: ProposalState
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
  portions: number
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
