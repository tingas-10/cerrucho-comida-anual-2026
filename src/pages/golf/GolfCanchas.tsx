// Golf · Canchas: las carga y cambia la comisión (2 aprobaciones). El resto las ve.
import { useState } from 'react'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf } from '../../data/golf'
import type { GolfCourse, GolfHole } from '../../data/types'
import { parTotal, siOf } from '../../domain/golf'
import { Button, Card, Empty, Field, Input, Loading, Modal, Notice, PageHeader } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { GolfTabs, useGolfCourses } from './golfShared'

function blankHoles(n: number): GolfHole[] {
  return Array.from({ length: n }, (_, i) => ({ par: 4, si: i + 1 }))
}

export function GolfCanchas() {
  const { isGolfComm } = useSession()
  const courses = useGolfCourses()
  const [open, setOpen] = useState<string | null>(null)
  const [editing, setEditing] = useState<GolfCourse | 'new' | null>(null)

  if (courses.loading) return <Loading />
  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Canchas"
        intro="Par e índice de dificultad de cada hoyo (sirve para repartir los golpes del hándicap). Las carga la comisión: cada cambio necesita 2 aprobaciones."
        actions={
          isGolfComm ? (
            <Button variant="gold" onClick={() => setEditing('new')}>
              Proponer cancha nueva
            </Button>
          ) : null
        }
      />
      <GolfTabs />
      {courses.active.length === 0 ? (
        <Empty title="Todavía no hay canchas" text="Mientras tanto, al armar un partido se puede cargar el par a mano." />
      ) : (
        <div className="grid gap-3">
          {courses.active.map((c) => (
            <Card key={c.id}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="h3">{c.name}</p>
                  <p className="small muted">
                    {c.holes.length} hoyos · par {parTotal(c.holes)}
                  </p>
                </div>
                <span className="flex gap-2">
                  <Button size="sm" variant="line" onClick={() => setOpen(open === c.id ? null : c.id)}>
                    {open === c.id ? 'Ocultar hoyos' : 'Ver hoyos'}
                  </Button>
                  {isGolfComm ? (
                    <Button size="sm" variant="line" onClick={() => setEditing(c)}>
                      Proponer cambios
                    </Button>
                  ) : null}
                </span>
              </div>
              {open === c.id ? (
                <div className="grid grid-cols-6 sm:grid-cols-9 gap-1 mt-3 text-center">
                  {c.holes.map((h, i) => (
                    <div key={i} className="rounded-lg border border-line py-1">
                      <p className="tiny muted">Hoyo {i + 1}</p>
                      <p className="font-bold">Par {h.par}</p>
                      <p className="tiny muted">Índ. {siOf(c.holes)[i]}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}
      {!isGolfComm ? <p className="tiny muted mt-4">¿Falta una cancha o hay un error? Pedíselo a la comisión de golf.</p> : null}
      {editing ? <CourseEditor course={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

function CourseEditor({ course, onClose }: { course: GolfCourse | null; onClose: () => void }) {
  const { db, memberId } = useSession()
  const toast = useToast()
  const [name, setName] = useState(course?.name ?? '')
  const [holes, setHoles] = useState<GolfHole[]>(course?.holes ?? blankHoles(18))
  const [busy, setBusy] = useState(false)
  const n = holes.length
  const si = holes.map((h) => h.si)
  const siOk = si.every((v) => Number.isInteger(v) && v >= 1 && v <= n) && new Set(si).size === n
  const valid = name.trim().length >= 2 && siOk

  async function propose(archived: boolean) {
    if (!memberId) return
    setBusy(true)
    try {
      const courseId = course?.id ?? db.newId()
      const summary = archived ? `Archivar la cancha ${course!.name}` : course ? `Cambiar la cancha ${course.name} (${n} hoyos, par ${parTotal(holes)})` : `Cancha nueva: ${name.trim()} (${n} hoyos, par ${parTotal(holes)})`
      await proposeGolf(db, memberId, summary, { type: 'course', courseId, name: archived ? course!.name : name.trim(), holes: archived ? course!.holes : holes, archived })
      toast.ok('Propuesta enviada. Se aplica cuando otro de la comisión la apruebe.')
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={course ? `Cambios en ${course.name}` : 'Cancha nueva'} wide>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Field label="Nombre" id="gc-name">
          <Input id="gc-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="ej. Golf Club Pilar" />
        </Field>
        <Field label="Hoyos" id="gc-n">
          <select id="gc-n" className="input" value={n} onChange={(e) => setHoles(blankHoles(Number(e.target.value)).map((h, i) => holes[i] ?? h).map((h, i) => ({ ...h, si: i + 1 })))}>
            <option value={9}>9</option>
            <option value={18}>18</option>
          </select>
        </Field>
      </div>
      <p className="label">Par e índice de dificultad (1 = el más difícil). Si no lo sabés, dejá el orden de los hoyos.</p>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {holes.map((h, i) => (
          <div key={i} className="rounded-lg border border-line p-1.5 text-center">
            <p className="tiny muted mb-1">Hoyo {i + 1}</p>
            <select className="input !px-1 text-center mb-1" value={h.par} onChange={(e) => setHoles(holes.map((x, j) => (j === i ? { ...x, par: Number(e.target.value) } : x)))} aria-label={`Par del hoyo ${i + 1}`}>
              {[3, 4, 5, 6].map((p) => (
                <option key={p} value={p}>
                  Par {p}
                </option>
              ))}
            </select>
            <input
              className="input !px-1 text-center"
              type="number"
              inputMode="numeric"
              min={1}
              max={n}
              value={h.si}
              onChange={(e) => setHoles(holes.map((x, j) => (j === i ? { ...x, si: Math.floor(Number(e.target.value)) || 0 } : x)))}
              aria-label={`Índice del hoyo ${i + 1}`}
            />
          </div>
        ))}
      </div>
      <p className="small mt-3">Par total: {parTotal(holes)}</p>
      {!siOk ? <Notice tone="warn">Los índices tienen que ir del 1 al {n} sin repetirse.</Notice> : null}
      <div className="flex gap-2 flex-wrap mt-3">
        <Button variant="gold" onClick={() => void propose(false)} disabled={!valid} loading={busy}>
          Proponer
        </Button>
        {course ? (
          <Button variant="line" onClick={() => void propose(true)} loading={busy}>
            Proponer archivarla
          </Button>
        ) : null}
      </div>
      <p className="tiny muted mt-2">Se aplica cuando otro comisionado la aprueba en Comisión.</p>
    </Modal>
  )
}
