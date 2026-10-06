// FMO · Historia para Instagram (1080 x 1920): resultado, goles y Azzaro "bailando" a uno del equipo ganador.
// Se dibuja en el navegador con canvas; cualquiera (también visitantes) la puede bajar o compartir.
import { Dices, Download, Share2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { FMO_HISTORIA } from '../../content/fmo'
import { GRUPO } from '../../content/config'
import type { FmoMatch } from '../../data/types'
import { fmtDayLong, initials } from '../../domain/format'
import { storyData } from '../../domain/fmoStory'
import { Button, Modal } from '../../ui/components'
import type { FmoPlayers } from './fmoShared'

const W = 1080
const H = 1920
const BASE = import.meta.env.BASE_URL
const GOLD = '#d9b45f'
const FONT = "'Plus Jakarta Sans', system-ui, sans-serif"

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Dibuja la imagen cubriendo el rectángulo (como object-fit: cover), con el foco vertical indicado. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, focusY = 0.5) {
  const scale = Math.max(w / img.width, h / img.height)
  const sw = w / scale
  const sh = h / scale
  const sx = (img.width - sw) / 2
  const sy = Math.max(0, Math.min(img.height - sh, img.height * focusY - sh / 2))
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

/** Achica la fuente hasta que el texto entre en el ancho. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, size: number, weight = 800, min = 28): number {
  let s = size
  ctx.font = `${weight} ${s}px ${FONT}`
  while (ctx.measureText(text).width > maxW && s > min) {
    s -= 2
    ctx.font = `${weight} ${s}px ${FONT}`
  }
  return s
}

async function drawStory(canvas: HTMLCanvasElement, m: FmoMatch, players: FmoPlayers, roll: number) {
  await Promise.all([document.fonts.load(`800 80px ${FONT}`), document.fonts.load(`500 30px ${FONT}`)]).catch(() => undefined)
  const d = storyData(m, roll, FMO_HISTORIA.imagenes.length)
  const pic = FMO_HISTORIA.imagenes[d.imageIndex]
  const [azzaro, logo] = await Promise.all([loadImage(BASE + pic.src), loadImage(BASE + 'logo-512.png')])
  const chosen = d.chosenId ? players.byId[d.chosenId] : null
  const chosenPhoto = chosen?.photo ? await loadImage(chosen.photo) : null
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'

  // Fondo: noche y pasto
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0c0e14')
  bg.addColorStop(0.55, '#0f2318')
  bg.addColorStop(1, '#14361f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,.05)'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(W / 2, 1190, 300, 0, Math.PI * 2)
  ctx.stroke()

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
  ctx.fillText('FMO', 230, 140)
  ctx.fillStyle = '#c9ccd6'
  ctx.font = `500 30px ${FONT}`
  ctx.fillText(`${GRUPO.nombre} · ${fmtDayLong(m.playedAt)}`, 230, 188)

  // Marcador
  ctx.fillStyle = 'rgba(255,255,255,.07)'
  roundRect(ctx, 60, 260, W - 120, 300, 40)
  ctx.fill()
  const nameColor = (t: 'A' | 'B') => (d.winner === t ? GOLD : d.winner ? '#9ca1ae' : '#ffffff')
  ctx.textAlign = 'center'
  for (const [t, x] of [['A', 270], ['B', 810]] as const) {
    const name = t === 'A' ? m.nameA : m.nameB
    fitText(ctx, name, 360, 46)
    ctx.fillStyle = nameColor(t)
    ctx.fillText(name, x, 340)
    if (d.winner === t) {
      ctx.font = `800 24px ${FONT}`
      ctx.fillText('GANADOR', x, 382)
    }
  }
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 170px ${FONT}`
  ctx.fillText(`${d.score.a} – ${d.score.b}`, W / 2, 520)
  if (!d.winner) {
    ctx.fillStyle = GOLD
    ctx.font = `800 26px ${FONT}`
    ctx.fillText('EMPATE', W / 2, 382)
  }

  // Goles
  ctx.fillStyle = GOLD
  ctx.font = `800 26px ${FONT}`
  ctx.fillText('G O L E S', W / 2, 620)
  ctx.fillStyle = '#ffffff'
  for (const [list, side] of [[d.scorersA, 'left'], [d.scorersB, 'right']] as const) {
    const shown = list.length > 4 ? list.slice(0, 3) : list
    const rows: Array<{ name: string; goals: number }> = shown.map((s) => ({ name: players.nameOf(s.id), goals: s.goals }))
    if (list.length > 4) rows.push({ name: `+${list.length - 3} más`, goals: 0 })
    if (!rows.length) rows.push({ name: '—', goals: 0 })
    rows.forEach((r, i) => {
      const y = 680 + i * 52
      const balls = Math.min(r.goals, 4)
      const extra = r.goals > 4 ? ` ×${r.goals}` : ''
      fitText(ctx, r.name + extra, 300, 36, 500, 24)
      const textW = ctx.measureText(r.name + extra).width
      const ballsW = balls * 34
      const total = textW + (balls ? 14 + ballsW : 0)
      const x0 = side === 'left' ? 110 : W - 110 - total
      ctx.textAlign = 'left'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(r.name + extra, x0, y)
      for (let b = 0; b < balls; b++) drawBall(ctx, x0 + textW + 14 + 15 + b * 34, y - 12, 14)
    })
  }

  // Azzaro
  const ix = 170
  const iy = 900
  const iw = 740
  const ih = 660
  ctx.save()
  roundRect(ctx, ix, iy, iw, ih, 44)
  ctx.clip()
  if (azzaro) drawCover(ctx, azzaro, ix, iy, iw, ih, pic.foco)
  else {
    ctx.fillStyle = '#222'
    ctx.fillRect(ix, iy, iw, ih)
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(255,255,255,.25)'
  ctx.lineWidth = 4
  roundRect(ctx, ix, iy, iw, ih, 44)
  ctx.stroke()

  // Globo de diálogo
  const name = chosen?.name ?? 'Nadie'
  const bx = 70
  const by = 1500
  const bw = W - 140
  const bh = 250
  ctx.fillStyle = GOLD
  ctx.beginPath()
  ctx.moveTo(W / 2 - 40, by + 2)
  ctx.lineTo(W / 2 + 10, by - 60)
  ctx.lineTo(W / 2 + 50, by + 2)
  ctx.fill()
  roundRect(ctx, bx, by, bw, bh, 36)
  ctx.fill()
  const hasAvatar = !!chosen
  const textW = hasAvatar ? bw - 240 : bw - 80
  const textX = hasAvatar ? bx + 50 : W / 2
  ctx.textAlign = hasAvatar ? 'left' : 'center'
  ctx.fillStyle = '#191409'
  fitText(ctx, `“${FMO_HISTORIA.frase}`, textW, 52)
  ctx.fillText(`“${FMO_HISTORIA.frase}`, textX, by + 95)
  fitText(ctx, `${name}!!!”`, textW, 92)
  ctx.fillText(`${name}!!!”`, textX, by + 200)
  if (chosen) {
    const cx = bx + bw - 110
    const cy = by + bh / 2
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 82, 0, Math.PI * 2)
    ctx.fillStyle = chosen.color
    ctx.fill()
    ctx.clip()
    if (chosenPhoto) drawCover(ctx, chosenPhoto, cx - 82, cy - 82, 164, 164)
    else {
      ctx.fillStyle = '#191409'
      ctx.textAlign = 'center'
      ctx.font = `800 64px ${FONT}`
      ctx.fillText(initials(chosen.name), cx, cy + 22)
    }
    ctx.restore()
    ctx.strokeStyle = '#191409'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(cx, cy, 82, 0, Math.PI * 2)
    ctx.stroke()
  }

}

/** Pelotita dibujada (el emoji ⚽ cambia según el celular). */
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.clip()
  ctx.fillStyle = '#191409'
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    const px = x + Math.cos(a) * r * 0.42
    const py = y + Math.sin(a) * r * 0.42
    if (i === 0) ctx.moveTo(px, py)
    else ctx.lineTo(px, py)
  }
  ctx.closePath()
  ctx.fill()
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5
    ctx.beginPath()
    ctx.arc(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, r * 0.38, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function fileName(m: FmoMatch): string {
  const d = new Date(m.playedAt - 3 * 3600000).toISOString().slice(0, 10)
  return `fmo-${d}.png`
}

export function FmoStoryModal({ open, onClose, match, players }: { open: boolean; onClose: () => void; match: FmoMatch; players: FmoPlayers }) {
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
    void drawStory(canvas, match, players, roll).then(
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
  }, [open, match, players, roll])

  const file = blob ? new File([blob], fileName(match), { type: 'image/png' }) : null
  const canShare = !!file && typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file] })

  async function share() {
    if (!file) return
    try {
      await navigator.share({ files: [file], title: 'FMO' })
    } catch {
      /* el usuario cerró el menú de compartir */
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Historia para Instagram">
      <div className="mx-auto rounded-xl overflow-hidden bg-[#0c0e14] shadow-lg" style={{ width: 'min(100%, 270px)', aspectRatio: '9 / 16' }}>
        {url ? <img src={url} alt="Historia del partido para Instagram" className="w-full h-full object-contain" /> : <div className="w-full h-full grid place-items-center text-white/70 small">Armando la historia…</div>}
      </div>
      <div className="grid gap-2 mt-4">
        {canShare ? (
          <Button variant="gold" onClick={() => void share()} disabled={!file}>
            <Share2 size={16} /> Compartir (Instagram, WhatsApp…)
          </Button>
        ) : null}
        {url ? (
          <a className={`btn ${canShare ? 'btn-line' : 'btn-gold'} justify-center`} href={url} download={fileName(match)}>
            <Download size={16} /> Descargar imagen
          </a>
        ) : null}
        <Button variant="line" onClick={() => setRoll((r) => r + 1)} loading={busy}>
          <Dices size={16} /> Otro jugador
        </Button>
      </div>
      <p className="tiny muted mt-2 text-center">Formato de historia (1080 × 1920). El bailado sale al azar del equipo que ganó.</p>
    </Modal>
  )
}
