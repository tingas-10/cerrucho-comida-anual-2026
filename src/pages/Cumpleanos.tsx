// Cumpleaños de la banda: público. Muestra día y mes (nunca el año ni la edad).
import { Cake } from 'lucide-react'
import { useMemo } from 'react'
import { useNow, useMembers } from '../data/hooks'
import { MESES, byMonth, formatBirthday, todayBA, upcoming } from '../domain/birthdays'
import { Card, Empty, Loading, MemberAvatar, PageHeader, Pill, Section } from '../ui/components'

export function Cumpleanos() {
  const members = useMembers()
  const now = useNow(60000)
  const people = useMemo(() => members.list.filter((m) => m.status !== 'suspended'), [members.list])
  const next = useMemo(() => upcoming(people, 5, now), [people, now])
  const months = useMemo(() => byMonth(people), [people])
  const missing = people.filter((m) => !m.birthday).length
  const today = todayBA(now)

  if (members.loading) return <Loading />
  return (
    <div>
      <PageHeader eyebrow="La banda" title="Cumpleaños" intro="Para que nadie se olvide de saludar." />
      {next.length === 0 ? (
        <Empty title="Todavía nadie cargó su cumpleaños" text="Cada uno lo carga al entrar por primera vez o desde Mi perfil." />
      ) : (
        <Card>
          <p className="h3 mb-2">Próximos</p>
          {next.map((p) => (
            <div key={p.id} className="row">
              <span className="flex items-center gap-3 min-w-0">
                <MemberAvatar id={p.id} size={36} />
                <span className="min-w-0">
                  <span className="font-semibold block truncate">{p.alias}</span>
                  <span className="tiny muted">{formatBirthday(p.birthday!)}</span>
                </span>
              </span>
              {p.days === 0 ? (
                <Pill>
                  <Cake size={12} /> ¡Hoy!
                </Pill>
              ) : p.days === 1 ? (
                <Pill tone="warn">Mañana</Pill>
              ) : (
                <span className="small muted whitespace-nowrap">en {p.days} días</span>
              )}
            </div>
          ))}
        </Card>
      )}

      {months.length ? (
        <Section title="Por mes">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {months.map(({ month, people: list }) => (
              <Card key={month} className={month === today.m ? 'border-accent' : ''}>
                <p className="eyebrow mb-2">{MESES[month - 1]}</p>
                {list.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-7 text-right font-extrabold tabular-nums">{p.birthday!.d}</span>
                    <MemberAvatar id={p.id} size={28} />
                    <span className="small font-semibold truncate">{p.alias}</span>
                    {p.birthday!.m === today.m && p.birthday!.d === today.d ? <Cake size={16} className="text-accent shrink-0" aria-label="Cumple hoy" /> : null}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
      {missing > 0 ? <p className="tiny muted mt-4">Faltan cargar {missing} cumpleaños.</p> : null}
    </div>
  )
}
