// Tareas comunes (ofrecerse, marcar hecho) y lista personal de llevar.
import { useEffect, useState } from 'react'
import { LISTA_PERSONAL } from '../content/tareas'
import { useSession } from '../data/DataContext'
import { errorText } from '../data/actions'
import { DataError } from '../data/adapter'
import { useCollection, useDoc, useMembers } from '../data/hooks'
import { P } from '../data/paths'
import type { Checklist, Task } from '../data/types'
import { fmtDayShort } from '../domain/format'
import { Avatar, Button, Card, Empty, Loading, LoginPrompt, PageHeader, Pill, Section } from '../ui/components'
import { useToast } from '../ui/toast'

export function Tareas() {
  const { db, slug, memberId, isMember } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { rows, loading } = useCollection<Task>(isMember ? P.tasks(slug) : null)
  const [busy, setBusy] = useState<string | null>(null)
  const tasks = rows.filter((t) => t.status === 'OPEN' || t.status === 'DONE').sort((a, b) => a.order - b.order)

  async function volunteer(t: Task, join: boolean) {
    if (!memberId) return
    setBusy(t.id)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Task>(P.task(slug, t.id))
        if (!cur || cur.status !== 'OPEN') throw new DataError('STATE_CONFLICT', 'La tarea ya no está abierta.')
        const vols = { ...cur.volunteers }
        if (join) {
          if (vols[memberId]) return
          if (Object.keys(vols).length >= cur.capacity) throw new DataError('STATE_CONFLICT', 'Ya se ocupó el cupo.')
          vols[memberId] = { quantity: 1, status: 'OFFERED', at: Date.now() }
        } else {
          delete vols[memberId]
        }
        tx.set(P.task(slug, t.id), { ...cur, volunteers: vols, updatedAt: Date.now() })
      })
      toast.ok(join ? '¡Gracias! Quedaste anotado.' : 'Te bajaste de la tarea.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function markDone(t: Task) {
    if (!memberId) return
    setBusy(t.id)
    try {
      await db.runTransaction(async (tx) => {
        const cur = await tx.get<Task>(P.task(slug, t.id))
        if (!cur?.volunteers[memberId]) return
        const vols = { ...cur.volunteers, [memberId]: { ...cur.volunteers[memberId], status: 'DONE' as const } }
        tx.set(P.task(slug, t.id), { ...cur, volunteers: vols, updatedAt: Date.now() })
      })
      toast.ok('Marcado como hecho')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  if (!isMember) return <LoginPrompt text="Las tareas y compras son para la banda: entrá con tu usuario." />
  if (loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="Organización" title="Tareas y compras" intro="Ofrecete para lo que puedas. Agus crea las tareas y asigna lo que falte." />
      {tasks.length === 0 ? (
        <Empty title="Todavía no hay tareas publicadas" text="Cuando Agus publique tareas aparecen acá." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {tasks.map((t) => {
            const vols = Object.entries(t.volunteers ?? {})
            const mine = memberId ? t.volunteers?.[memberId] : undefined
            const full = vols.length >= t.capacity
            return (
              <Card key={t.id} className="flex flex-col">
                <div className="flex justify-between gap-2">
                  <p className="h3">{t.title}</p>
                  {t.status === 'DONE' ? <Pill tone="ok">Hecha</Pill> : full ? <Pill tone="muted">Cubierta</Pill> : <Pill>{t.capacity - vols.length} lugar{t.capacity - vols.length === 1 ? '' : 'es'}</Pill>}
                </div>
                {t.description ? <p className="small muted mt-1">{t.description}</p> : null}
                <p className="tiny muted mt-1">
                  {t.quantity ? `${t.quantity} ${t.unit ?? ''} · ` : ''}
                  {t.dueAt ? `para el ${fmtDayShort(t.dueAt)}` : 'sin plazo'}
                </p>
                <div className="flex flex-wrap gap-2 mt-3 flex-1">
                  {vols.map(([id, v]) => (
                    <span key={id} className="inline-flex items-center gap-1 tiny bg-soft text-accent rounded-full px-2 py-1">
                      <Avatar id={id} alias={members.aliasOf(id)} size={18} color={members.byId[id]?.avatarColor} />
                      {members.aliasOf(id)} {v.status === 'DONE' ? '✓' : ''}
                    </span>
                  ))}
                  {vols.length === 0 ? <span className="tiny muted">Nadie todavía.</span> : null}
                </div>
                {t.status === 'OPEN' ? (
                  <div className="flex gap-2 mt-3">
                    {mine ? (
                      <>
                        {mine.status !== 'DONE' ? (
                          <Button size="sm" onClick={() => void markDone(t)} loading={busy === t.id}>
                            Ya lo hice
                          </Button>
                        ) : null}
                        <Button size="sm" variant="line" onClick={() => void volunteer(t, false)} loading={busy === t.id}>
                          Me bajo
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="gold" disabled={full} onClick={() => void volunteer(t, true)} loading={busy === t.id}>
                        Me ofrezco
                      </Button>
                    )}
                  </div>
                ) : null}
              </Card>
            )
          })}
        </div>
      )}

      <Section title="Mi lista para llevar">
        <PersonalChecklist tasks={tasks} />
      </Section>
    </div>
  )
}

function PersonalChecklist({ tasks }: { tasks: Task[] }) {
  const { db, slug, memberId } = useSession()
  const mine = useDoc<Checklist>(memberId ? P.checklist(slug, memberId) : null)
  const [items, setItems] = useState<Record<string, boolean>>({})
  useEffect(() => setItems(mine.data?.items ?? {}), [mine.data])
  const committed = tasks.filter((t) => memberId && t.volunteers?.[memberId])
  async function toggle(key: string) {
    if (!memberId) return
    const next = { ...items, [key]: !items[key] }
    setItems(next)
    await db.setDoc<Checklist>(P.checklist(slug, memberId), { items: next, updatedAt: Date.now() })
  }
  const list = [...LISTA_PERSONAL, ...committed.map((t) => ({ key: 'task-' + t.id, label: t.title }))]
  return (
    <Card>
      <p className="tiny muted mb-2">Checks privados. No son gastos ni cambian el sorteo.</p>
      {list.map((i) => (
        <label key={i.key} className="row cursor-pointer">
          <span className={items[i.key] ? 'line-through muted' : ''}>{i.label}</span>
          <input type="checkbox" className="w-5 h-5" checked={!!items[i.key]} onChange={() => void toggle(i.key)} />
        </label>
      ))}
    </Card>
  )
}
