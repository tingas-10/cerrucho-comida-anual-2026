// Amigo invisible: participan todos los de la banda (vayan o no a la comida). Cada uno ve sólo
// a quién le regala, con sus gustos al lado. Los gustos de cada uno son públicos.
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { useDoc, useEdition, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { GiftAssignment, GiftCampaign } from '../data/types'
import { formatArs } from '../domain/expenses'
import { Button, Card, Field, Loading, LoginPrompt, MemberAvatar, Notice, PageHeader, Section, Textarea } from '../ui/components'
import { useToast } from '../ui/toast'

export function AmigoInvisible() {
  const { slug, memberId, isMember } = useSession()
  const { data: edition, loading } = useEdition()
  const members = useMembers()
  const { data: gift } = useDoc<GiftCampaign>(P.gift(slug))
  const drawn = !!gift && gift.drawVersion > 0
  const assignment = useDoc<GiftAssignment>(isMember && drawn && memberId ? P.giftAssignment(slug, memberId) : null)
  const [revealed, setRevealed] = useState(false)
  const withPrefs = members.list.filter((m) => m.status !== 'suspended' && m.giftPrefs?.trim())

  if (loading || !edition) return <Loading />
  const amount = gift?.amountCents ?? null
  const tol = gift?.tolerancePct ?? 10
  const receiver = assignment.data ? members.byId[assignment.data.receiverId] : null

  return (
    <div>
      <PageHeader eyebrow={edition.title} title="Amigo invisible" intro="Participamos todos los de la banda, aunque no vayas a la comida. Cada uno ve sólo a quién le regala." />

      {amount ? (
        <Card className="mb-4">
          <p className="eyebrow">Monto de referencia</p>
          <p className="h2 mt-1">{formatArs(amount)}</p>
          <p className="small muted">
            Entre {formatArs(Math.round(amount * (1 - tol / 100)))} y {formatArs(Math.round(amount * (1 + tol / 100)))} está bien.
          </p>
        </Card>
      ) : null}

      {!drawn ? (
        <Notice>Todavía no se sorteó. Cuando Agus haga el sorteo, acá vas a ver a quién le regalás.</Notice>
      ) : !isMember ? (
        <LoginPrompt text="El sorteo ya se hizo. Entrá para ver a quién le regalás." />
      ) : assignment.loading ? (
        <Loading text="Buscando tu amigo invisible…" />
      ) : receiver ? (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <p className="h3">Te toca regalarle a…</p>
            <Button size="sm" variant="line" onClick={() => setRevealed((r) => !r)}>
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />} {revealed ? 'Ocultar' : 'Ver'}
            </Button>
          </div>
          {revealed ? (
            <div className="mt-3 pop-in">
              <p className="flex items-center gap-3 text-2xl font-extrabold">
                <MemberAvatar id={receiver.id} size={52} />
                {receiver.alias}
              </p>
              <div className="mt-3 rounded-xl bg-soft/60 p-3">
                <p className="small font-semibold">Sus gustos e ideas</p>
                <p className="small mt-1 whitespace-pre-line">{receiver.giftPrefs?.trim() || 'Todavía no cargó nada. Avisale que complete sus gustos en Mi perfil.'}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 h2 tracking-widest muted">••••••</p>
          )}
          <p className="tiny muted mt-3">Nadie ve quién te regala a vos.</p>
        </Card>
      ) : (
        <Notice tone="warn">No encontramos tu asignación. Hablá con Agus.</Notice>
      )}

      {isMember ? (
        <Section title="Tus gustos">
          <MyPrefs />
        </Section>
      ) : null}

      <Section title="Gustos de la banda">
        {withPrefs.length === 0 ? (
          <p className="small muted">Todavía nadie cargó sus gustos.</p>
        ) : (
          <Card>
            {withPrefs.map((m) => (
              <details key={m.id} className="py-2 border-b border-line last:border-0">
                <summary className="flex items-center gap-3 cursor-pointer min-h-[40px]">
                  <MemberAvatar id={m.id} size={30} />
                  <span className="font-semibold">{m.alias}</span>
                </summary>
                <p className="small mt-2 ml-11 whitespace-pre-line">{m.giftPrefs}</p>
              </details>
            ))}
          </Card>
        )}
      </Section>
    </div>
  )
}

function MyPrefs() {
  const { db, member, memberId } = useSession()
  const toast = useToast()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => setText(member?.giftPrefs ?? ''), [member?.giftPrefs])
  const dirty = text.trim() !== (member?.giftPrefs ?? '').trim()
  async function save() {
    if (!memberId) return
    setBusy(true)
    try {
      await db.updateDoc(P.member(memberId), { giftPrefs: text.trim().slice(0, 600), updatedAt: Date.now() })
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card>
      <Field label="Gustos, hobbies, cosas que necesitás o ideas de regalo" id="my-prefs" hint="Lo ve quien te regala (y toda la banda).">
        <Textarea id="my-prefs" value={text} onChange={(e) => setText(e.target.value)} maxLength={600} placeholder="ej. Fan de River, juego al pádel, talle L, me sirve algo para el auto." />
      </Field>
      <Button variant="gold" onClick={() => void save()} loading={busy} disabled={!dirty}>
        {dirty ? 'Guardar' : 'Guardado'}
      </Button>
    </Card>
  )
}
