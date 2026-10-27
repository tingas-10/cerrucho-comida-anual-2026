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
  facuAdmin: { uid: 'uFacuA', id: 'm-facu', member: { status: 'active', role: 'owner' } }, // presidente y administrador (desde el 27/10)
  ana: { uid: 'uAna', id: 'm-ana', member: { status: 'active', role: 'member' } },
  susp: { uid: 'uSusp', id: 'm-susp', member: { status: 'suspended', role: 'member' } },
  pipe: { uid: 'uPipe', id: 'm-pipe', member: { status: 'active', role: 'member' } },
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
const rolesMocks = [mockExists('/config/roles', true), mockGet('/config/roles', { presidentId: 'm-facu', golfCommission: ['m-ana', 'm-facu'] })]
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

  // Golf: rondas de cualquiera; jugadas se corrigen 48 h; después, la comisión con 2 aprobaciones
  tc('visitante lee rondas de golf', null, 'get', '/golfRounds/r1', 'ALLOW', { existing: {} }),
  tc('visitante NO arma rondas', null, 'create', '/golfRounds/r1', 'DENY', { data: { status: 'DRAFT', voided: false } }),
  tc('miembro arma una ronda', 'pipe', 'create', '/golfRounds/r1', 'ALLOW', { data: { status: 'DRAFT', voided: false } }),
  tc('miembro NO crea una ronda ya jugada', 'pipe', 'create', '/golfRounds/r1', 'DENY', { data: { status: 'PLAYED', voided: false } }),
  tc('miembro guarda el resultado con 48 h para corregir', 'pipe', 'update', '/golfRounds/r1', 'ALLOW', { existing: { status: 'DRAFT', voided: false }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS + 48 * 3600000 } }),
  tc('miembro NO se da una semana para corregir', 'pipe', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'DRAFT', voided: false }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS + 7 * 86400000 } }),
  tc('miembro corrige dentro del plazo', 'pipe', 'update', '/golfRounds/r1', 'ALLOW', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS + 3600000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS + 3600000, cards: { a: 1 } } }),
  tc('miembro NO corrige pasado el plazo', 'pipe', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, cards: { a: 1 } } }),
  tc('miembro NO anula una ronda', 'pipe', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS + 3600000 }, data: { status: 'PLAYED', voided: true, editableUntil: NOW_MS + 3600000 } }),
  tc('comisión corrige con 2 aprobaciones', 'ana', 'update', '/golfRounds/r1', 'ALLOW', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, cards: { a: 2 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { roundId: 'r1', cards: { a: 2 } } })] }),
  tc('comisión NO corrige con 1 sola aprobación', 'ana', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, cards: { a: 2 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1 }, payload: { roundId: 'r1', cards: { a: 2 } } })] }),
  tc('comisión NO aplica una tarjeta distinta a la aprobada', 'ana', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, cards: { a: 9 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { roundId: 'r1', cards: { a: 2 } } })] }),
  tc('comisión corrige los puestos de un partido sin tarjetas', 'ana', 'update', '/golfRounds/r1', 'ALLOW', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, resultOnly: true, places: { a: 1, b: 2 } }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, resultOnly: true, cards: {}, places: { a: 2, b: 1 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { roundId: 'r1', cards: {}, places: { a: 2, b: 1 } } })] }),
  tc('comisión NO aplica puestos distintos a los aprobados', 'ana', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, resultOnly: true, places: { a: 1, b: 2 } }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, resultOnly: true, cards: {}, places: { a: 1, b: 1 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { roundId: 'r1', cards: {}, places: { a: 2, b: 1 } } })] }),
  tc('fuera de la comisión NO usa una propuesta aprobada', 'pipe', 'update', '/golfRounds/r1', 'DENY', { existing: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000 }, data: { status: 'PLAYED', voided: false, editableUntil: NOW_MS - 1000, cards: { a: 2 }, lastProposal: 'gp1' }, mocks: [mockGet('/golfProposals/gp1', { status: 'OPEN', type: 'round_fix', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { roundId: 'r1', cards: { a: 2 } } })] }),
  tc('miembro carga su hándicap', 'pipe', 'update', '/golfPlayers/m-pipe', 'ALLOW', { existing: { hcp: 20 }, data: { hcp: 18 } }),
  tc('miembro carga el hándicap de un invitado', 'pipe', 'create', '/golfPlayers/g-primo', 'ALLOW', { data: { hcp: 30 } }),
  tc('miembro NO cambia el hándicap de otro', 'pipe', 'update', '/golfPlayers/m-ana', 'DENY', { existing: { hcp: 20 }, data: { hcp: 2 } }),
  tc('comisión cambia un hándicap aprobado', 'ana', 'update', '/golfPlayers/m-pipe', 'ALLOW', { existing: { hcp: 20 }, data: { hcp: 16, lastProposal: 'gp2' }, mocks: [mockGet('/golfProposals/gp2', { status: 'OPEN', type: 'hcp', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { playerId: 'm-pipe', hcp: 16 } })] }),
  tc('comisionado propone', 'ana', 'create', '/golfProposals/gp3', 'ALLOW', { data: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1 }, rejections: {} } }),
  tc('fuera de la comisión NO propone', 'pipe', 'create', '/golfProposals/gp3', 'DENY', { data: { proposedBy: 'm-pipe', status: 'OPEN', approvals: { 'm-pipe': 1 }, rejections: {} } }),
  tc('nadie propone con aprobaciones ajenas', 'ana', 'create', '/golfProposals/gp3', 'DENY', { data: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1, 'm-facu': 1 }, rejections: {} } }),
  tc('otro comisionado aprueba', 'facu', 'update', '/golfProposals/gp3', 'ALLOW', { existing: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1 }, rejections: {}, updatedAt: 1 }, data: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1, 'm-facu': 2 }, rejections: {}, updatedAt: 2 } }),
  tc('NO se aprueba en nombre de otro', 'facu', 'update', '/golfProposals/gp3', 'DENY', { existing: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1 }, rejections: {}, updatedAt: 1 }, data: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1, 'm-otro': 2 }, rejections: {}, updatedAt: 2 } }),
  tc('NO se marca aplicada con 1 aprobación', 'ana', 'update', '/golfProposals/gp3', 'DENY', { existing: { proposedBy: 'm-ana', status: 'OPEN', approvals: { 'm-ana': 1 }, rejections: {}, updatedAt: 1 }, data: { proposedBy: 'm-ana', status: 'APPLIED', approvals: { 'm-ana': 1 }, rejections: {}, updatedAt: 2, appliedAt: 2, appliedBy: 'm-ana' } }),
  tc('comisión cambia el sistema de puntos aprobado', 'ana', 'update', '/config/golf', 'ALLOW', { existing: { points: { participation: 1, positions: [10, 6, 4] } }, data: { points: { participation: 2, positions: [12, 8] }, lastProposal: 'gp4' }, mocks: [mockGet('/golfProposals/gp4', { status: 'OPEN', type: 'points', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { points: { participation: 2, positions: [12, 8] } } })] }),
  tc('comisión NO pone puntos distintos a los aprobados', 'ana', 'update', '/config/golf', 'DENY', { existing: { points: { participation: 1, positions: [10, 6, 4] } }, data: { points: { participation: 50, positions: [12, 8] }, lastProposal: 'gp4' }, mocks: [mockGet('/golfProposals/gp4', { status: 'OPEN', type: 'points', approvals: { 'm-ana': 1, 'm-facu': 2 }, payload: { points: { participation: 2, positions: [12, 8] } } })] }),
  tc('miembro NO cambia el sistema de puntos', 'pipe', 'update', '/config/golf', 'DENY', { existing: { points: {} }, data: { points: { participation: 9, positions: [] } } }),

  // Golf: desafíos
  tc('miembro desafía', 'pipe', 'create', '/golfChallenges/c1', 'ALLOW', { data: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'PENDING', mode: 'match' } }),
  tc('NO se desafía en nombre de otro', 'pipe', 'create', '/golfChallenges/c1', 'DENY', { data: { createdBy: 'm-pipe', challengers: ['m-ana'], challenged: ['m-facu'], status: 'PENDING', mode: 'match' } }),
  tc('el desafiado acepta', 'ana', 'update', '/golfChallenges/c1', 'ALLOW', { existing: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'PENDING', mode: 'match' }, data: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'ACCEPTED', mode: 'match', roundId: 'r9' } }),
  tc('quien desafió NO acepta por el otro', 'pipe', 'update', '/golfChallenges/c1', 'DENY', { existing: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'PENDING', mode: 'match' }, data: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'ACCEPTED', mode: 'match' } }),
  tc('quien desafió cancela', 'pipe', 'update', '/golfChallenges/c1', 'ALLOW', { existing: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'PENDING', mode: 'match' }, data: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'CANCELLED', mode: 'match' } }),
  tc('un tercero NO responde', 'facu', 'update', '/golfChallenges/c1', 'DENY', { existing: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'PENDING', mode: 'match' }, data: { createdBy: 'm-pipe', challengers: ['m-pipe'], challenged: ['m-ana'], status: 'DECLINED', mode: 'match' } }),
  tc('en vivo: un jugador guarda su tarjeta', 'pipe', 'update', '/golfRounds/r1', 'ALLOW', { existing: { status: 'DRAFT', voided: false, live: true }, data: { status: 'DRAFT', voided: false, live: true, cards: { 'm-pipe': { strokes: [4] } } } }),

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
  tc('Facu administrador sortea (escribe asignaciones)', 'facuAdmin', 'create', '/editions/2026/giftAssignments/m-ana', 'ALLOW', { data: { receiverId: 'm-pipe', version: 1 } }),
  tc('Facu administrador NO ve asignaciones ajenas', 'facuAdmin', 'get', '/editions/2026/giftAssignments/m-ana', 'DENY', { existing: { receiverId: 'm-facu' } }),
  tc('Facu administrador ve la suya', 'facuAdmin', 'get', '/editions/2026/giftAssignments/m-facu', 'ALLOW', { existing: { receiverId: 'm-ana' } }),
  tc('Facu administrador NO ve resultados de premios', 'facuAdmin', 'get', '/editions/2026/awards/cerrucho/private/sealed', 'DENY', { existing: { winner: 'm-ana' } }),
  tc('Facu administrador abre la votación de premios', 'facuAdmin', 'update', '/editions/2026/awards/cerrucho', 'ALLOW', { existing: { state: 'DRAFT' }, data: { state: 'ROUND1_OPEN' } }),
  tc('Agus hace administrador a Facu', 'agus', 'update', '/members/m-facu', 'ALLOW', { existing: { alias: 'Facu', role: 'member', status: 'active' }, data: { alias: 'Facu', role: 'owner', status: 'active' } }),
  tc('Facu administrador NO nombra otro administrador', 'facuAdmin', 'update', '/members/m-ana', 'DENY', { existing: { alias: 'Ana', role: 'member', status: 'active' }, data: { alias: 'Ana', role: 'owner', status: 'active' } }),
  tc('Facu administrador NO toca la ficha de Agus', 'facuAdmin', 'update', '/members/owner', 'DENY', { existing: { alias: 'Tingas', role: 'owner', status: 'active' }, data: { alias: 'Tingas', role: 'owner', status: 'suspended' } }),
  tc('Facu administrador edita a un miembro', 'facuAdmin', 'update', '/members/m-ana', 'ALLOW', { existing: { alias: 'Ana', role: 'member', status: 'active' }, data: { alias: 'Anita', role: 'member', status: 'active' } }),
  tc('Facu administrador NO crea un administrador', 'facuAdmin', 'create', '/members/m-nuevo', 'DENY', { data: { alias: 'Nuevo', role: 'owner', status: 'draft' } }),
  tc('Facu administrador crea un miembro', 'facuAdmin', 'create', '/members/m-nuevo', 'ALLOW', { data: { alias: 'Nuevo', role: 'member', status: 'draft' } }),
  tc('presidente sortea el amigo invisible', 'facu', 'create', '/editions/2026/giftAssignments/m-ana', 'ALLOW', { data: { receiverId: 'm-pipe', version: 1 } }),
  tc('presidente publica el sorteo', 'facu', 'update', '/editions/2026/gift/campaign', 'ALLOW', { existing: { state: 'DRAFT', drawVersion: 0 }, data: { state: 'DRAW_PUBLISHED', drawVersion: 1 } }),
  tc('miembro NO sortea', 'ana', 'create', '/editions/2026/giftAssignments/m-pipe', 'DENY', { data: { receiverId: 'm-ana', version: 1 } }),
  tc('presidente abre la votación de premios', 'facu', 'update', '/editions/2026/awards/cerrucho', 'ALLOW', { existing: { state: 'DRAFT', version: 1 }, data: { state: 'ROUND1_OPEN', version: 2, candidates: ['m-ana'], electorate: ['m-ana'], round1: { openAt: 1, closeAt: 2 } } }),
  tc('presidente NO cuenta ni cierra premios', 'facu', 'update', '/editions/2026/awards/cerrucho', 'DENY', { existing: { state: 'ROUND1_OPEN', version: 2 }, data: { state: 'SEALED', version: 3 } }),
  tc('miembro NO abre la votación de premios', 'ana', 'update', '/editions/2026/awards/cerrucho', 'DENY', { existing: { state: 'DRAFT', version: 1 }, data: { state: 'ROUND1_OPEN', version: 2 } }),
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
