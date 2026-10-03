// Sorteo del amigo invisible: permutación uniforme sin autoasignación.
// Usa crypto.getRandomValues (nunca Math.random). Corre en el navegador de Agus
// al cerrar la inscripción; el resultado se guarda por dador y nadie más lo ve.
import { REGALO_MIN_PARTICIPANTES } from '../content/config'

function randomInt(maxExclusive: number): number {
  // Entero uniforme en [0, maxExclusive) sin sesgo de módulo.
  const range = 0x100000000
  const limit = range - (range % maxExclusive)
  const buf = new Uint32Array(1)
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % maxExclusive
}

export function shuffleCrypto<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export interface DrawResult {
  pairs: Array<{ giverId: string; receiverId: string }>
  attempts: number
}

export function drawSecretSanta(participants: string[], maxAttempts = 10000): DrawResult {
  const roster = Array.from(new Set(participants))
  if (roster.length < REGALO_MIN_PARTICIPANTES) throw new Error('GIFT_MIN_PARTICIPANTS')
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const receivers = shuffleCrypto(roster)
    if (roster.every((g, i) => g !== receivers[i])) {
      return { pairs: roster.map((g, i) => ({ giverId: g, receiverId: receivers[i] })), attempts: attempt }
    }
  }
  throw new Error('GIFT_DRAW_FAILED')
}

export function validateDraw(roster: string[], pairs: Array<{ giverId: string; receiverId: string }>): string | null {
  const set = new Set(roster)
  if (pairs.length !== set.size) return 'Cantidad de asignaciones incorrecta'
  const givers = new Set<string>()
  const receivers = new Set<string>()
  for (const p of pairs) {
    if (!set.has(p.giverId) || !set.has(p.receiverId)) return 'Persona fuera del padrón'
    if (p.giverId === p.receiverId) return 'Autoasignación'
    givers.add(p.giverId)
    receivers.add(p.receiverId)
  }
  if (givers.size !== set.size || receivers.size !== set.size) return 'Repetidos'
  return null
}

/** Hash simple y estable del padrón (ids ordenados + versión de presupuesto). */
export async function rosterHash(roster: string[], budgetVersion: number): Promise<string> {
  const text = [...roster].sort().join('|') + '#' + budgetVersion
  const data = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
