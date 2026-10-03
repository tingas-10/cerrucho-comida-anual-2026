import { describe, expect, it } from 'vitest'
import { drawSecretSanta, rosterHash, validateDraw } from './gift'

describe('amigo invisible · sorteo', () => {
  it('rechaza con menos de 3', () => {
    expect(() => drawSecretSanta(['a', 'b'])).toThrow('GIFT_MIN_PARTICIPANTS')
  })
  it('3 y 23 participantes: cada uno da y recibe uno, nunca a sí mismo', () => {
    for (const n of [3, 23]) {
      const roster = Array.from({ length: n }, (_, i) => `m${i}`)
      for (let k = 0; k < 50; k++) {
        const r = drawSecretSanta(roster)
        expect(validateDraw(roster, r.pairs)).toBeNull()
      }
    }
  })
  it('valida un batch inválido', () => {
    expect(validateDraw(['a', 'b', 'c'], [{ giverId: 'a', receiverId: 'a' }, { giverId: 'b', receiverId: 'c' }, { giverId: 'c', receiverId: 'b' }])).toBe('Autoasignación')
    expect(validateDraw(['a', 'b', 'c'], [{ giverId: 'a', receiverId: 'b' }, { giverId: 'b', receiverId: 'b' }, { giverId: 'c', receiverId: 'a' }])).not.toBeNull()
  })
  it('el hash del padrón no depende del orden', async () => {
    expect(await rosterHash(['b', 'a'], 1)).toBe(await rosterHash(['a', 'b'], 1))
    expect(await rosterHash(['a', 'b'], 1)).not.toBe(await rosterHash(['a', 'b'], 2))
  })
})
