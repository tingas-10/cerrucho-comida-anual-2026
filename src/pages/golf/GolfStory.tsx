// Golf · Historia para Instagram (1080 x 1920): cancha, posiciones y una foto de golf con una frase para el ganador.
// Si gana Pato, siempre sale Gary Player. Se dibuja en el navegador con canvas; cualquiera la puede bajar o compartir.
import { Dices, Download, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { GRUPO } from '../../content/config'
import { GOLF_HISTORIA } from '../../content/golf'
import type { GolfRound } from '../../data/types'
import { fmtDayLong, initials } from '../../domain/format'
import { golfStoryData } from '../../domain/golfStory'
import { Button, Modal } from '../../ui/components'
import { drawCover, fitText, loadImage, roundRect } from '../fmo/FmoStory'
import type { FmoPlayers } from '../fmo/fmoShared'
import { entrantName, modeLabel } from './golfShared'

const W = 1080
const H = 1920
const BASE = import.meta.env.BASE_URL
const GOLD = '#d9b45f'
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif"
const MEDAL = ['#d9b45f', '#c3c7d1', '#c98a52']

/** Corta la frase en una o dos líneas, con la letra más grande que entre. */
function phraseLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): { lines: string[]; size: number } {
  for (let s = 54; s >= 44; s -= 2) {
    ctx.font = `800 ${s}px ${FONT}`
    if (ctx.measureText(text).width <= maxW) return { lines: [text], size: s }
  }
  const words = text.split(' ')
  let best: string[] = [text]
  let bestW = Infinity
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const w = Math.max(ctx.measureText(a).width, ctx.measureText(b).width)
    if (w < bestW) {
      bestW = w
      best = [a, b]
    }
  }
  let s = 50
  ctx.font = `800 ${s}px ${FONT}`
  while (s > 30 && Math.max(...best.map((l) => ctx.measureText(l).width)) > maxW) {
    s -= 2
    ctx.font = `800 ${s}px ${FONT}`
  }
  return { lines: best, size: s }
}

async function drawStory(canvas: HTMLCanvasElement, r: GolfRound, players: FmoPlayers, roll: number) {
  await Promise.all([document.fonts.load(`800 80px ${FONT}`), document.fonts.load(`500 30px ${FONT}`)]).catch(() => undefined)
  const d = golfStoryData(r, roll, GOLF_HISTORIA)
  const pic = (d.gary ? GOLF_HISTORIA.gary : GOLF_HISTORIA.otras)[d.imageIndex]
  const frase = GOLF_HISTORIA.frases[d.phraseIndex]
  const [photo, logo] = await Promise.all([loadImage(BASE + pic.src), loadImage(BASE + 'logo-512.png')])
  const chosen = d.chosenId ? players.byId[d.chosenId] : null
  const chosenPhoto = chosen?.photo ? await loadImage(chosen.photo) : null
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'

  // Fondo: verde de cancha, con un green y su bandera
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0b1410')
  bg.addColorStop(0.5, '#103a22')
  bg.addColorStop(1, '#1b5a31')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,.04)'
  ctx.beginPath()
  ctx.ellipse(W / 2, 1250, 520, 380, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,.18)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.moveTo(960, 120)
  ctx.lineTo(960, 230)
  ctx.stroke()
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(963, 120)
  ctx.lineTo(1030, 145)
  ctx.lineTo(963, 170)
  ctx.fill()

  // Encabezado
  if (logo) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(140, 150, 62, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(logo, 78, 88, 124, 124)
    ctx.restore()
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = GOLD
  ctx.font = `800 54px ${FONT}`
  ctx.fillText('GOLF', 230, 140)
  ctx.fillStyle = '#c9ccd6'
  ctx.font = `500 30px ${FONT}`
  ctx.fillText(`${GRUPO.nombre} · ${fmtDayLong(r.playedAt)}`, 230, 188)

  // Cancha, modalidad y posiciones
  const rows = d.standings.length > 4 ? d.standings.slice(0, 3) : d.standings
  const more = d.standings.length - rows.length
  const cardY = 260
  const cardH = 170 + (rows.length + (more ? 1 : 0)) * 68
  ctx.fillStyle = 'rgba(255,255,255,.07)'
  roundRect(ctx, 60, cardY, W - 120, cardH, 40)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  fitText(ctx, r.course.name, W - 220, 44)
  ctx.fillText(r.course.name, 110, cardY + 78)
  ctx.fillStyle = GOLD
  ctx.font = `800 26px ${FONT}`
  ctx.fillText(modeLabel(r).toUpperCase(), 110, cardY + 126)
  rows.forEach((s, i) => {
    const y = cardY + 200 + i * 68
    const e = r.entrants.find((x) => x.id === s.entrantId)
    const medal = MEDAL[s.position - 1] ?? 'rgba(255,255,255,.25)'
    ctx.fillStyle = medal
    ctx.beginPath()
    ctx.arc(132, y - 12, 24, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#191409'
    ctx.textAlign = 'center'
    ctx.font = `800 26px ${FONT}`
    ctx.fillText(String(s.position), 132, y - 3)
    ctx.textAlign = 'right'
    ctx.fillStyle = s.position === 1 ? GOLD : '#ffffff'
    ctx.font = `800 36px ${FONT}`
    ctx.fillText(s.label, W - 110, y)
    const labelW = ctx.measureText(s.label).width
    ctx.textAlign = 'left'
    const name = e ? entrantName(e, players) : '—'
    fitText(ctx, name, W - 110 - labelW - 40 - 176, 38, s.position === 1 ? 800 : 500, 24)
    ctx.fillText(name, 176, y)
  })
  if (more) {
    ctx.fillStyle = '#9ca1ae'
    ctx.font = `500 30px ${FONT}`
    ctx.fillText(`+${more} más`, 176, cardY + 200 + rows.length * 68)
  }

  // Foto
  const ix = 110
  const iy = cardY + cardH + 50
  const iw = W - 220
  const ih = 1460 - iy
  ctx.save()
  roundRect(ctx, ix, iy, iw, ih, 44)
  ctx.clip()
  if (photo) drawCover(ctx, photo, ix, iy, iw, ih, pic.y, pic.x)
  else {
    ctx.fillStyle = '#222'
    ctx.fillRect(ix, iy, iw, ih)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.lineWidth = 4
  roundRect(ctx, ix, iy, iw, ih, 44)
  ctx.stroke()

  // Globo con la frase y el ganador
  const name = chosen?.name ?? (d.chosenId ? players.nameOf(d.chosenId) : 'Nadie')
  const bx = 70
  const by = 1520
  const bw = W - 140
  const bh = 300
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(W / 2 - 40, by + 2)
  ctx.lineTo(W / 2 + 10, by - 60)
  ctx.lineTo(W / 2 + 50, by + 2)
  ctx.fill()
  roundRect(ctx, bx, by, bw, bh, 36)
  ctx.fill()
  const hasAvatar = !!d.chosenId
  const textW = hasAvatar ? bw - 260 : bw - 80
  const textX = hasAvatar ? bx + 50 : W / 2
  ctx.textAlign = hasAvatar ? 'left' : 'center'
  ctx.fillStyle = '#191409'
  const ph = phraseLines(ctx, `“${frase}`, textW)
  const lineH = ph.size * 1.12
  const nameSize = 92
  const blockH = ph.lines.length * lineH + nameSize * 1.05
  let ty = by + (bh - blockH) / 2 + ph.size * 0.9
  ctx.font = `800 ${ph.size}px ${FONT}`
  for (const l of ph.lines) {
    ctx.fillText(l, textX, ty)
    ty += lineH
  }
  fitText(ctx, `${name}!!!”`, textW, nameSize)
  ctx.fillText(`${name}!!!”`, textX, ty + nameSize * 0.82)
  if (hasAvatar) {
    const cx = bx + bw - 115
    const cy = by + bh / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 85, 0, Math.PI * 2)
    ctx.fillStyle = chosen?.color ?? '#3a4a3f'
    ctx.fill()
    ctx.clip()
    if (chosenPhoto) drawCover(ctx, chosenPhoto, cx - 85, cy - 85, 170, 170)
    else {
      ctx.fillStyle = '#191409'
      ctx.textAlign = 'center'
      ctx.font = `800 64px ${FONT}`
      ctx.fillText(initials(name), cx, cy + 22)
    }
    ctx.restore()
    ctx.strokeStyle = '#191409'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, 85, 0, Math.PI * 2)
    ctx.stroke()
  }
}

