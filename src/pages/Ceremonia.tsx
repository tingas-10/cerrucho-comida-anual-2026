// Ceremonia: proyección para miembros (sólo contenido publicado) y control de Agus.
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { GRUPO } from '../content/config'
import { FOTOS } from '../content/galeria'
import { NOBODY } from '../content/premios'
import { useSession } from '../data/DataContext'
import { errorText, logAudit } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDoc, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Award, AwardResult, Ceremony, SealedResult } from '../data/types'
import { directNominees } from '../domain/awards'
import { Avatar, Button } from '../ui/components'
import { useToast } from '../ui/toast'
import { awardTitle } from './Premios'

const BASE = import.meta.env.BASE_URL

export function Ceremonia() {
  const { slug, isAdmin } = useSession()
  const { data: edition } = useEdition()
  const { data: ceremony } = useDoc<Ceremony>(P.ceremony(slug))
  const { rows: awards } = useCollection<Award>(P.awards(slug))
  const members = useMembers()
  const [prefersReduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  const [animKey, setAnimKey] = useState(0)
  useEffect(() => setAnimKey((k) => k + 1), [ceremony?.sequence, ceremony?.replayAt])

  const current = ceremony?.currentCode ? awards.find((a) => a.code === ceremony.currentCode) : null
  const year = edition?.year ?? new Date().getFullYear()
  const stage = ceremony?.state === 'IDLE' || !ceremony ? 'WELCOME' : ceremony.stage
  const nominees = current && ceremony ? ceremony.nominees[current.code] ?? [] : []
  const result = current?.state === 'REVEALED' ? current.result : null

  return (
    <div className="min-h-dvh bg-[#0c0e14] text-[#e2e4eb] flex flex-col">
      <div className="flex items-center justify-between px-5 py-3 text-xs text-[#a7adbc]">
        <span>
          {GRUPO.nombre} · {edition?.title ?? ''}
        </span>
        <span className="flex gap-3 items-center">
          {ceremony?.state === 'PAUSED' ? <span className="text-gold">En pausa</span> : null}
          <Link to={`/e/${slug}/premios`} className="underline">
            Salir
          </Link>
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pb-10">
        {stage === 'WELCOME' ? (
          <div key={'w' + animKey} className={prefersReduced ? '' : 'pop-in'}>
            <p className="eyebrow text-gold">Ceremonia de premios</p>
            <h1 className="font-serif text-gold font-bold leading-[1.05] mt-4" style={{ fontSize: 'clamp(44px, 9vw, 110px)' }}>
              La Banda
              <br />
              del cerrucho
            </h1>
            <p className="mt-6 text-[#a7adbc] text-lg">{ceremony?.state === 'RUNNING' ? 'Empezamos en un rato…' : 'Esperando a que Agus arranque.'}</p>
            <div className="flex gap-2 justify-center mt-10 opacity-80">
              {FOTOS.filter((f) => f.kind === 'photo')
                .slice(0, 4)
                .map((f) => (
                  <img key={f.id} src={BASE + f.src} alt="" className="h-28 sm:h-40 rounded-xl object-cover" style={{ aspectRatio: '3/4' }} />
                ))}
            </div>
          </div>
        ) : null}

        {current && stage !== 'WELCOME' && stage !== 'END' ? (
          <div key={current.code + stage + animKey} className={`w-full max-w-5xl ${prefersReduced ? '' : 'pop-in'}`}>
            <p className="eyebrow text-[#a7adbc]">Premio</p>
            <h1 className="font-serif text-gold font-bold leading-[1.05] mt-3" style={{ fontSize: 'clamp(40px, 7vw, 92px)' }}>
              {awardTitle(current, year)}
            </h1>
            <p className="text-[#a7adbc] text-lg sm:text-2xl mt-3">{current.description}</p>

            {stage === 'NOMINEES' || stage === 'ENVELOPE' ? (
              <div className="flex flex-wrap justify-center gap-3 sm:gap-5 mt-10">
                {nominees.map((k) => (
                  <div key={k} className="flex flex-col items-center gap-2 w-28 sm:w-36">
                    {k === NOBODY ? (
                      <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-gold flex items-center justify-center text-gold font-serif text-2xl">—</span>
                    ) : (
                      <Avatar id={k} alias={members.aliasOf(k)} size={72} color={members.byId[k]?.avatarColor} />
                    )}
                    <span className="font-bold text-base sm:text-xl">{members.aliasOf(k)}</span>
                  </div>
                ))}
                {nominees.length === 0 ? <p className="text-[#a7adbc]">Nominados a confirmar…</p> : null}
              </div>
            ) : null}

            {stage === 'ENVELOPE' ? (
              <div className="mt-12 flex flex-col items-center">
                <Envelope open={false} reduced={prefersReduced} />
                <p className="eyebrow text-gold mt-4">Sobre cerrado</p>
              </div>
            ) : null}

            {stage === 'RESULT' && result ? (
              <div className="mt-10 flex flex-col items-center">
                <Envelope open reduced={prefersReduced} />
                <ResultBlock result={result} aliasOf={members.aliasOf} colorOf={(k) => members.byId[k]?.avatarColor} reduced={prefersReduced} />
              </div>
            ) : null}
            {stage === 'RESULT' && !result ? <p className="mt-10 text-[#a7adbc]">Esperando la revelación…</p> : null}
          </div>
        ) : null}

        {stage === 'END' ? (
          <div key={'e' + animKey} className={prefersReduced ? '' : 'pop-in'}>
            <h1 className="font-serif text-gold font-bold leading-[1.05]" style={{ fontSize: 'clamp(44px, 8vw, 100px)' }}>
              Gracias, banda.
            </h1>
            <p className="mt-6 text-[#a7adbc] text-lg">Hasta el año que viene.</p>
            <div className="mt-8 grid sm:grid-cols-2 gap-2 text-left max-w-2xl mx-auto">
              {awards
                .filter((a) => a.state === 'REVEALED' && a.result)
                .sort((a, b) => a.order - b.order)
                .map((a) => (
                  <div key={a.code} className="flex justify-between gap-3 border-b border-white/10 py-2">
                    <span className="text-[#a7adbc]">{awardTitle(a, year)}</span>
                    <b className="text-right">{resultLabel(a.result!, members.aliasOf)}</b>
                  </div>
                ))}
            </div>
          </div>
        ) : null}
      </div>

      {isAdmin ? <AdminControls awards={awards} ceremony={ceremony} year={year} aliasOf={members.aliasOf} /> : null}
    </div>
  )
}

function resultLabel(r: AwardResult, aliasOf: (k: string) => string): string {
  if (r.outcome === 'WINNER' && r.winner) return aliasOf(r.winner)
  if (r.outcome === 'TIE') return 'EMPATE: ' + (r.tied ?? []).map(aliasOf).join(' · ')
  if (r.outcome === 'DESERTED') return 'DESIERTO'
  return 'SIN VOTOS'
}

function Envelope({ open, reduced }: { open: boolean; reduced: boolean }) {
  return (
    <div className="relative w-56 h-36 sm:w-72 sm:h-44" style={{ perspective: 800 }} aria-hidden>
      <div className="absolute inset-0 rounded-xl border border-gold" style={{ background: 'linear-gradient(30deg,#30291c,#171b26)' }} />
      <div
        className="absolute left-0 right-0 top-0 h-1/2 rounded-t-xl border border-gold origin-top"
        style={{
          background: 'linear-gradient(180deg,#3a3122,#1d2130)',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          transform: open ? 'rotateX(-160deg)' : 'rotateX(0deg)',
          transition: reduced ? 'none' : 'transform 1.1s ease',
        }}
      />
      <div className="absolute inset-0 grid place-items-center">
        <span className="w-12 h-12 rounded-full bg-gold text-[#111] font-serif text-2xl font-bold grid place-items-center">C</span>
      </div>
    </div>
  )
}

function ResultBlock({ result, aliasOf, colorOf, reduced }: { result: AwardResult; aliasOf: (k: string) => string; colorOf: (k: string) => string | undefined; reduced: boolean }) {
  const [show, setShow] = useState(reduced)
  useEffect(() => {
    if (reduced) return
    const t = setTimeout(() => setShow(true), 1100)
    return () => clearTimeout(t)
  }, [reduced])
  if (!show) return <div className="h-24" />
  return (
    <div className={`mt-6 ${reduced ? '' : 'pop-in'}`}>
      {result.outcome === 'WINNER' && result.winner ? (
        <div className="flex flex-col items-center gap-4">
          <Avatar id={result.winner} alias={aliasOf(result.winner)} size={120} color={colorOf(result.winner)} />
          <p className="font-serif font-bold text-gold" style={{ fontSize: 'clamp(40px, 8vw, 96px)', lineHeight: 1 }}>
            {aliasOf(result.winner)}
          </p>
        </div>
      ) : null}
      {result.outcome === 'TIE' ? (
        <div>
          <p className="eyebrow text-gold">Empate</p>
          <div className="flex flex-wrap justify-center gap-8 mt-4">
            {(result.tied ?? []).map((k) => (
              <div key={k} className="flex flex-col items-center gap-3">
                {k === NOBODY ? <span className="w-20 h-20 rounded-full border border-gold grid place-items-center text-gold font-serif text-3xl">—</span> : <Avatar id={k} alias={aliasOf(k)} size={80} color={colorOf(k)} />}
                <p className="font-serif font-bold text-gold" style={{ fontSize: 'clamp(28px, 5vw, 56px)', lineHeight: 1 }}>
                  {aliasOf(k)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {result.outcome === 'DESERTED' ? (
        <p className="font-serif font-bold text-gold" style={{ fontSize: 'clamp(40px, 8vw, 96px)', lineHeight: 1 }}>
          DESIERTO
        </p>
      ) : null}
      {result.outcome === 'NO_VOTES' ? (
        <p className="font-serif font-bold text-gold" style={{ fontSize: 'clamp(40px, 8vw, 96px)', lineHeight: 1 }}>
          SIN VOTOS
        </p>
      ) : null}
      <p className="text-[#a7adbc] mt-4">
        Votaron {result.participation} de {result.electorateSize}
        {result.manual ? ' · Resolución del administrador' : ''}
      </p>
      {result.corrected ? <p className="text-gold mt-1">Resultado corregido: {result.corrected.reason}</p> : null}
    </div>
  )
}

function AdminControls({ awards, ceremony, year, aliasOf }: { awards: Award[]; ceremony: Ceremony | null; year: number; aliasOf: (k: string) => string }) {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(true)
  if (!ceremony) return null
  const ready = awards.filter((a) => a.enabled && (a.state === 'SEALED' || a.state === 'REVEALED')).sort((a, b) => a.order - b.order)
  const order = ceremony.order.length ? ceremony.order : ready.map((a) => a.code)
  const idx = ceremony.currentCode ? order.indexOf(ceremony.currentCode) : -1
  const current = ceremony.currentCode ? awards.find((a) => a.code === ceremony.currentCode) : null

  async function update(patch: Partial<Ceremony>) {
    setBusy(true)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Ceremony>(P.ceremony(slug))
        if (!cur) throw new DataError('NOT_FOUND')
        tx.set(P.ceremony(slug), { ...cur, ...patch, sequence: cur.sequence + 1, updatedAt: Date.now() })
      })
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function start() {
    await update({ state: 'RUNNING', stage: 'WELCOME', order, currentCode: null })
  }
  async function goTo(i: number) {
    if (i < 0) return update({ stage: 'WELCOME', currentCode: null })
    if (i >= order.length) return update({ stage: 'END', currentCode: null })
    await update({ stage: 'CATEGORY', currentCode: order[i] })
  }
  async function showNominees() {
    if (!current) return
    let nominees: string[] = ceremony!.nominees[current.code] ?? []
    if (nominees.length === 0) {
      const sealed = await db.getDoc<SealedResult>(P.sealed(slug, current.code))
      if (current.result?.counts) nominees = current.result.round === 2 ? Object.keys(current.result.counts) : directNominees(current.result.counts, aliasOf)
      else if (sealed) nominees = sealed.round === 2 ? sealed.finalists ?? Object.keys(sealed.counts) : directNominees(sealed.counts, aliasOf)
    }
    await update({ stage: 'NOMINEES', nominees: { ...ceremony!.nominees, [current.code]: nominees } })
  }
  async function reveal() {
    if (!current || !memberId) return
    if (current.state === 'REVEALED') {
      await update({ stage: 'RESULT', replayAt: Date.now() })
      return
    }
    if (current.state !== 'SEALED') {
      toast.error('La categoría no está sellada.')
      return
    }
    if (ceremony!.state !== 'RUNNING') {
      toast.error('Iniciá la ceremonia primero.')
      return
    }
    setBusy(true)
    try {
      const sealed = await db.getDoc<SealedResult>(P.sealed(slug, current.code))
      if (!sealed || sealed.outcome === 'RUNOFF_REQUIRED') throw new DataError('STATE_CONFLICT', 'No hay resultado sellado.')
      const result: AwardResult = {
        outcome: sealed.outcome,
        winner: sealed.winner ?? null,
        tied: sealed.tied ?? [],
        counts: sealed.counts,
        round: sealed.round,
        participation: sealed.participation,
        electorateSize: sealed.electorateSize,
      }
      await db.runTransaction(async (tx) => {
        const a = await tx.get<Award>(P.award(slug, current.code))
        if (!a) throw new DataError('NOT_FOUND')
        if (a.state === 'REVEALED') return
        if (a.state !== 'SEALED') throw new DataError('STATE_CONFLICT', 'La categoría no está sellada.')
        tx.update(P.award(slug, current.code), { state: 'REVEALED', result, revealedAt: Date.now(), updatedAt: Date.now(), version: a.version + 1 })
        const c = await tx.get<Ceremony>(P.ceremony(slug))
        if (c) tx.set(P.ceremony(slug), { ...c, stage: 'RESULT', sequence: c.sequence + 1, updatedAt: Date.now() })
      })
      await logAudit(db, slug, memberId, 'award.reveal', current.code)
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sticky bottom-0 bg-[#171b26] border-t border-white/10 text-sm">
      <button type="button" className="w-full text-left px-4 py-2 text-xs text-[#a7adbc]" onClick={() => setOpen((o) => !o)}>
        Control de Agus {open ? '▾' : '▸'} · {ceremony.state === 'IDLE' ? 'sin iniciar' : ceremony.state === 'PAUSED' ? 'en pausa' : ceremony.state === 'ENDED' ? 'terminada' : 'en curso'} · {ready.length} categorías listas
      </button>
      {open ? (
        <div className="px-4 pb-4 flex flex-wrap gap-2 items-center">
          {ceremony.state === 'IDLE' || ceremony.state === 'ENDED' ? (
            <Button size="sm" variant="gold" onClick={() => void start()} loading={busy}>
              Iniciar ceremonia
            </Button>
          ) : null}
          {ceremony.state === 'RUNNING' ? (
            <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void update({ state: 'PAUSED' })} loading={busy}>
              Pausar
            </Button>
          ) : null}
          {ceremony.state === 'PAUSED' ? (
            <Button size="sm" variant="gold" onClick={() => void update({ state: 'RUNNING' })} loading={busy}>
              Reanudar
            </Button>
          ) : null}
          {ceremony.state !== 'IDLE' ? (
            <>
              <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void goTo(idx - 1)} loading={busy}>
                ← Anterior
              </Button>
              <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void goTo(idx + 1)} loading={busy}>
                Siguiente →
              </Button>
              {current ? (
                <>
                  <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void showNominees()} loading={busy} disabled={ceremony.stage === 'RESULT'}>
                    Mostrar nominados
                  </Button>
                  <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void update({ stage: 'ENVELOPE' })} loading={busy} disabled={ceremony.stage === 'RESULT'}>
                    Sobre cerrado
                  </Button>
                  <Button size="sm" variant="gold" onClick={() => void reveal()} loading={busy} disabled={current.state !== 'SEALED' && current.state !== 'REVEALED'}>
                    {current.state === 'REVEALED' ? 'Repetir animación' : 'Revelar'}
                  </Button>
                </>
              ) : null}
              <Button size="sm" variant="line" className="text-white border-white/30" onClick={() => void update({ state: 'ENDED', stage: 'END', currentCode: null })} loading={busy}>
                Terminar
              </Button>
            </>
          ) : null}
          <span className="text-xs text-[#a7adbc] ml-auto">
            {current ? `${idx + 1}/${order.length} · ${awardTitle(current, year)} · ${current.state === 'REVEALED' ? 'revelado' : current.state === 'SEALED' ? 'sellado' : current.state}` : 'Portada'}
          </span>
        </div>
      ) : null}
    </div>
  )
}
