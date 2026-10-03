// Premios: se vota dentro del período que define Agus. Los resultados nunca se publican:
// los ve sólo Agus y los anuncia en la comida. Acá cada uno ve el estado y su propio voto.
import { useMemo, useState } from 'react'
import { TEXTOS } from '../content/config'
import { NOBODY, NOBODY_LABEL, VAO_ACTIVO } from '../content/premios'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDocs, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Award, Ballot } from '../data/types'
import { stableShuffle } from '../domain/awards'
import { fmtDateTime, timeLeft } from '../domain/format'
import { Card, Empty, Loading, LoginPrompt, MemberAvatar, Notice, PageHeader, Pill, Progress } from '../ui/components'
import { useToast } from '../ui/toast'

export function awardTitle(a: Award, year: number): string {
  return a.anioSiguiente ? `${a.label} ${year + 1}` : a.label
}

type Phase = 'draft' | 'scheduled' | 'open' | 'closed'

/** Estado de la votación de una categoría para mostrar (sin decir nada del resultado). */
export function awardPhase(a: Award, now: number): { phase: Phase; round: 1 | 2; openAt: number | null; closeAt: number | null } {
  const round = a.state === 'ROUND2_OPEN' || a.state === 'RUNOFF_READY' || (a.round2 && a.state === 'SEALED') ? 2 : 1
  const win = a.state === 'ROUND2_OPEN' ? a.round2 : a.round1
  if (a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN') {
    const openAt = win?.openAt ?? null
    const closeAt = win?.closeAt ?? null
    if (openAt && now < openAt) return { phase: 'scheduled', round, openAt, closeAt }
    if (closeAt && now >= closeAt) return { phase: 'closed', round, openAt, closeAt }
    return { phase: 'open', round, openAt, closeAt }
  }
  if (a.state === 'DRAFT') return { phase: 'draft', round, openAt: null, closeAt: null }
  return { phase: 'closed', round, openAt: null, closeAt: null }
}