function fileName(r: GolfRound): string {
  const d = new Date(r.playedAt - 3 * 3600000).toISOString().slice(0, 10)
  return `golf-${d}.png`
}

export function GolfStoryModal({ open, onClose, round, players }: { open: boolean; onClose: () => void; round: GolfRound; players: FmoPlayers }) {
  const [roll, setRoll] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let made: string | null = null
    setBusy(true)
    const canvas = document.createElement('canvas')
    void drawStory(canvas, round, players, roll).then(
      () =>
        new Promise<void>((resolve) =>
          canvas.toBlob((b) => {
            if (!cancelled && b) {
              made = URL.createObjectURL(b)
              setBlob(b)
              setUrl(made)
            }
            setBusy(false)
            resolve()
          }, 'image/png'),
        ),
    )
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [open, round, players, roll])

  const file = blob ? new File([blob], fileName(round), { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'Golf' })
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Historia para Instagram">
      <div className="mx-auto rounded-xl overflow-hidden bg-[#0b1410] shadow-lg" style={{ width: 'min(100%, 270px)', aspectRatio: '9 / 16' }}>
        {url ? <img src={url} alt="Historia del partido para Instagram" className="w-full h-full object-contain" /> : <div className="w-full h-full grid place-items-center text-white/70 small">Armando la historia…</div>}
      </div>
      <div className="grid gap-2 mt-4">
        {canShare ? (
          <Button variant="gold" onClick={() => void share()} disabled={!file}>
            <Share2 size={16} /> Compartir (Instagram, WhatsApp…)
          </Button>
        ) : null}
        {url ? (
          <a className={`btn ${canShare ? 'btn-line' : 'btn-gold'} justify-center`} href={url} download={fileName(round)}>
            <Download size={16} /> Descargar imagen
          </a>
        ) : null}
        <Button variant="line" onClick={() => setRoll((x) => x + 1)} loading={busy}>
          <Dices size={16} /> Otra foto y frase
        </Button>
      </div>
      <p className="tiny muted mt-2 text-center">Formato de historia (1080 × 1920). La foto y la frase salen al azar.</p>
    </Modal>
  )
}
