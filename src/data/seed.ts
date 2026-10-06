// Seed idempotente: crea la edición, categorías, tareas y borradores de miembros
// si no existen. Nunca abre votaciones, manda mails ni sortea. Lo corre el
// propietario en su primera entrada (y el modo demo al iniciar).
import {
  AGUA_ML_POR_ASISTENTE,
  EXTRAS_FINOS,
  HIELO_G_POR_ASISTENTE,
  INGREDIENTES,
  RECETAS,
  RESERVA_COMPRA_PCT,
} from '../content/bebidas'
import { COMIDAS_INICIALES, EDICION_ACTUAL, FECHAS_CANDIDATAS, GRUPO, LUGARES_INICIALES, MIEMBROS_INICIALES, PRESIDENTE_INICIAL, QUORUM_LOGISTICO_PCT, REGALO_TOLERANCIA_PCT } from '../content/config'
import { CATEGORIAS_INICIALES, VAO_ACTIVO } from '../content/premios'
import { AGENDA_PLANTILLA, TAREAS_PLANTILLA } from '../content/tareas'
import type { DataAdapter } from './adapter'
import { P } from './paths'
import type { Award, Edition, GiftCampaign, Member, Poll, PollOption, Proposal, RolesConfig, Task } from './types'
import { fmtDayLong } from '../domain/format'

export const OWNER_ID = 'owner'

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function newEdition(slug: string, year: number, title: string, now: number): Edition {
  return {
    slug,
    title,
    year,
    state: 'DRAFT',
    planVersion: 1,
    heroPhoto: EDICION_ACTUAL.heroFoto,
    date: { startsAt: null, confirmedAt: null, confirmedBy: null },
    venue: null,
    menu: null,
    afterparty: null,
    agenda: AGENDA_PLANTILLA.map((a) => ({ ...a, startsAt: null, responsibleId: null })),
    agendaPublished: false,
    beverage: {
      recipes: RECETAS,
      ingredients: INGREDIENTES,
      reservePct: RESERVA_COMPRA_PCT,
      waterMlPerAttendee: AGUA_ML_POR_ASISTENTE,
      iceGPerAttendee: HIELO_G_POR_ASISTENTE,
      stock: {},
      prices: {},
      pendingScenario: 0,
      extras: EXTRAS_FINOS,
      responsible: {},
      bought: {},
      state: 'OPEN',
      closeAt: null,
      snapshot: null,
    },
    decisions: {
      fecha: { status: 'UNDEFINED' },
      lugar: { status: 'UNDEFINED' },
      menu: { status: 'UNDEFINED' },
      regalo: { status: 'UNDEFINED' },
      premios: { status: 'UNDEFINED' },
      salida: { status: 'UNDEFINED' },
    },
    companionsEnabled: false,
    vaoRosterConfirmed: false,
    dietarySummary: null,
    news: [],
    createdAt: now,
    updatedAt: now,
    version: 1,
  }
}

