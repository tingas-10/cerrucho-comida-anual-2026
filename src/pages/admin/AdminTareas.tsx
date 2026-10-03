// Tareas: crear, publicar, asignar voluntarios y cerrar.
import { useState } from 'react'
import { useSession } from '../../data/DataContext'
import { errorText, logAudit } from '../../data/actions'
import { useCollection, useMembers } from '../../data/hooks'
import { P } from '../../data/paths'
import { slugify } from '../../data/seed'
import type { Task } from '../../data/types'
import { localToMs, msToLocalParts } from '../../domain/format'
import { Button, Card, Field, Input, Modal, Pill, Textarea } from '../../ui/components'
import { useToast } from '../../ui/toast'

export function AdminTareas() {
  const { db, slug, memberId } = useSession()
  const toast = useToast()
  const members = useMembers()
  const { rows } = useCollection<Task>(P.tasks(slug))
  const tasks = [...rows].sort((a, b) => a.order - b.order)
  const [editing, setEditing] = useState<Task | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', quantity: '', unit: '', due: '', capacity: 1, cost: '' })
  const [busy, setBusy] = useState(false)

  function open(t: Task | null) {
    setEditing(t)
    setIsNew(!t)
    setForm({ title: t?.title ?? '', description: t?.description ?? '', quantity: t?.quantity ? String(t.quantity) : '', unit: t?.unit ?? '', due: msToLocalParts(t?.dueAt).date, capacity: t?.capacity ?? 1, cost: t?.estimatedCostCents ? String(t.estimatedCostCents / 100) : '' })
  }

  async function save() {
    if (form.title.trim().length < 2) {
      toast.error('Poné un título.')
      return
    }
    setBusy(true)
    try {
      const now = Date.now()
      const base = editing ?? { id: slugify(form.title) + '-' + db.newId().slice(0, 4).toLowerCase(), volunteers: {}, status: 'DRAFT' as const, order: tasks.length, createdAt: now }
      const t: Task = {
        ...base,
        title: form.title.trim(),
        description: form.description.trim(),
        quantity: form.quantity ? Number(form.quantity) : null,
        unit: form.unit.trim(),
        dueAt: form.due ? localToMs(form.due, '23:59') : null,
        capacity: Math.max(1, Number(form.capacity) || 1),
        estimatedCostCents: form.cost ? Math.round(Number(form.cost.replace(',', '.')) * 100) : null,
        updatedAt: now,
      }
      await db.setDoc(P.task(slug, t.id), t)
      setEditing(null)
      setIsNew(false)
      toast.ok('Guardado')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(t: Task, status: Task['status']) {
    try {
      await db.updateDoc(P.task(slug, t.id), { status, updatedAt: Date.now() })
      if (status === 'OPEN') await logAudit(db, slug, memberId!, 'task.publish', t.id)
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  async function assign(t: Task, id: string, add: boolean) {
    try {
      const vols = { ...t.volunteers }
      if (add) vols[id] = { quantity: 1, status: 'OFFERED', at: Date.now() }
      else delete vols[id]
      await db.setDoc(P.task(slug, t.id), { ...t, volunteers: vols, updatedAt: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant="gold" onClick={() => open(null)}>
          Nueva tarea
        </Button>
        <Button
          variant="line"
          onClick={async () => {
            for (const t of tasks.filter((x) => x.status === 'DRAFT')) await setStatus(t, 'OPEN')
            toast.ok('Tareas publicadas')
          }}
        >
          Publicar todos los borradores
        </Button>
      </div>
      <Card>
        {tasks.map((t) => {
          const vols = Object.keys(t.volunteers ?? {})
          return (
            <div key={t.id} className="row items-start">
              <div className="small">
                <p className="font-semibold">
                  {t.title}{' '}
                  {t.status === 'DRAFT' ? <Pill tone="muted">Borrador</Pill> : t.status === 'OPEN' ? <Pill tone="ok">Publicada</Pill> : t.status === 'DONE' ? <Pill>Hecha</Pill> : <Pill tone="muted">Archivada</Pill>}
                </p>
                <p className="tiny muted">
                  Cupo {vols.length}/{t.capacity}
                  {t.dueAt ? ` · vence ${msToLocalParts(t.dueAt).date}` : ''}
                  {vols.length ? ` · ${vols.map((id) => `${members.aliasOf(id)}${t.volunteers[id].status === 'DONE' ? ' ✓' : ''}`).join(', ')}` : ''}
                </p>
                <div className="flex gap-1 flex-wrap mt-1 items-center">
                  <select className="input w-auto min-h-[40px] py-1.5" aria-label={`Asignar a ${t.title}`} value="" onChange={(e) => e.target.value && void assign(t, e.target.value, true)}>
                    <option value="">Asignar a…</option>
                    {members.active.filter((m) => !t.volunteers?.[m.id]).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.alias}
                      </option>
                    ))}
                  </select>
                  {vols.map((id) => (
                    <button key={id} type="button" className="tiny underline min-h-[40px] px-1" onClick={() => void assign(t, id, false)}>
                      quitar {members.aliasOf(id)}
                    </button>
                  ))}
                </div>
              </div>
              <span className="flex gap-1 flex-wrap justify-end">
                <Button size="sm" variant="line" onClick={() => open(t)}>
                  Editar
                </Button>
                {t.status === 'DRAFT' ? (
                  <Button size="sm" onClick={() => void setStatus(t, 'OPEN')}>
                    Publicar
                  </Button>
                ) : null}
                {t.status === 'OPEN' ? (
                  <Button size="sm" variant="line" onClick={() => void setStatus(t, 'DONE')}>
                    Marcar hecha
                  </Button>
                ) : null}
                {t.status !== 'ARCHIVED' ? (
                  <Button size="sm" variant="line" onClick={() => void setStatus(t, 'ARCHIVED')}>
                    Archivar
                  </Button>
                ) : (
                  <Button size="sm" variant="line" onClick={() => void setStatus(t, 'DRAFT')}>
                    Restaurar
                  </Button>
                )}
              </span>
            </div>
          )
        })}
      </Card>

      <Modal open={!!editing || isNew} onClose={() => { setEditing(null); setIsNew(false) }} title={editing ? 'Editar tarea' : 'Nueva tarea'}>
        <Field label="Título" id="t-title">
          <Input id="t-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Field>
        <Field label="Descripción" id="t-desc">
          <Textarea id="t-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad" id="t-qty">
            <Input id="t-qty" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="Unidad" id="t-unit">
            <Input id="t-unit" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          </Field>
          <Field label="Plazo" id="t-due">
            <Input id="t-due" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} />
          </Field>
          <Field label="Cupo de voluntarios" id="t-cap">
            <Input id="t-cap" type="number" min={1} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          </Field>
          <Field label="Costo estimado (ARS)" id="t-cost">
            <Input id="t-cost" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
          </Field>
        </div>
        <Button variant="gold" onClick={() => void save()} loading={busy}>
          Guardar
        </Button>
      </Modal>
    </div>
  )
}
