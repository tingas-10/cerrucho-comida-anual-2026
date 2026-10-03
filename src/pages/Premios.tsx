// Premios: boleta personal por categoría, ballotage y resultados revelados.
import { useMemo, useState } from 'react'
import { TEXTOS } from '../content/config'
import { NOBODY, NOBODY_LABEL } from '../content/premios'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDocs, useEdition, useMembers, useNow } from '../data/hooks'
import { P } from '../data/paths'
import type { Award, Ballot } from '../data/types'
import { stableShuffle } from '../domain/awards'
import { timeLeft } from '../domain/format'
import { Avatar, Card, Empty, Loading, Notice, PageHeader, Pill, Progress, Section } from '../ui/components'
import { useToast } from '../ui/toast'

export function awardTitle(a: Award, year: number): string {
  return a.anioSiguiente ? `${a.label} ${year + 1}` : a.label
}

export function Premios() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const now = useNow()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const list = useMemo(() => awards.filter((a) => a.enabled && a.state !== 'VOID').sort((a, b) => a.order - b.order), [awards])
  const { docs: ballots } = useDocs<Ballot>(memberId ? list.map((a) => P.ballot(slug, a.code, memberId)) : [])
  const [busy, setBusy] = useState<string | null>(null)
  const [showCounts, setShowCounts] = useState<Record<string, boolean>>({})

  if (loading || !edition) return <Loading />

  const voting = list.filter((a) => a.state === 'ROUND1_OPEN' || a.state === 'ROUND2_OPEN')
  const revealed = list.filter((a) => a.state === 'REVEALED')
  const sealed = list.filter((a) => a.state === 'SEALED' || a.state === 'ROUND1_CLOSED' || a.state === 'RUNOFF_READY')
  const isElector = (a: Award) => !!memberId && a.electorate.includes(memberId)
  const myChoice = (a: Award) => {
    const b = ballots[P.ballot(slug, a.code, memberId ?? '')]
    return a.state === 'ROUND2_OPEN' ? b?.r2 ?? null : b?.r1 ?? null
  }
  const completed = voting.filter((a) => isElector(a) && myChoice(a)).length
  const electorIn = voting.filter(isElector).length

  async function vote(a: Award, key: string) {
    if (!memberId) return
    const round = a.state === 'ROUND2_OPEN' ? 2 : 1
    const closeAt = round === 2 ? a.round2?.closeAt : a.round1?.closeAt
    if (closeAt && now >= closeAt) {
      toast.error('Esta categoría ya cerró.')
      return
    }
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
      toast.ok('Voto guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Los premios de la banda" title="Elegí quién se lo ganó" intro="Un voto por categoría. Los resultados quedan guardados hasta que Agus los revela." />

      {voting.length > 0 ? (
        <Card className="mb-4">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
            <div>
              <p className="h3">Tu boleta</p>
              <p className="tiny muted">Podés cambiar tus votos hasta el cierre. Cada categoría guardada ya cuenta.</p>
            </div>
            <Pill>{completed} de {electorIn} completadas</Pill>
          </div>
          <Progress value={completed} max={Math.max(1, electorIn)} />
          {completed === electorIn && electorIn > 0 ? <Notice tone="ok">Boleta completa. Revisá y cambiá lo que quieras hasta el cierre.</Notice> : null}
        </Card>
      ) : null}

      <details className="mb-4">
        <summary className="small font-semibold cursor-pointer">Cómo se resuelve</summary>
        <p className="small muted mt-2">{TEXTOS.premiosRegla}</p>
        <p className="small muted mt-1">{TEXTOS.votoPrivado}</p>
      </details>

      {voting.length === 0 && sealed.length === 0 && revealed.length === 0 ? <Empty title="Los premios todavía no abrieron" text="Agus abre la votación cuando el padrón esté listo." /> : null}

      {voting.map((a) => {
        const round = a.state === 'ROUND2_OPEN' ? 2 : 1
        const closeAt = round === 2 ? a.round2?.closeAt : a.round1?.closeAt
        const open = !closeAt || now < closeAt
        const chosen = myChoice(a)
        const options = round === 2 ? stableShuffle(a.finalists ?? [], (memberId ?? '') + a.code) : [...a.candidates].sort((x, y) => members.aliasOf(x).localeCompare(members.aliasOf(y), 'es'))
        const includeNobody = round === 1 || (a.finalists ?? []).includes(NOBODY)
        return (
          <Card key={a.code} className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">{round === 2 ? 'Ballotage' : 'Primera ronda'}</p>
                <p className="h2 mt-1">{awardTitle(a, edition.year)}</p>
                <p className="small muted">{a.description}</p>
              </div>
              <Pill tone={open ? 'accent' : 'muted'}>{open ? timeLeft(closeAt, now) : 'Cerró'}</Pill>
            </div>
            {!isElector(a) ? (
              <Notice tone="warn">No estás en el padrón de esta categoría.</Notice>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-2 mt-4" role="radiogroup" aria-label={a.label}>
                  {options
                    .filter((k) => k !== NOBODY)
                    .map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={chosen === k} className="choice" disabled={!open || busy === a.code} onClick={() => void vote(a, k)}>
                        <Avatar id={k} alias={members.aliasOf(k)} size={30} color={members.byId[k]?.avatarColor} />
                        {members.aliasOf(k)}
                        {k === memberId ? <span className="tiny muted ml-auto">(vos)</span> : null}
                      </button>
                    ))}
                  {includeNobody ? (
                    <button type="button" role="radio" aria-checked={chosen === NOBODY} className="choice sm:col-span-2 justify-center" disabled={!open || busy === a.code} onClick={() => void vote(a, NOBODY)}>
                      {NOBODY_LABEL}
                    </button>
                  ) : null}
                </div>
                <p className="tiny muted mt-3">{chosen ? 'Ya votaste. Podés cambiarlo hasta el cierre.' : 'Sin votar todavía.'}</p>
              </>
            )}
          </Card>
        )
      })}

      {sealed.length > 0 ? (
        <Section title="Esperando la revelación">
          <Card>
            {sealed.map((a) => (
              <div key={a.code} className="row">
                <span>{awardTitle(a, edition.year)}</span>
                <Pill tone="muted">Resultado guardado</Pill>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      {revealed.length > 0 ? (
        <Section title="Revelados">
          <div className="grid sm:grid-cols-2 gap-3">
            {revealed.map((a) => {
              const r = a.result!
              return (
                <Card key={a.code}>
                  <p className="eyebrow">{awardTitle(a, edition.year)}</p>
                  {r.outcome === 'WINNER' && r.winner ? (
                    <p className="flex items-center gap-3 text-xl font-extrabold mt-2">
                      <Avatar id={r.winner} alias={members.aliasOf(r.winner)} size={36} color={members.byId[r.winner]?.avatarColor} />
                      {members.aliasOf(r.winner)}
                    </p>
                  ) : null}
                  {r.outcome === 'TIE' ? (
                    <div className="mt-2">
                      <Pill tone="warn">EMPATE</Pill>
                      <p className="text-lg font-extrabold mt-1">{(r.tied ?? []).map((k) => members.aliasOf(k)).join(' · ')}</p>
                    </div>
                  ) : null}
                  {r.outcome === 'DESERTED' ? <p className="text-lg font-extrabold mt-2">DESIERTO</p> : null}
                  {r.outcome === 'NO_VOTES' ? <p className="text-lg font-extrabold mt-2">SIN VOTOS</p> : null}
                  {r.manual ? <Pill tone="muted" className="mt-1">Resolución del administrador</Pill> : null}
                  {r.corrected ? <p className="tiny text-warn mt-1">Resultado corregido: {r.corrected.reason}</p> : null}
                  <p className="tiny muted mt-2">
                    Votaron {r.participation} de {r.electorateSize}
                    {r.round === 2 ? ' · ballotage' : ''}
                  </p>
                  <button type="button" className="tiny underline text-accent mt-2" onClick={() => setShowCounts((s) => ({ ...s, [a.code]: !s[a.code] }))}>
                    {showCounts[a.code] ? 'Ocultar votación' : 'Ver votación'}
                  </button>
                  {showCounts[a.code] ? (
                    <div className="mt-2">
                      {Object.entries(r.counts)
                        .sort((x, y) => y[1] - x[1])
                        .map(([k, n]) => (
                          <div key={k} className="flex justify-between small py-1 border-t border-line">
                            <span>{members.aliasOf(k)}</span>
                            <b>{n}</b>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </Card>
              )
            })}
          </div>
        </Section>
      ) : null}
    </div>
  )
}