export function Premios() {
  const { db, slug, memberId, isMember } = useSession()
  const toast = useToast()
  const now = useNow()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const list = useMemo(() => awards.filter((a) => a.enabled && a.state !== 'VOID' && (VAO_ACTIVO || a.eligibility !== 'VAO')).sort((a, b) => a.order - b.order), [awards])
  const { docs: ballots } = useDocs<Ballot>(isMember && memberId ? list.map((a) => P.ballot(slug, a.code, memberId)) : [])
  const [busy, setBusy] = useState<string | null>(null)

  if (loading || !edition) return <Loading />

  const isElector = (a: Award) => !!memberId && a.electorate.includes(memberId)
  const myChoice = (a: Award, round: 1 | 2) => {
    const b = ballots[P.ballot(slug, a.code, memberId ?? '')]
    return round === 2 ? (b?.r2 ?? null) : (b?.r1 ?? null)
  }
  const openNow = list.filter((a) => awardPhase(a, now).phase === 'open')
  const completed = openNow.filter((a) => isElector(a) && myChoice(a, awardPhase(a, now).round)).length
  const electorIn = openNow.filter(isElector).length
  const anyActive = list.some((a) => a.state !== 'DRAFT')

  async function vote(a: Award, key: string) {
    if (!memberId) return
    const { phase, round } = awardPhase(a, now)
    if (phase !== 'open') return toast.error('Esta categoría no está abierta para votar.')
    setBusy(a.code)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Ballot>(P.ballot(slug, a.code, memberId))
        const next: Ballot = { r1: cur?.r1 ?? null, r2: cur?.r2 ?? null, revision: (cur?.revision ?? 0) + 1, updatedAt: Date.now() }
        if (round === 1) next.r1 = key
        else {
          if (!a.finalists?.includes(key)) throw new DataError('VALIDATION_ERROR', 'Ese no es finalista.')
          next.r2 = key
        }
        tx.set(P.ballot(slug, a.code, memberId), next)
      })
      toast.ok('Tu voto quedó guardado')
    } catch (e) {
      toast.error('No se guardó: ' + errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Premios" intro="Votá quién se ganó cada premio. Los resultados no se publican: Agus los anuncia en la comida." />

      {isMember && electorIn > 0 ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <p className="h3">Tu boleta</p>
            <Pill>
              {completed} de {electorIn} votadas
            </Pill>
          </div>
          <Progress value={completed} max={Math.max(1, electorIn)} />
          <p className="tiny muted mt-2">Podés cambiar tus votos hasta que cierre cada categoría.</p>
        </Card>
      ) : null}
      {!isMember ? (
        <div className="mb-4">
          <LoginPrompt text="Entrá para votar." />
        </div>
      ) : null}

      <details className="mb-4">
        <summary className="small font-semibold cursor-pointer min-h-[40px] flex items-center">Cómo funciona</summary>
        <p className="small muted mt-2">{TEXTOS.premiosRegla}</p>
        <p className="small muted mt-1">Tu voto no se muestra a nadie de la banda. Los resultados los ve sólo Agus.</p>
      </details>

      {!anyActive ? <Empty title="Los premios todavía no abrieron" text="Agus define cuándo arranca y cuándo cierra la votación." /> : null}

      {list
        .filter((a) => a.state !== 'DRAFT')
        .map((a) => {
          const { phase, round, openAt, closeAt } = awardPhase(a, now)
          const chosen = isMember ? myChoice(a, round) : null
          const canVote = isMember && phase === 'open' && isElector(a)
          const options =
            round === 2 ? stableShuffle(a.finalists ?? [], (memberId ?? 'visita') + a.code) : [...a.candidates].sort((x, y) => members.aliasOf(x).localeCompare(members.aliasOf(y), 'es'))
          const includeNobody = round === 1 || (a.finalists ?? []).includes(NOBODY)
          return (
            <Card key={a.code} className="mb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow">{round === 2 ? 'Ballotage' : 'Votación'}</p>
                  <p className="h2 mt-1">{awardTitle(a, edition.year)}</p>
                  <p className="small muted">{a.description}</p>
                </div>
                {phase === 'open' ? (
                  <Pill>{timeLeft(closeAt, now)}</Pill>
                ) : phase === 'scheduled' ? (
                  <Pill tone="warn">Abre {fmtDateTime(openAt)}</Pill>
                ) : (
                  <Pill tone="muted">Cerrada</Pill>
                )}
              </div>

              {phase === 'open' && isMember && !isElector(a) ? <Notice tone="warn">No estás en el padrón de esta categoría.</Notice> : null}

              {canVote ? (
                <>
                  <div className="grid sm:grid-cols-2 gap-2 mt-4" role="radiogroup" aria-label={a.label}>
                    {options
                      .filter((k) => k !== NOBODY)
                      .map((k) => (
                        <button key={k} type="button" role="radio" aria-checked={chosen === k} className="choice" disabled={busy === a.code} onClick={() => void vote(a, k)}>
                          <MemberAvatar id={k} size={30} />
                          {members.aliasOf(k)}
                          {k === memberId ? <span className="tiny muted ml-auto">(vos)</span> : null}
                        </button>
                      ))}
                    {includeNobody ? (
                      <button type="button" role="radio" aria-checked={chosen === NOBODY} className="choice sm:col-span-2 justify-center" disabled={busy === a.code} onClick={() => void vote(a, NOBODY)}>
                        {NOBODY_LABEL}
                      </button>
                    ) : null}
                  </div>
                  <p className="tiny mt-3" aria-live="polite">
                    {chosen ? (
                      <span className="text-ok font-semibold">✓ Votaste a {members.aliasOf(chosen)}. Podés cambiarlo hasta el cierre.</span>
                    ) : (
                      <span className="muted">Todavía no votaste.</span>
                    )}
                  </p>
                </>
              ) : isMember && chosen ? (
                <p className="small mt-3">
                  Tu voto: <b>{members.aliasOf(chosen)}</b>
                </p>
              ) : null}
              {phase === 'closed' ? <p className="tiny muted mt-2">El resultado lo anuncia Agus en la comida.</p> : null}
            </Card>
          )
        })}
      <p className="tiny muted">{TEXTOS.votoPrivado}</p>
    </div>
  )
}
