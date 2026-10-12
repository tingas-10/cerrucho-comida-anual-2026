// Mapa ilustrativo de una cancha (datos de OpenStreetMap, en metros): la cancha entera o un hoyo,
// girado para que el tee quede abajo y el green arriba. Fairway, green, bunkers, agua y árboles.
import { useEffect, useState } from 'react'

export interface ClubMapHole {
  course: string | null
  ref: string
  par: number | null
  si: number | null
  line: Array<[number, number]>
  len: number
  tip: string | null
}

export interface ClubMap {
  club: string
  attribution: string
  w: number
  h: number
  layers: Record<'outline' | 'rough' | 'fairway' | 'green' | 'tee' | 'bunker' | 'water' | 'wood' | 'treerow' | 'path', string[]>
  trees: Array<[number, number]>
  holes: ClubMapHole[]
}

const cache = new Map<string, Promise<ClubMap | null>>()

export function useClubMap(club: string | null | undefined) {
  const [map, setMap] = useState<ClubMap | null>(null)
  const [loading, setLoading] = useState(!!club)
  useEffect(() => {
    if (!club) {
      setMap(null)
      setLoading(false)
      return
    }
    let alive = true
    setLoading(true)
    if (!cache.has(club)) {
      cache.set(
        club,
        fetch(`${import.meta.env.BASE_URL}golf/mapas/${club}.json`)
          .then((r) => (r.ok ? (r.json() as Promise<ClubMap>) : null))
          .catch(() => null),
      )
    }
    void cache.get(club)!.then((m) => {
      if (!alive) return
      setMap(m)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [club])
  return { map, loading }
}

/** Hoyos del mapa que corresponden a un recorrido (ej. 'C' de Colorada o 'Azul'). */
export function mapHolesFor(map: ClubMap, mapCourse: string | null | undefined, refs?: Array<string | null | undefined>): Array<ClubMapHole | null> {
  if (refs) return refs.map((ref) => (ref ? (map.holes.find((h) => `${h.course ?? ''}|${h.ref}` === ref) ?? null) : null))
  return map.holes.filter((h) => !mapCourse || h.course === mapCourse)
}

const COLORS = {
  ground: '#6f9f52',
  rough: '#79a85b',
  fairway: '#97cf6d',
  green: '#b6ee86',
  tee: '#a6dd7f',
  bunker: '#efe0b0',
  water: '#5fa8e0',
  wood: '#2f6b33',
  path: '#d8d0bd',
}

function Layers({ map, faded }: { map: ClubMap; faded?: boolean }) {
  const L = map.layers
  return (
    <g opacity={faded ? 0.55 : 1}>
      {L.outline.map((d, i) => (
        <path key={'o' + i} d={d} fill={COLORS.ground} />
      ))}
      {L.rough.map((d, i) => (
        <path key={'r' + i} d={d} fill={COLORS.rough} />
      ))}
      {L.wood.map((d, i) => (
        <path key={'w' + i} d={d} fill={COLORS.wood} opacity={0.75} />
      ))}
      {L.fairway.map((d, i) => (
        <path key={'f' + i} d={d} fill={COLORS.fairway} />
      ))}
      {L.tee.map((d, i) => (
        <path key={'t' + i} d={d} fill={COLORS.tee} stroke="#5d8f45" strokeWidth={0.6} />
      ))}
      {L.green.map((d, i) => (
        <path key={'g' + i} d={d} fill={COLORS.green} stroke="#4f8a3a" strokeWidth={0.8} />
      ))}
      {L.water.map((d, i) => (
        <path key={'a' + i} d={d} fill={COLORS.water} stroke="#3f86c2" strokeWidth={0.6} />
      ))}
      {L.bunker.map((d, i) => (
        <path key={'b' + i} d={d} fill={COLORS.bunker} stroke="#d4c18c" strokeWidth={0.6} />
      ))}
      {L.path.map((d, i) => (
        <path key={'p' + i} d={d} fill="none" stroke={COLORS.path} strokeWidth={2} />
      ))}
      {L.treerow.map((d, i) => (
        <path key={'tr' + i} d={d} fill="none" stroke={COLORS.wood} strokeWidth={6} strokeLinecap="round" opacity={0.8} />
      ))}
      {map.trees.map(([x, y], i) => (
        <circle key={'tc' + i} cx={x} cy={y} r={4} fill={COLORS.wood} opacity={0.85} />
      ))}
    </g>
  )
}

function holePath(h: ClubMapHole) {
  return 'M' + h.line.map((p) => `${p[0]} ${p[1]}`).join('L')
}

/** La cancha entera con el número de cada hoyo; se toca un número para elegirlo. */
export function CourseOverview({ map, holes, selected, onSelect, labelOf }: { map: ClubMap; holes: Array<ClubMapHole | null>; selected?: number | null; onSelect?: (i: number) => void; labelOf?: (i: number) => string }) {
  const pad = 30
  return (
    <figure className="m-0">
      <svg viewBox={`${-pad} ${-pad} ${map.w + pad * 2} ${map.h + pad * 2}`} className="w-full h-auto rounded-xl" style={{ background: '#5f8f45', maxHeight: '70dvh' }} role="img" aria-label="Mapa de la cancha">
        <Layers map={map} />
        {holes.map((h, i) =>
          h ? (
            <g key={i} onClick={() => onSelect?.(i)} style={{ cursor: onSelect ? 'pointer' : undefined }}>
              <path d={holePath(h)} fill="none" stroke={selected === i ? '#d9b45f' : 'rgba(255,255,255,.85)'} strokeWidth={selected === i ? 5 : 2.5} strokeDasharray={selected === i ? undefined : '6 5'} />
              <circle cx={h.line[0][0]} cy={h.line[0][1]} r={13} fill={selected === i ? '#d9b45f' : '#0e1119'} stroke="#fff" strokeWidth={2} />
              <text x={h.line[0][0]} y={h.line[0][1] + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill={selected === i ? '#191409' : '#fff'}>
                {labelOf ? labelOf(i) : i + 1}
              </text>
            </g>
          ) : null,
        )}
      </svg>
      <figcaption className="tiny muted mt-1">Mapa ilustrativo · {map.attribution}</figcaption>
    </figure>
  )
}

/** Un hoyo, girado para que el tee quede abajo y el green arriba, con la distancia del recorrido. */
export function HoleView({ map, hole }: { map: ClubMap; hole: ClubMapHole }) {
  const pts = hole.line
  const [tx, ty] = pts[0]
  const [gx, gy] = pts[pts.length - 1]
  const theta = (Math.atan2(gy - ty, gx - tx) * 180) / Math.PI
  const rot = -90 - theta
  const cx = (tx + gx) / 2
  const cy = (ty + gy) / 2
  const r = (rot * Math.PI) / 180
  const rp = ([x, y]: [number, number]) => [cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r), cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r)]
  const rotated = pts.map(rp)
  const xs = rotated.map((p) => p[0])
  const ys = rotated.map((p) => p[1])
  const pad = 55
  const minX = Math.min(...xs) - pad
  const maxX = Math.max(...xs) + pad
  const minY = Math.min(...ys) - pad
  const maxY = Math.max(...ys) + pad
  // Que el dibujo no quede ni muy finito ni muy ancho.
  const width = Math.max(maxX - minX, (maxY - minY) * 0.55)
  const midX = (minX + maxX) / 2
  const vb = `${midX - width / 2} ${minY} ${width} ${maxY - minY}`
  const [ex, ey] = rotated[rotated.length - 1]
  return (
    <figure className="m-0">
      <svg viewBox={vb} className="w-full h-auto rounded-xl mx-auto block" style={{ background: '#5f8f45', maxHeight: '62dvh', maxWidth: 420 }} role="img" aria-label={`Mapa del hoyo ${hole.ref}`}>
        <g transform={`rotate(${rot} ${cx} ${cy})`}>
          <Layers map={map} />
          <path d={holePath(hole)} fill="none" stroke="#fff" strokeWidth={2.5} strokeDasharray="7 6" />
          <circle cx={tx} cy={ty} r={6} fill="#0e1119" stroke="#fff" strokeWidth={2} />
        </g>
        {/* Bandera (sin rotar, para que quede derecha) */}
        <g transform={`translate(${ex} ${ey})`}>
          <line x1={0} y1={0} x2={0} y2={-26} stroke="#fff" strokeWidth={2} />
          <path d="M0 -26 L16 -21 L0 -16 Z" fill="#e0483e" />
          <circle cx={0} cy={0} r={3} fill="#0e1119" />
        </g>
      </svg>
      <figcaption className="tiny muted mt-1 text-center">Tee abajo, green arriba · {Math.round(hole.len)} m · {map.attribution}</figcaption>
    </figure>
  )
}
