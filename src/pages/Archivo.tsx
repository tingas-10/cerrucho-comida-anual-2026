import { TEXTOS } from '../content/config'
import { useCollection } from '../data/hooks'
import { P } from '../data/paths'
import type { ArchiveEntry } from '../data/types'
import { Card, Empty, Loading, PageHeader, Pill } from '../ui/components'

export function Archivo() {
  const { rows, loading } = useCollection<ArchiveEntry>(P.archive)
  if (loading) return <Loading />
  const list = [...rows].sort((a, b) => b.year - a.year)
  return (
    <div>
      <PageHeader eyebrow="La banda" title="Archivo" intro="Cenas y premios de otros años. Los premios no revelados nunca se publican por archivar." />
      {list.length === 0 ? (
        <Empty title={TEXTOS.archivoVacio} text="Cuando se archive una edición, sus premios revelados y su cena aparecen acá." />
      ) : (
        <div className="grid gap-4">
          {list.map((e) => (
            <Card key={e.slug}>
              <div className="flex items-center justify-between gap-3 mb-2">
                <p className="h2">{e.title}</p>
                <Pill tone="muted">{e.year}</Pill>
              </div>
              {e.date || e.venue ? (
                <p className="small muted">
                  {e.date ?? ''}
                  {e.date && e.venue ? ' · ' : ''}
                  {e.venue ?? ''}
                </p>
              ) : null}
              {e.awards.length ? (
                <div className="mt-3">
                  {e.awards.map((a, i) => (
                    <div key={i} className="row">
                      <span>{a.label}</span>
                      <span className="font-semibold">
                        {a.winner}
                        {a.manual ? <span className="tiny muted ml-2">Procedencia manual</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="small muted mt-2">Sin premios registrados.</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
