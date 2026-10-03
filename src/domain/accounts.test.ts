import { describe, expect, it } from 'vitest'
import type { Poll } from '../data/types'
import { authEmailFor, generatePassword, isInternalEmail, normalizeUsername, validatePassword, validateUsername } from './accounts'
import { byMonth, daysUntil, isValidBirthday, upcoming } from './birthdays'
import { bestDates, fillPending, summarizeDates, validateResponse } from './polls'

describe('cuentas', () => {
  it('normaliza el usuario: minúsculas, sin acentos ni espacios', () => {
    expect(normalizeUsername('  Tomás Ñandú ')).toBe('tomas.nandu')
    expect(normalizeUsername('Facu_C')).toBe('facu_c')
    expect(normalizeUsername('pay!!')).toBe('pay')
  })
  it('valida usuario y contraseña', () => {
    expect(validateUsername('f')).not.toBeNull()
    expect(validateUsername('facu')).toBeNull()
    expect(validatePassword('12345')).not.toBeNull()
    expect(validatePassword('fernet-1234')).toBeNull()
  })
  it('el mail interno es inventado y reconocible', () => {
    const e = authEmailFor('facu', 'abc123')
    expect(e).toBe('facu.abc123@miembros.cerrucho.invalid')
    expect(isInternalEmail(e)).toBe(true)
    expect(isInternalEmail('agustin@abndigital.com.ar')).toBe(false)
  })
  it('genera contraseñas válidas', () => {
    for (let i = 0; i < 20; i++) expect(validatePassword(generatePassword())).toBeNull()
  })
})

describe('cumpleaños', () => {
  // 3 de octubre de 2026, 12:00 en Buenos Aires
  const now = Date.UTC(2026, 9, 3, 15)
  it('valida día y mes', () => {
    expect(isValidBirthday(31, 4)).toBe(false)
    expect(isValidBirthday(29, 2)).toBe(true)
    expect(isValidBirthday(0, 1)).toBe(false)
  })
  it('días hasta el próximo cumple', () => {
    expect(daysUntil({ d: 3, m: 10 }, now)).toBe(0)
    expect(daysUntil({ d: 4, m: 10 }, now)).toBe(1)
    expect(daysUntil({ d: 2, m: 10 }, now)).toBe(364)
  })
  it('agrupa por mes y ordena los próximos', () => {
    const people = [
      { id: 'a', birthday: { d: 20, m: 10 } },
      { id: 'b', birthday: { d: 5, m: 10 } },
      { id: 'c', birthday: { d: 1, m: 1 } },
      { id: 'd', birthday: null },
    ]
    expect(byMonth(people).map((g) => [g.month, g.people.map((p) => p.id)])).toEqual([
      [1, ['c']],
      [10, ['b', 'a']],
    ])
    expect(upcoming(people, 2, now).map((p) => p.id)).toEqual(['b', 'a'])
  })
})

describe('fechas: disponibilidad', () => {
  const poll = {
    id: 'p',
    options: [
      { id: 'd1', label: 'Jue' },
      { id: 'd2', label: 'Vie' },
      { id: 'd3', label: 'Sáb' },
    ],
    method: 'AVAILABILITY',
  } as unknown as Poll
  it('se puede responder de a una fecha (lo demás queda pendiente)', () => {
    expect(validateResponse(poll, { d1: 'yes' })).toBeNull()
    expect(validateResponse(poll, { d9: 'yes' })).not.toBeNull()
    expect(validateResponse(poll, { d1: 'quizas' as never })).not.toBeNull()
  })
  it('marcar pendientes no pisa lo ya respondido', () => {
    expect(fillPending(poll, { d1: 'no' }, 'yes')).toEqual({ d1: 'no', d2: 'yes', d3: 'yes' })
  })
  it('sin respuesta es pendiente, nunca "no puedo"; capaz no cuenta como confirmado', () => {
    const responses = [
      { id: 'ana', payload: { d1: 'yes', d2: 'maybe' }, revision: 1, updatedAt: 0 },
      { id: 'beto', payload: { d1: 'yes' }, revision: 1, updatedAt: 0 },
    ]
    const s = summarizeDates(poll, responses as never, ['ana', 'beto', 'caro'])
    expect(s[0]).toMatchObject({ yes: ['ana', 'beto'], maybe: [], no: [], pending: ['caro'] })
    expect(s[1]).toMatchObject({ yes: [], maybe: ['ana'], pending: ['beto', 'caro'] })
    expect(bestDates(s).map((x) => x.optionId)).toEqual(['d1'])
  })
})
