// Reglas puras de cuentas: nombre de usuario, mail interno y contraseñas generadas.
import { LOGIN_DOMINIO_INTERNO, PASSWORD_MIN } from '../content/config'

/** Usuario en minúsculas, sin acentos ni espacios: letras, números, punto, guion y guion bajo. */
export function normalizeUsername(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/^[._-]+|[._-]+$/g, '')
}

export function validateUsername(u: string): string | null {
  if (u.length < 2) return 'El usuario tiene que tener al menos 2 letras.'
  if (u.length > 24) return 'El usuario puede tener hasta 24 caracteres.'
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(u)) return 'Usá sólo letras, números, punto o guion.'
  return null
}

export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `La contraseña tiene que tener al menos ${PASSWORD_MIN} caracteres.`
  if (pw.length > 64) return 'La contraseña es demasiado larga.'
  return null
}

/** Mail interno de una cuenta. Cada reseteo crea una cuenta nueva con otro sufijo. */
export function authEmailFor(username: string, suffix: string): string {
  return `${username}.${suffix}@${LOGIN_DOMINIO_INTERNO}`
}

export function isInternalEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith('@' + LOGIN_DOMINIO_INTERNO)
}

function randomIndex(max: number): number {
  const buf = new Uint32Array(1)
  const limit = 0x100000000 - (0x100000000 % max)
  let v: number
  do {
    crypto.getRandomValues(buf)
    v = buf[0]
  } while (v >= limit)
  return v % max
}

/** Sufijo aleatorio corto para el mail interno. */
export function randomSuffix(len = 6): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[randomIndex(chars.length)]
  return out
}

/** Contraseña inicial fácil de dictar por WhatsApp: palabra + número (ej. "fernet-4827"). */
export function generatePassword(): string {
  const words = ['fernet', 'asado', 'picada', 'cerrucho', 'gol', 'banda', 'birra', 'choripan', 'vacio', 'tango', 'mate', 'previa']
  const n = 1000 + randomIndex(9000)
  return `${words[randomIndex(words.length)]}-${n}`
}
