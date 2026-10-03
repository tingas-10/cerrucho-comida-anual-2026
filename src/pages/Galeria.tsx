// Galería: fotos del repo (sin costo), filtros, lightbox y reacciones simples.
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GRUPO, TEXTOS } from '../content/config'
import { ALBUMES, FOTOS, type Foto } from '../content/galeria'
import { useSession } from '../data/DataContext'
import { useCollection } from '../data/hooks'
import { P } from '../data/paths'
import type { Reaction } from '../data/types'
import { Button, Empty, Modal, PageHeader, Segmented } from '../ui/components'
import { useToast } from '../ui/toast'

const BASE = import.meta.env.BASE_URL
const EMOJIS = ['❤️', '😂', '🔥', '🫠']

export function Galeria() {
  const { db, memberId } = useSession()
  const toast = useToast()
  const [album, setAlbum] = useState<string>('todos')
  const [kind, setKind] = useState<'all' | 'photo' | 'meme'>('all')
  const [open, setOpen] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const { rows: reactions } = useCollection<Reaction>(P.reactions)

  const list = useMemo(
    () => FOTOS.filter((f) => (album === 'todos' || f.album === album) && (kind === 'all' || f.kind === kind)),
    [album, kind],
  )
  const reactionsOf = useCallback((photoId: string) => reactions.filter((r) => r.photoId === photoId), [reactions])

  async function react(photo: Foto, emoji: string) {
    if (!memberId) return
    const mine = reactions.find((r) => r.photoId === photo.id && r.memberId === memberId)
    try {
      if (mine && mine.emoji === emoji) await db.deleteDoc(P.reaction(photo.id, memberId))
      else await db.setDoc<Reaction>(P.reaction(photo.id, memberId), { photoId: photo.id, memberId, emoji })
    } catch {
      toast.error('No se pudo guardar la reacción.')
    }
  }

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setOpen((i) => (i === null ? null : (i + 1) % list.length))
      if (e.key === 'ArrowLeft') setOpen((i) => (i === null ? null : (i - 1 + list.length) % list.length))
      if (e.key === 'Escape') setOpen(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, list.length])

  return (
    <div>
      <PageHeader
        eyebrow="La banda"
        title="Galería"
        intro="Recuerdos de la banda. Las fotos que mandan al grupo las sube Agus acá."
        actions={
          <Button variant="gold" onClick={() => setUploadOpen(true)}>
            Subir fotos
          </Button>
        }
      />
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <Segmented
          ariaLabel="Álbum"
          value={album}
          onChange={setAlbum}
          options={[{ value: 'todos', label: 'Todos' }, ...ALBUMES.map((a) => ({ value: a.id, label: a.titulo }))]}
        />
        <Segmented
          ariaLabel="Tipo"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'photo', label: 'Fotos' },
            { value: 'meme', label: 'Memes' },
          ]}
        />
      </div>
      {list.length === 0 ? (
        <Empty title={TEXTOS.galeriaVacia} />
      ) : (
        <div className="masonry">
          {list.map((f, i) => {
            const rs = reactionsOf(f.id)
            return (
              <figure key={f.id} className="card overflow-hidden">
                <button type="button" className="block w-full" onClick={() => setOpen(i)} aria-label={`Abrir ${f.caption ?? 'foto'}`}>
                  {f.kind === 'video' ? (
                    <video className="w-full block" src={BASE + f.src} poster={f.poster ? BASE + f.poster : undefined} preload="metadata" muted playsInline />
                  ) : (
                    <img src={BASE + f.src} alt={f.caption ?? ''} width={f.ancho} height={f.alto} loading="lazy" className="w-full h-auto block" />
                  )}
                </button>
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2">
                  <span className="tiny muted truncate">{f.caption ?? ALBUMES.find((a) => a.id === f.album)?.titulo}</span>
                  <span className="flex gap-1">
                    {EMOJIS.map((e) => {
                      const n = rs.filter((r) => r.emoji === e).length
                      const mine = rs.some((r) => r.emoji === e && r.memberId === memberId)
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() => void react(f, e)}
                          aria-pressed={mine}
                          className={`inline-flex items-center justify-center min-w-[38px] min-h-[38px] text-base rounded-full px-1.5 border ${mine ? 'border-accent bg-soft' : 'border-transparent'}`}
                          aria-label={`Reaccionar ${e}`}
                        >
                          {e}
                          {n > 0 ? <span className="tiny ml-0.5">{n}</span> : null}
                        </button>
                      )
                    })}
                  </span>
                </figcaption>
              </figure>
            )
          })}
        </div>
      )}

      {open !== null && list[open] ? (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col" role="dialog" aria-modal="true" aria-label="Foto ampliada">
          <div className="flex items-center justify-between p-3 text-white/80 text-sm">
            <span>
              {open + 1} de {list.length} · {list[open].caption ?? ''}
            </span>
            <button type="button" className="btn btn-line btn-sm text-white border-white/30" onClick={() => setOpen(null)} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center relative px-2 min-h-0">
            <button type="button" className="absolute left-2 p-3 text-white/80 hidden sm:block" onClick={() => setOpen((open - 1 + list.length) % list.length)} aria-label="Anterior">
              <ChevronLeft size={32} />
            </button>
            {list[open].kind === 'video' ? (
              <video className="max-h-full max-w-full" src={BASE + list[open].src} controls playsInline />
            ) : (
              <img src={BASE + list[open].src} alt={list[open].caption ?? ''} className="max-h-full max-w-full object-contain" />
            )}
            <button type="button" className="absolute right-2 p-3 text-white/80 hidden sm:block" onClick={() => setOpen((open + 1) % list.length)} aria-label="Siguiente">
              <ChevronRight size={32} />
            </button>
          </div>
          <div className="flex justify-center gap-6 p-3 sm:hidden">
            <button type="button" className="btn btn-line text-white border-white/30" onClick={() => setOpen((open - 1 + list.length) % list.length)}>
              <ChevronLeft size={18} /> Anterior
            </button>
            <button type="button" className="btn btn-line text-white border-white/30" onClick={() => setOpen((open + 1) % list.length)}>
              Siguiente <ChevronRight size={18} />
            </button>
          </div>
        </div>
      ) : null}

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Subir fotos">
        {GRUPO.albumCompartidoUrl ? (
          <>
            <p className="small muted">Subilas al álbum compartido de la banda. Después Agus las pasa a la galería.</p>
            <a className="btn btn-gold mt-4" href={GRUPO.albumCompartidoUrl} target="_blank" rel="noopener noreferrer">
              Abrir álbum compartido
            </a>
          </>
        ) : (
          <>
            <p className="small muted">
              Para que la galería no tenga costo, las fotos viven en la web. Mandalas por WhatsApp a Agus (o al grupo) y él las sube acá.
            </p>
            <p className="tiny muted mt-3">Formatos: fotos JPG, PNG o WebP.</p>
          </>
        )}
      </Modal>
    </div>
  )
}
