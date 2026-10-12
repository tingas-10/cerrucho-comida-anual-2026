// Golf · Comisión: quiénes son, propuestas pendientes (se aplican con 2 aprobaciones) e historial.
import { useState } from 'react'
import { GOLF } from '../../content/golf'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf, voteGolf, withdrawGolf } from '../../data/golf'
import { useMembers } from '../../data/hooks'
import type { GolfProposal } from '../../data/types'
import { fmtDayShort } from '../../domain/format'
import { pointsText } from '../../domain/golf'
import { Button, Card, Empty, Field, Input, Loading, MemberAvatar, PageHeader, Pill, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { GolfTabs, useGolfConfig, useGolfProposals } from './golfShared'

const STATUS: Record<GolfProposal['status'], { label: string; tone: 'ok' | 'warn' | 'danger' | 'muted' }> = {
  OPEN: { label: 'Pendiente', tone: 'warn' },
  APPLIED: { label: 'Aprobada', tone: 'ok' },
  REJECTED: { label: 'Rechazada', tone: 'danger' },
  WITHDRAWN: { label: 'Retirada', tone: 'muted' },
}

export function GolfComision() {
  const { db, memberId, isGolfComm, golfCommission } = useSession()
  const members = useMembers()
  const toast = useToast()
  const { rows, loading } = useGolfProposals()
  const cfg = useGolfConfig()
  const [busy, setBusy] = useState<string | null>(null)
  const [participation, setParticipation] = useState('')
  const [positions, setPositions] = useState('')

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

  const pos = positions
    .split(/[,;\s/]+/)
    .filter(Boolean)
    .map((x) => Math.floor(Number(x)))
  const part = Math.floor(Number(participation))
  const pointsValid = participation.trim() !== '' && Number.isFinite(part) && part >= 0 && part <= 100 && pos.length <= 10 && pos.every((x) => Number.isFinite(x) && x >= 0 && x <= 100)

  async function proposePoints() {
    if (!memberId || !pointsValid) return
    setBusy('points')
    try {
      const points = { participation: part, positions: pos }
      await proposeGolf(db, memberId, `Sistema de puntos: ${pointsText(points)}`, { type: 'points', points })
      setParticipation('')
      setPositions('')
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

      <p className="italic small muted mb-4 leading-relaxed">
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
                {isGolfComm ? (
                  <div className="flex gap-2 flex-wrap mt-3">
                    {!approved ? (
                      <Button size="sm" variant="gold" onClick={() => void vote(p, 'approve')} loading={busy === p.id + 'approve'}>
                        Aprobar
                      </Button>
                    ) : null}
                    {!mine && !rejected ? (
                      <Button size="sm" variant="line" onClick={() => void vote(p, 'reject')} loading={busy === p.id + 'reject'}>
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

      {isGolfComm ? (
        <Section title="Proponer otro sistema de puntos">
          <Card>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Puntos por jugar un partido" id="gp-part">
                <Input id="gp-part" inputMode="numeric" value={participation} onChange={(e) => setParticipation(e.target.value)} placeholder={String(cfg.points.participation)} />
              </Field>
              <Field label="Puntos extra por puesto (1º, 2º, 3º…)" id="gp-pos" hint="Separados por coma. Ej: 10, 6, 4">
                <Input id="gp-pos" value={positions} onChange={(e) => setPositions(e.target.value)} placeholder={cfg.points.positions.join(', ')} />
              </Field>
            </div>
            {pointsValid ? <p className="small mb-2">Quedaría: {pointsText({ participation: part, positions: pos })}</p> : null}
            <Button variant="gold" onClick={() => void proposePoints()} disabled={!pointsValid} loading={busy === 'points'}>
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
