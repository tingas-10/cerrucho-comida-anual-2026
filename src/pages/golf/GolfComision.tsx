// Golf · Comisión: quiénes son, propuestas pendientes (se aplican con 2 aprobaciones) e historial.
import { useEffect, useState } from 'react'
import { GOLF } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf, voteGolf, withdrawGolf } from '../../data/golf'
import { useMembers } from '../../data/hooks'
import type { GolfProposal } from '../../data/types'
import { fmtDayShort } from '../../domain/format'
import { pointsText } from '../../domain/golf'
import { Button, Card, Empty, Field, Input, Loading, MemberAvatar, Notice, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { GolfTabs, useGolfConfig, useGolfProposals } from './golfShared'

const STATUS: Record<GolfProposal['status'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  OPEN: { label: 'Pendiente', tone: 'warn' },
  APPLIED: { label: 'Aprobada', tone: 'ok' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  WITHDRAWN: { label: 'Retirada', tone: 'muted' },
}

export function GolfComision() {
  const { db, memberId, isGolfComm, golfPreview, golfCommission } = useSession()
  const showTools = isGolfComm || golfPreview
  const members = useMembers()
  const toast = useToast()
  const { rows, loading } = useGolfProposals()
  const cfg = useGolfConfig()
  const [busy, setBusy] = useState<string | null>(null)
  const [participation, setParticipation] = useState('')
  const [pos2, setPos2] = useState('')
  const [pos3, setPos3] = useState('')
  const [posMore, setPosMore] = useState('')
  const loaded = !cfg.loading
  const pointsKey = JSON.stringify(cfg.points)
  useEffect(() => {
    if (!loaded) return
    setParticipation(String(cfg.points.participation))
    setPos2((cfg.points.byField?.['2'] ?? cfg.points.positions).join(', '))
    setPos3((cfg.points.byField?.['3'] ?? cfg.points.positions).join(', '))
    setPosMore(cfg.points.positions.join(', '))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, pointsKey])

  if (loading || cfg.loading) return <Loading />
  const open = rows.filter((p) => p.status === 'OPEN').sort((a, b) => b.createdAt - a.createdAt)
  const closed = rows.filter((p) => p.status !== 'OPEN').sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30)
  const names = (m: Record<string, number>) => Object.keys(m).map(members.aliasOf).join(', ')

  async function vote(p: GolfProposal, v: 'approve' | 'reject') {
    if (!memberId) return
    setBusy(p.id + v)
    try {
      const r = await voteGolf(db, p, memberId, v)
      toast.ok(r === 'applied' ? 'Aprobada y aplicada.' : r === 'rejected' ? 'Rechazada.' : v === 'approve' ? 'Aprobaste. Falta otro voto.' : 'Rechazaste.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  const parse = (v: string) =>
    v
      .split(/[,;\s/]+/)
      .filter(Boolean)
      .map((x) => Math.floor(Number(x)))
  const okList = (l: number[]) => l.length <= 10 && l.every((x) => Number.isFinite(x) && x >= 0 && x <= 100)
  const part = Math.floor(Number(participation))
  const draft = { participation: part, positions: parse(posMore), byField: { '2': parse(pos2), '3': parse(pos3) } }
  const pointsValid = participation.trim() !== '' && Number.isFinite(part) && part >= 0 && part <= 100 && okList(draft.positions) && okList(draft.byField['2']) && okList(draft.byField['3'])
  const changed = pointsText(draft) !== pointsText(cfg.points)

  async function proposePoints() {
    if (!memberId || !pointsValid || !isGolfComm) return
    setBusy('points')
    try {
      await proposeGolf(db, memberId, `Sistema de puntos: ${pointsText(draft)}`, { type: 'points', points: draft })
      toast.ok('Propuesta enviada. Se aplica cuando otro de la comisión la apruebe.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Comisión de golf"
        intro={`Define el sistema de puntos, carga las canchas, corrige tarjetas pasado el plazo y ajusta hándicaps. Cada decisión necesita ${GOLF.aprobacionesNecesarias} aprobaciones (quien propone ya cuenta como una).`}
      />
      <GolfTabs />
      {golfPreview ? (
        <Notice>
          <b>Vista de administrador.</b> Así ven esto los comisionados. Vos no sos de la comisión: los botones están desactivados y nadie ve que entraste.
        </Notice>
      ) : null}

      <p className="italic small muted mb-4 leading-relaxed text-center sm:text-left">
        La comisión de golf cuida que el juego y el ranking sean parejos para todos. Define cómo se suman los puntos, carga las canchas con el par y la dificultad de cada hoyo, corrige o anula partidos cuando ya pasaron las 48 horas para corregirlos y ajusta hándicaps si hace falta. Nadie decide solo: cada cambio se aplica recién cuando lo aprueban al menos 2 comisionados.
      </p>

      <Card className="mb-4">
        <p className="h3 mb-2">Comisionados</p>
        {golfCommission.length === 0 ? <p className="small muted">Todavía no hay comisión. La arma Agus en Administración → Miembros.</p> : null}
        <div className="flex flex-wrap gap-3">
          {golfCommission.map((id) => (
            <span key={id} className="flex items-center gap-2">
              <MemberAvatar id={id} size={32} />
              <span className="font-semibold">{members.aliasOf(id)}</span>
            </span>
          ))}
        </div>
        <p className="small mt-3">
          Sistema de puntos vigente: <b>{pointsText(cfg.points)}</b>
        </p>
      </Card>

      <Section title="Pendientes" className="mt-0">
        {open.length === 0 ? <Empty title="No hay propuestas pendientes" text="Cuando alguien de la comisión proponga algo, aparece acá para aprobar." /> : null}
        <div className="grid gap-3">
          {open.map((p) => {
            const mine = p.proposedBy === memberId
            const approved = memberId ? !!p.approvals[memberId] : false
            const rejected = memberId ? !!p.rejections[memberId] : false
            return (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <p className="font-bold">{p.summary}</p>
                  <Pill tone="warn">
                    {Object.keys(p.approvals).length}/{GOLF.aprobacionesNecesarias}
                  </Pill>
                </div>
                <p className="tiny muted mt-1">
                  Propuso {members.aliasOf(p.proposedBy)} el {fmtDayShort(p.createdAt)} · aprobaron: {names(p.approvals) || 'nadie'}
                  {Object.keys(p.rejections).length ? ` · rechazaron: ${names(p.rejections)}` : ''}
                </p>
                {showTools ? (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {!approved ? (
                      <Button size="sm" variant="gold" disabled={!isGolfComm} onClick={() => void vote(p, 'approve')} loading={busy === p.id + 'approve'}>
                        Aprobar
                      </Button>
                    ) : null}
                    {!mine && !rejected ? (
                      <Button size="sm" variant="line" disabled={!isGolfComm} onClick={() => void vote(p, 'reject')} loading={busy === p.id + 'reject'}>
                        Rechazar
                      </Button>
                    ) : null}
                    {mine ? (
                      <Button size="sm" variant="line" onClick={() => void withdrawGolf(db, p).catch((e) => toast.error(errorText(e)))}>
                        Retirar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      </Section>

      {showTools ? (
        <Section title="Proponer otro sistema de puntos">
          <Card>
            <p className="tiny muted mb-3">Puntos por puesto según cuántos juegan (jugadores o, en parejas y scramble, equipos). Separados por coma: 1º, 2º, 3º… El que no tiene número suma 0.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Puntos por jugar un partido" id="gp-part">
                <Input id="gp-part" inputMode="numeric" value={participation} onChange={(e) => setParticipation(e.target.value)} />
              </Field>
              <Field label="Si juegan 2" id="gp-2" hint="Ej: 5, 0">
                <Input id="gp-2" value={pos2} onChange={(e) => setPos2(e.target.value)} />
              </Field>
              <Field label="Si juegan 3" id="gp-3" hint="Ej: 7, 3, 0">
                <Input id="gp-3" value={pos3} onChange={(e) => setPos3(e.target.value)} />
              </Field>
              <Field label="Si juegan 4 o más" id="gp-more" hint="Ej: 10, 6, 4">
                <Input id="gp-more" value={posMore} onChange={(e) => setPosMore(e.target.value)} />
              </Field>
            </div>
            {pointsValid && changed ? <p className="small mb-2">Quedaría: {pointsText(draft)}</p> : null}
            <Button variant="gold" onClick={() => void proposePoints()} disabled={!pointsValid || !changed || !isGolfComm} loading={busy === 'points'}>
              Proponer
            </Button>
          </Card>
        </Section>
      ) : null}

      <Section title="Historial">
        {closed.length === 0 ? (
          <p className="small muted">Todavía nada.</p>
        ) : (
          <Card>
            {closed.map((p) => (
              <div key={p.id} className="row">
                <span className="small min-w-0">
                  <span className="block">{p.summary}</span>
                  <span className="tiny muted">
                    {fmtDayShort(p.updatedAt)} · propuso {members.aliasOf(p.proposedBy)}
                    {Object.keys(p.approvals).length ? ` · aprobaron ${names(p.approvals)}` : ''}
                  </span>
                </span>
                <Pill tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Pill>
              </div>
            ))}
          </Card>
        )}
      </Section>
    </div>
  )
}
