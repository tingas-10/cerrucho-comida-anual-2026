// Golf · Canchas: agrupadas por club, con su mapa, tarjeta y consejos de caddy.
// Las carga y cambia la comisión (2 aprobaciones). El resto las ve.
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../../data/DataContext'
import { errorText } from '../../data/actions'
import { proposeGolf } from '../../data/golf'
import type { GolfCourse, GolfHole } from '../../data/types'
import { parTotal } from '../../domain/golf'
import { Button, Empty, Field, Input, Loading, Modal, Notice, PageHeader, Section } from '../../ui/components'
import { useToast } from '../../ui/toast'
import { GolfTabs, courseGroups, useGolfCourses } from './golfShared'

function blankHoles(n: number): GolfHole[] {
  return Array.from({ length: n }, (_, i) => ({ par: 4, si: i + 1, meters: null, tip: null, mapRef: null }))
}

export function GolfCanchas() {
  const { isGolfComm, golfPreview } = useSession()
  const showTools = isGolfComm || golfPreview
  const courses = useGolfCourses()
  const [editing, setEditing] = useState(false)

  if (courses.loading) return <Loading />
  return (
    <div>
      <PageHeader
        eyebrow="Golf"
        title="Canchas"
        intro="Cada cancha con su mapa, la tarjeta (par, dificultad y metros de cada hoyo), consejos de caddy y los récords de la banda. Las carga la comisión: cada cambio necesita 2 aprobaciones."
        actions={
          showTools ? (
            <Button variant="gold" onClick={() => setEditing(true)}>
              Proponer cancha nueva
            </Button>
          ) : null
        }
      />
      <GolfTabs />
      {courses.active.length === 0 ? (
        <Empty title="Todavía no hay canchas" text="Mientras tanto, al armar un partido se puede cargar el par a mano." />
      ) : (
        courseGroups(courses.active).map((g) => (
          <Section key={g.club} title={g.club} className="mt-0 mb-4">
            <div className="grid sm:grid-cols-2 gap-2">
              {g.items.map((c) => (
                <Link key={c.id} to={`/golf/cancha/${c.id}`} className="card flex items-center justify-between gap-3 !py-3 hover:bg-soft/60">
                  <span className="min-w-0">
                    <span className="font-bold block truncate">{c.name.split(' · ')[1] ?? c.name}</span>
                    <span className="small muted">
                      {c.holes.length} hoyos · par {parTotal(c.holes)}
                      {c.holes.some((h) => h.mapRef) ? ' · con mapa de cada hoyo' : ''}
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 muted" />
                </Link>
              ))}
            </div>
          </Section>
        ))
      )}
      {!showTools ? <p className="tiny muted mt-4">¿Falta una cancha o hay un error? Pedíselo a la comisión de golf.</p> : null}
      {editing ? <CourseEditor course={null} onClose={() => setEditing(false)} /> : null}
    </div>
  )
}

export function CourseEditor({ course, onClose }: { course: GolfCourse | null; onClose: () => void }) {
  const { db, memberId, isGolfComm } = useSession()
  const toast = useToast()
  const [name, setName] = useState(course?.name ?? '')
  const [holes, setHoles] = useState<GolfHole[]>(course?.holes ?? blankHoles(18))
  const [busy, setBusy] = useState(false)
  const n = holes.length
  const si = holes.map((h) => h.si)
  const siOk = si.every((v) => Number.isInteger(v) && v >= 1 && v <= n) && new Set(si).size === n
  const valid = name.trim().length >= 2 && siOk
  const setHole = (i: number, patch: Partial<GolfHole>) => setHoles(holes.map((x, j) => (j === i ? { ...x, ...patch } : x)))

  async function propose(archived: boolean) {
    if (!memberId || !isGolfComm) return
    setBusy(true)
    try {
      const courseId = course?.id ?? db.newId()
      const clean = holes.map((h) => ({ par: h.par, si: h.si, meters: h.meters ?? null, tip: h.tip?.trim() || null, mapRef: h.mapRef ?? null }))
      const summary = archived ? `Archivar la cancha ${course!.name}` : course ? `Cambiar la cancha ${course.name} (${n} hoyos, par ${parTotal(holes)})` : `Cancha nueva: ${name.trim()} (${n} hoyos, par ${parTotal(holes)})`
      await proposeGolf(db, memberId, summary, { type: 'course', courseId, name: archived ? course!.name : name.trim(), holes: archived ? course!.holes : clean, archived })
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
        <Field label="Nombre (Club · Recorrido)" id="gc-name">
          <Input id="gc-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="ej. Golf Club Pilar · Azul" />
        </Field>
        <Field label="Hoyos" id="gc-n">
          <select id="gc-n" className="input" value={n} onChange={(e) => setHoles(blankHoles(Number(e.target.value)).map((h, i) => holes[i] ?? h).map((h, i) => ({ ...h, si: i + 1 })))}>
            <option value={9}>9</option>
            <option value={18}>18</option>
          </select>
        </Field>
      </div>
      <p className="label">Par, dificultad (1 = el más difícil), metros y consejo de caddy de cada hoyo.</p>
      <div className="grid gap-2">
        {holes.map((h, i) => (
          <div key={i} className="rounded-lg border border-line p-2">
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center">
              <span className="font-bold w-8">{i + 1}</span>
              <select className="input !px-1 text-center" value={h.par} onChange={(e) => setHole(i, { par: Number(e.target.value) })} aria-label={`Par del hoyo ${i + 1}`}>
                {[3, 4, 5, 6].map((p) => (
                  <option key={p} value={p}>
                    Par {p}
                  </option>
                ))}
              </select>
              <input className="input !px-1 text-center" type="number" inputMode="numeric" min={1} max={n} value={h.si} onChange={(e) => setHole(i, { si: Math.floor(Number(e.target.value)) || 0 })} aria-label={`Dificultad del hoyo ${i + 1}`} />
              <input className="input !px-1 text-center" type="number" inputMode="numeric" min={0} placeholder="metros" value={h.meters ?? ''} onChange={(e) => setHole(i, { meters: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value)) || 0) })} aria-label={`Metros del hoyo ${i + 1}`} />
            </div>
            <textarea className="input mt-2 !min-h-[44px]" rows={2} maxLength={400} placeholder="Consejo de caddy (opcional)" value={h.tip ?? ''} onChange={(e) => setHole(i, { tip: e.target.value })} aria-label={`Consejo del hoyo ${i + 1}`} />
          </div>
        ))}
      </div>
      <p className="small mt-3">Par total: {parTotal(holes)}</p>
      {!siOk ? <Notice tone="warn">La dificultad tiene que ir del 1 al {n} sin repetirse.</Notice> : null}
      <div className="flex gap-2 flex-wrap mt-3">
        <Button variant="gold" onClick={() => void propose(false)} disabled={!valid || !isGolfComm} loading={busy}>
          Proponer
        </Button>
        {course ? (
          <Button variant="line" onClick={() => void propose(true)} disabled={!isGolfComm} loading={busy}>
            Proponer archivarla
          </Button>
        ) : null}
      </div>
      <p className="tiny muted mt-2">Se aplica cuando otro comisionado la aprueba en Comisión.</p>
    </Modal>
  )
}

