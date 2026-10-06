// Prueba las reglas de Firestore contra el probador oficial de Firebase (no publica nada).
// Uso: GOOGLE_ACCESS_TOKEN=<token del dueño del proyecto> node scripts/test-rules.mjs
// El token se genera en la PC de Agus y nunca se guarda en el repo.
import fs from 'node:fs'

const PROJECT = 'cerrucho-comida-anual-2026'
if (!process.env.GOOGLE_ACCESS_TOKEN) {
  console.error('Falta GOOGLE_ACCESS_TOKEN (token de acceso de la cuenta dueña del proyecto de Firebase).')
  process.exit(1)
}
const tok = { access_token: process.env.GOOGLE_ACCESS_TOKEN }

const D = '/databases/(default)/documents'
const NOW = '2026-10-15T15:00:00Z'
const NOW_MS = Date.parse(NOW)

// Personas de prueba
const people = {
  agus: { uid: 'uAgus', id: 'owner', member: { status: 'active', role: 'owner' } },
  facu: { uid: 'uFacu', id: 'm-facu', member: { status: 'active', role: 'member' } },
  ana: { uid: 'uAna', id: 'm-ana', member: { status: 'active', role: 'member' } },
  susp: { uid: 'uSusp', id: 'm-susp', member: { status: 'suspended', role: 'member' } },
}

function mockGet(p, data) {
  return { function: 'get', args: [{ exactValue: D + p }], result: { value: { data } } }
}
function mockExists(p, v) {
  return { function: 'exists', args: [{ exactValue: D + p }], result: { value: v } }
}
function identityMocks(who) {
  if (!who) return []
  const p = people[who]
  return [mockExists(`/uids/${p.uid}`, true), mockGet(`/uids/${p.uid}`, { memberId: p.id }), mockGet(`/members/${p.id}`, p.member)]
}
const rolesMocks = [mockExists('/config/roles', true), mockGet('/config/roles', { presidentId: 'm-facu' })]
const award = { candidates: ['m-ana', 'm-facu'], finalists: [], electorate: ['m-ana', 'm-facu', 'owner'], state: 'ROUND1_OPEN', round1: { openAt: NOW_MS - 3600000, closeAt: NOW_MS + 3600000 } }
const awardClosed = { ...award, round1: { openAt: NOW_MS - 7200000, closeAt: NOW_MS - 3600000 } }
const awardLater = { ...award, round1: { openAt: NOW_MS + 3600000, closeAt: NOW_MS + 7200000 } }

function tc(name, who, method, p, expectation, opts = {}) {
  const request = { path: D + p, method, time: NOW }
  if (who) request.auth = { uid: people[who].uid, token: { email: 'x@miembros.cerrucho.invalid' } }
  if (opts.data) request.resource = { data: opts.data }
  const t = { request, expectation, functionMocks: [...identityMocks(who), ...rolesMocks, ...(opts.mocks ?? [])] }
  if (opts.existing) t.resource = { data: opts.existing }
  return { name, t }
}