export function newAward(c: (typeof CATEGORIAS_INICIALES)[number], now: number): Award {
  return {
    code: c.code,
    label: c.label,
    description: c.description,
    eligibility: c.eligibility,
    order: c.order,
    enabled: true,
    anioSiguiente: c.anioSiguiente ?? false,
    state: 'DRAFT',
    candidates: [],
    electorate: [],
    round1: null,
    round2: null,
    finalists: null,
    result: null,
    revealedAt: null,
    version: 1,
    completedCount: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function newGift(now: number): GiftCampaign {
  return {
    state: 'DRAFT',
    amountCents: null,
    tolerancePct: REGALO_TOLERANCIA_PCT,
    enrollCloseAt: null,
    drawVersion: 0,
    roster: [],
    budgetVersion: 1,
    stats: { participants: 0, viewed: 0, ready: 0, delivered: 0 },
    version: 1,
    updatedAt: now,
  }
}

export function newMember(id: string, alias: string, now: number, over: Partial<Member> = {}): Member {
  return {
    id,
    alias,
    status: 'draft',
    role: 'member',
    participating: true,
    vao: false,
    photo: null,
    birthday: null,
    giftPrefs: '',
    profileDone: false,
    hasLogin: false,
    createdAt: now,
    updatedAt: now,
    version: 1,
    ...over,
  }
}

/** Crea la edición y sus plantillas si no existen. */
export async function ensureEdition(db: DataAdapter, slug: string = EDICION_ACTUAL.slug, year: number = EDICION_ACTUAL.anio, title: string = EDICION_ACTUAL.titulo) {
  const now = Date.now()
  const existing = await db.getDoc<Edition>(P.edition(slug))
  if (!existing) {
    await db.setDoc(P.edition(slug), newEdition(slug, year, title, now))
    await seedProposals(db, slug, now)
  }
  if (!(await db.getDoc<RolesConfig>(P.roles))) {
    const pres = await db.getDoc<Member>(P.member(PRESIDENTE_INICIAL))
    await db.setDoc<RolesConfig>(P.roles, { presidentId: pres ? PRESIDENTE_INICIAL : null, updatedAt: now })
  }
  const awards = await db.getCollection<Award>(P.awards(slug))
  if (awards.length === 0) {
    for (const c of CATEGORIAS_INICIALES.filter((x) => VAO_ACTIVO || x.eligibility !== 'VAO')) await db.setDoc(P.award(slug, c.code), newAward(c, now))
  }
  const tasks = await db.getCollection<Task>(P.tasks(slug))
  if (tasks.length === 0) {
    let order = 0
    for (const t of TAREAS_PLANTILLA) {
      const id = slugify(t.title)
      const task: Task = {
        id,
        title: t.title,
        description: t.description ?? '',
        quantity: t.quantity ?? null,
        unit: t.unit ?? '',
        dueAt: null,
        capacity: t.capacity,
        status: 'DRAFT',
        volunteers: {},
        estimatedCostCents: null,
        order: order++,
        createdAt: now,
        updatedAt: now,
      }
      await db.setDoc(P.task(slug, id), task)
    }
  }
  if (!(await db.getDoc(P.gift(slug)))) await db.setDoc(P.gift(slug), newGift(now))
  await ensureDatesPoll(db, slug)
}

/** Opciones de fecha: todos los días de la semana indicados entre `desde` y `hasta`, a la hora dada (Buenos Aires). */
export function datesOptions(cfg = FECHAS_CANDIDATAS): PollOption[] {
  const [hh, mm] = cfg.hora.split(':').map(Number)
  const [y1, m1, d1] = cfg.desde.split('-').map(Number)
  const [y2, m2, d2] = cfg.hasta.split('-').map(Number)
  const out: PollOption[] = []
  for (let t = Date.UTC(y1, m1 - 1, d1); t <= Date.UTC(y2, m2 - 1, d2); t += 86400000) {
    const d = new Date(t)
    if (!cfg.diasSemana.includes(d.getUTCDay())) continue
    const startsAt = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh + 3, mm)
    out.push({ id: 'd-' + d.toISOString().slice(0, 10), label: fmtDayLong(startsAt), detail: 'A la noche', startsAt, special: null })
  }
  return out
}

/** Consulta de disponibilidad inicial, abierta para todos los miembros activos que participan. */
export async function ensureDatesPoll(db: DataAdapter, slug: string) {
  const id = 'fechas-' + slug
  if (await db.getDoc(P.poll(slug, id))) return
  const now = Date.now()
  const [y, m, d] = FECHAS_CANDIDATAS.cierreConsulta.split('-').map(Number)
  const closeAt = Date.UTC(y, m - 1, d, 23 + 3, 59)
  const poll: Poll = {
    id,
    kind: 'dates',
    title: '¿Qué día nos juntamos?',
    description: 'Marcá todas las fechas en las que podés. Son jueves, viernes y sábados, siempre a la noche. Estar disponible todavía no confirma asistencia.',
    method: 'AVAILABILITY',
    state: 'OPEN',
    options: datesOptions(),
    electorate: [],
    electorateMode: 'ALL_ACTIVE',
    audience: 'ALL',
    openAt: now,
    closeAt,
    quorumPct: QUORUM_LOGISTICO_PCT,
    version: 1,
    closure: null,
    decision: null,
    createdAt: now,
    updatedAt: now,
  }
  await db.setDoc(P.poll(slug, id), poll)
  await db.updateDoc(P.edition(slug), { 'decisions.fecha': { status: 'VOTING', pollId: id }, state: 'ORGANIZING', updatedAt: now })
}

/** Opciones iniciales de lugar y comida, cargadas por el administrador (ids fijos: no se duplican). */
export async function seedProposals(db: DataAdapter, slug: string, now = Date.now()) {
  const items: Array<{ type: Proposal['type']; label: string }> = [
    ...LUGARES_INICIALES.map((label) => ({ type: 'venue' as const, label })),
    ...COMIDAS_INICIALES.map((label) => ({ type: 'food' as const, label })),
  ]
  for (const it of items) {
    const id = `seed-${it.type}-${slugify(it.label)}`
    if (await db.getDoc(P.proposal(slug, id))) continue
    const p: Proposal = { id, type: it.type, authorId: OWNER_ID, label: it.label, detail: '', link: '', state: 'PENDING', votes: {}, seed: true, createdAt: now, updatedAt: now }
    await db.setDoc(P.proposal(slug, id), p)
  }
}

/** Sólo para el modo demo: crea al propietario y los miembros iniciales. */
export async function ensureOwnerAndDrafts(db: DataAdapter) {
  const now = Date.now()
  const owner = await db.getDoc<Member>(P.member(OWNER_ID))
  if (!owner) await db.setDoc(P.member(OWNER_ID), newMember(OWNER_ID, GRUPO.ownerAlias, now, { status: 'active', role: 'owner', hasLogin: true }))
  const members = await db.getCollection<Member>(P.members)
  if (members.filter((m) => m.id !== OWNER_ID).length === 0) {
    for (const m of MIEMBROS_INICIALES) {
      const id = 'm-' + slugify(m.alias)
      await db.setDoc(P.member(id), newMember(id, m.alias, now, { name: m.nombre }))
    }
  }
}