const cases = [
  // Visitante: mira lo público, no toca nada
  tc('visitante lee miembros', null, 'get', '/members/m-ana', 'ALLOW', { existing: { alias: 'Ana' } }),
  tc('visitante lee FMO', null, 'get', '/fmoMatches/x', 'ALLOW', { existing: {} }),
  tc('visitante NO carga FMO', null, 'create', '/fmoMatches/x', 'DENY', { data: { a: 1 } }),
  tc('visitante NO ve asignaciones del regalo', null, 'get', '/editions/2026/giftAssignments/m-ana', 'DENY', { existing: { receiverId: 'm-facu' } }),
  tc('visitante NO lee datos privados', null, 'get', '/memberPrivate/m-ana', 'DENY', { existing: { username: 'ana' } }),
  tc('visitante busca un usuario para entrar', null, 'get', '/logins/ana', 'ALLOW', { existing: { memberId: 'm-ana', email: 'x' } }),
  tc('nadie lista todos los usuarios', null, 'list', '/logins/ana', 'DENY', { existing: {} }),
  tc('visitante NO ve tareas', null, 'get', '/editions/2026/tasks/t1', 'DENY', { existing: {} }),

  // Miembro: lo propio sí, lo ajeno no
  tc('miembro carga FMO', 'ana', 'create', '/fmoMatches/x', 'ALLOW', { data: { a: 1 } }),
  tc('miembro edita su perfil', 'ana', 'update', '/members/m-ana', 'ALLOW', { existing: { alias: 'Ana', role: 'member', status: 'active' }, data: { alias: 'Anita', role: 'member', status: 'active', giftPrefs: 'libros' } }),
  tc('miembro NO se hace administrador', 'ana', 'update', '/members/m-ana', 'DENY', { existing: { alias: 'Ana', role: 'member', status: 'active' }, data: { alias: 'Ana', role: 'owner', status: 'active' } }),
  tc('miembro NO edita el perfil de otro', 'ana', 'update', '/members/m-facu', 'DENY', { existing: { alias: 'Facu', role: 'member' }, data: { alias: 'Facundo', role: 'member' } }),
  tc('miembro ve su asignación', 'ana', 'get', '/editions/2026/giftAssignments/m-ana', 'ALLOW', { existing: { receiverId: 'm-facu' } }),
  tc('miembro NO ve la asignación de otro', 'ana', 'get', '/editions/2026/giftAssignments/m-facu', 'DENY', { existing: { receiverId: 'm-ana' } }),
  tc('miembro NO se vincula una cuenta', 'ana', 'create', '/uids/uOtra', 'DENY', { data: { memberId: 'm-ana' } }),
  tc('miembro NO confirma la fecha', 'ana', 'update', '/editions/2026', 'DENY', { existing: { title: 'x', date: { startsAt: null } }, data: { title: 'x', date: { startsAt: 1 } } }),
  tc('miembro NO lee resultados de premios', 'ana', 'get', '/editions/2026/awards/the_rat/private/sealed', 'DENY', { existing: { counts: {} } }),
  tc('miembro NO lee boletas ajenas', 'ana', 'get', '/editions/2026/awards/the_rat/ballots/m-facu', 'DENY', { existing: { r1: 'm-ana' } }),
  tc('miembro vota dentro del período', 'ana', 'create', '/editions/2026/awards/the_rat/ballots/m-ana', 'ALLOW', {
    data: { r1: 'm-facu', r2: null, revision: 1 },
    mocks: [mockGet('/editions/2026/awards/the_rat', award)],
  }),
  tc('miembro cambia su voto dentro del período', 'ana', 'update', '/editions/2026/awards/the_rat/ballots/m-ana', 'ALLOW', {
    existing: { r1: 'm-facu', r2: null, revision: 1 },
    data: { r1: 'NOBODY', r2: null, revision: 2 },
    mocks: [mockGet('/editions/2026/awards/the_rat', award)],
  }),
  tc('miembro NO mete voto de ballotage en primera ronda', 'ana', 'update', '/editions/2026/awards/the_rat/ballots/m-ana', 'DENY', {
    existing: { r1: 'm-facu', r2: null, revision: 1 },
    data: { r1: 'm-facu', r2: 'm-facu', revision: 2 },
    mocks: [mockGet('/editions/2026/awards/the_rat', award)],
  }),
  tc('miembro NO vota después del cierre', 'ana', 'create', '/editions/2026/awards/the_rat/ballots/m-ana', 'DENY', {
    data: { r1: 'm-facu', r2: null, revision: 1 },
    mocks: [mockGet('/editions/2026/awards/the_rat', awardClosed)],
  }),
  tc('miembro NO vota antes de que abra', 'ana', 'create', '/editions/2026/awards/the_rat/ballots/m-ana', 'DENY', {
    data: { r1: 'm-facu', r2: null, revision: 1 },
    mocks: [mockGet('/editions/2026/awards/the_rat', awardLater)],
  }),
  tc('miembro NO vota por otro', 'ana', 'create', '/editions/2026/awards/the_rat/ballots/m-facu', 'DENY', {
    data: { r1: 'm-ana', r2: null, revision: 1 },
    mocks: [mockGet('/editions/2026/awards/the_rat', award)],
  }),
  tc('miembro vota una propuesta con su propio voto', 'ana', 'update', '/editions/2026/proposals/p1', 'ALLOW', {
    existing: { label: 'Galpón', votes: { 'm-facu': 'up' }, authorId: 'owner', state: 'PENDING' },
    data: { label: 'Galpón', votes: { 'm-facu': 'up', 'm-ana': 'up' }, authorId: 'owner', state: 'PENDING' },
  }),
  tc('miembro NO cambia el voto de otro', 'ana', 'update', '/editions/2026/proposals/p1', 'DENY', {
    existing: { label: 'Galpón', votes: { 'm-facu': 'up' }, authorId: 'owner', state: 'PENDING' },
    data: { label: 'Galpón', votes: { 'm-facu': 'down' }, authorId: 'owner', state: 'PENDING' },
  }),
  tc('suspendido NO carga FMO', 'susp', 'create', '/fmoMatches/x', 'DENY', { data: { a: 1 } }),

  // Pádel: cualquiera mira, los miembros cargan
  tc('visitante lee pádel', null, 'get', '/padelMatches/x', 'ALLOW', { existing: {} }),
  tc('visitante NO carga pádel', null, 'create', '/padelMatches/x', 'DENY', { data: { bestOf: 3, status: 'DRAFT', pairA: ['', ''], pairB: ['', ''] } }),
  tc('miembro carga pádel', 'ana', 'create', '/padelMatches/x', 'ALLOW', { data: { bestOf: 3, status: 'DRAFT', pairA: ['m-ana', ''], pairB: ['', ''] } }),
  tc('miembro NO carga pádel a 2 sets', 'ana', 'create', '/padelMatches/x', 'DENY', { data: { bestOf: 2, status: 'DRAFT', pairA: ['', ''], pairB: ['', ''] } }),
  tc('miembro borra un partido de pádel', 'ana', 'delete', '/padelMatches/x', 'ALLOW', { existing: { bestOf: 3 } }),
  tc('suspendido NO carga pádel', 'susp', 'create', '/padelMatches/x', 'DENY', { data: { bestOf: 3, status: 'DRAFT', pairA: ['', ''], pairB: ['', ''] } }),

  // Presidente: confirma fecha, lugar y comida; nada más
  tc('presidente confirma la fecha', 'facu', 'update', '/editions/2026', 'ALLOW', { existing: { title: 'x', date: { startsAt: null }, decisions: {} }, data: { title: 'x', date: { startsAt: 1 }, decisions: { fecha: { status: 'CONFIRMED' } } } }),
  tc('presidente NO cambia el título de la edición', 'facu', 'update', '/editions/2026', 'DENY', { existing: { title: 'x' }, data: { title: 'y' } }),
  tc('presidente NO ve resultados de premios', 'facu', 'get', '/editions/2026/awards/the_rat/private/sealed', 'DENY', { existing: { counts: {} } }),
  tc('presidente NO ve asignaciones ajenas', 'facu', 'get', '/editions/2026/giftAssignments/m-ana', 'DENY', { existing: { receiverId: 'm-facu' } }),
  tc('presidente NO crea cuentas', 'facu', 'create', '/uids/uNueva', 'DENY', { data: { memberId: 'm-facu' } }),

  // Agus
  tc('Agus ve resultados de premios', 'agus', 'get', '/editions/2026/awards/the_rat/private/sealed', 'ALLOW', { existing: { counts: {} } }),
  tc('Agus ve todas las asignaciones', 'agus', 'get', '/editions/2026/giftAssignments/m-ana', 'ALLOW', { existing: { receiverId: 'm-facu' } }),
  tc('Agus crea accesos', 'agus', 'create', '/uids/uNueva', 'ALLOW', { data: { memberId: 'm-ana' } }),
  tc('Agus cambia el presidente', 'agus', 'update', '/config/roles', 'ALLOW', { existing: { presidentId: 'm-facu' }, data: { presidentId: 'm-ana' } }),
]

const source = fs.readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')
const res = await fetch(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}:test`, {
  method: 'POST',
  headers: { authorization: `Bearer ${tok.access_token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: source }] }, testSuite: { testCases: cases.map((c) => c.t) } }),
})
const out = await res.json()
if (!res.ok || out.issues?.some((i) => i.severity === 'ERROR')) {
  console.log('ERROR', res.status, JSON.stringify(out.issues ?? out, null, 1).slice(0, 3000))
  process.exit(1)
}
let fail = 0
out.testResults.forEach((r, i) => {
  const ok = r.state === 'SUCCESS'
  if (!ok) fail++
  console.log(`${ok ? '✓' : '✗'} ${cases[i].name}${ok ? '' : `  → ${(r.debugMessages ?? []).join(' | ').slice(0, 300)}`}`)
})
console.log(`\n${cases.length - fail} de ${cases.length} OK`)
process.exit(fail ? 1 : 0)
