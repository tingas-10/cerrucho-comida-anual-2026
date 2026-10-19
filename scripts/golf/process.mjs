// Convierte los datos crudos de OpenStreetMap de cada club en un mapa liviano para la web
// (capas en metros, hoyos con su línea) y arma consejos de caddy calculados desde el dibujo.
// Uso: node process.mjs <carpeta de salida>
import fs from 'node:fs'

const OUT = process.argv[2]
fs.mkdirSync(OUT, { recursive: true })

const CLUBS = {
  jockey: { file: 'raw-jockey.json', courseName: 'Jockey Club Argentino' },
  olivos: { file: 'rawbox-olivos.json', courseName: 'Olivos Golf Club' },
  mayling: { file: 'rawbox-mayling.json', courseName: 'Mayling' },
  mapuche: { file: 'rawbox-mapuche.json', courseName: 'Mapuche Country Club' },
  estancias: { file: 'rawbox-estancias.json', courseName: 'Estancias Golf Club' },
  pilara: { file: 'rawbox-pilara.json', courseName: 'Pilará' },
  medal: { file: 'rawbox-medal.json', courseName: 'Medal Contry' },
  lacolina: { file: 'rawbox-lacolina.json', courseName: 'La Colina' },
  orquidea: { file: 'rawbox-orquidea.json', courseName: 'Club de Golf La Orquídea' },
  armenia: { file: 'rawbox-armenia.json', courseName: 'Club de campo Armenia' },
}

function rings(e) {
  // Devuelve una lista de anillos [{lat, lon}[]] (ways cerrados, o miembros de multipolígonos).
  if (e.type === 'way' && e.geometry) return [e.geometry]
  if (e.type === 'relation' && e.members) {
    // Une los tramos de los miembros "outer" en anillos.
    const parts = e.members.filter((m) => m.geometry && (m.role === 'outer' || m.role === '')).map((m) => m.geometry.slice())
    const out = []
    while (parts.length) {
      let ring = parts.shift()
      let grew = true
      while (grew && !(ring[0].lat === ring[ring.length - 1].lat && ring[0].lon === ring[ring.length - 1].lon)) {
        grew = false
        for (let i = 0; i < parts.length; i++) {
          const p = parts[i]
          const end = ring[ring.length - 1]
          if (p[0].lat === end.lat && p[0].lon === end.lon) ring = ring.concat(p.slice(1))
          else if (p[p.length - 1].lat === end.lat && p[p.length - 1].lon === end.lon) ring = ring.concat(p.slice(0, -1).reverse())
          else continue
          parts.splice(i, 1)
          grew = true
          break
        }
      }
      out.push(ring)
    }
    return out
  }
  return []
}

function simplify(pts, tol) {
  if (pts.length < 3) return pts
  let maxD = 0
  let idx = 0
  const [a, b] = [pts[0], pts[pts.length - 1]]
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy) || 1
  const same = dx === 0 && dy === 0
  for (let i = 1; i < pts.length - 1; i++) {
    // Anillo cerrado (primer punto = último): se mide la distancia al punto, no a una recta.
    const d = same ? Math.hypot(pts[i][0] - a[0], pts[i][1] - a[1]) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= tol) return [a, b]
  return simplify(pts.slice(0, idx + 1), tol).slice(0, -1).concat(simplify(pts.slice(idx), tol))
}

const kindOf = (t) => {
  if (!t) return null
  if (t.golf === 'hole') return 'hole'
  if (t.golf === 'fairway') return 'fairway'
  if (t.golf === 'green') return 'green'
  if (t.golf === 'tee') return 'tee'
  if (t.golf === 'bunker') return 'bunker'
  if (t.golf === 'rough') return 'rough'
  if (t.golf === 'water_hazard' || t.golf === 'lateral_water_hazard' || t.natural === 'water' || t.water) return 'water'
  if (t.natural === 'wood' || t.landuse === 'forest' || t.natural === 'scrub') return 'wood'
  if (t.natural === 'tree_row') return 'treerow'
  if (t.natural === 'tree') return 'tree'
  if (t.golf === 'cartpath' || t.golf === 'path') return 'path'
  if (t.leisure === 'golf_course') return 'outline'
  return null
}

// Tarjetas investigadas (scorecards.json): par y dificultad cuando el mapa no los tiene.
const SC = fs.existsSync('scorecards.json') ? JSON.parse(fs.readFileSync('scorecards.json', 'utf8')) : {}
function scorecardHole(club, course, n) {
  if (club === 'jockey') return SC[course === 'C' ? 'jockey_colorada' : 'jockey_azul']?.holes?.find((x) => x.n === n) ?? null
  if (club === 'olivos') return SC.olivos?.nines?.find((x) => (x.name ?? '').toLowerCase() === String(course).toLowerCase())?.holes?.find((x) => x.n === n) ?? null
  return null
}

function main() {
for (const [club, cfg] of Object.entries(CLUBS)) {
  if (!fs.existsSync(cfg.file)) {
    console.log(club, 'sin datos crudos')
    continue
  }
  const raw = JSON.parse(fs.readFileSync(cfg.file))
  const els = raw.elements
  // Contorno: el golf_course con el nombre esperado (o el más grande).
  const outlines = els.filter((e) => kindOf(e.tags) === 'outline')
  const outlineEl = outlines.find((e) => cfg.courseName && e.tags.name === cfg.courseName) ?? outlines.sort((a, b) => rings(b).flat().length - rings(a).flat().length)[0]
  let outlineRings = outlineEl ? rings(outlineEl) : []
  if (!outlineRings.length && outlineEl?.bounds) {
    const b = outlineEl.bounds
    outlineRings = [[{ lat: b.maxlat, lon: b.minlon }, { lat: b.maxlat, lon: b.maxlon }, { lat: b.minlat, lon: b.maxlon }, { lat: b.minlat, lon: b.minlon }]]
  }
  const allPts = outlineRings.flat()
  if (!allPts.length) {
    console.log(club, 'sin contorno')
    continue
  }
  const lat0 = Math.max(...allPts.map((p) => p.lat))
  const lon0 = Math.min(...allPts.map((p) => p.lon))
  const k = Math.cos((lat0 * Math.PI) / 180) * 111320
  const proj = (p) => [Math.round((p.lon - lon0) * k * 10) / 10, Math.round((lat0 - p.lat) * 110540 * 10) / 10]
  const ob = allPts.map(proj)
  const W = Math.max(...ob.map((p) => p[0]))
  const H = Math.max(...ob.map((p) => p[1]))
  const margin = 40
  const inside = (pt) => pt[0] > -margin && pt[1] > -margin && pt[0] < W + margin && pt[1] < H + margin

  const layers = { outline: [], rough: [], fairway: [], green: [], tee: [], bunker: [], water: [], wood: [], treerow: [], path: [] }
  const polys = { bunker: [], water: [], wood: [], green: [] }
  const trees = []
  const holes = []
  const d = (pts, close) => 'M' + pts.map((p) => `${Math.round(p[0])} ${Math.round(p[1])}`).join('L') + (close ? 'Z' : '')

  for (const e of [...els, ...(outlineEl ? [] : [])]) {
    const kind = e === outlineEl ? 'outline' : kindOf(e.tags)
    if (!kind) continue
    if (kind === 'outline' && e !== outlineEl) continue
    if (kind === 'tree') {
      const p = proj(e)
      if (inside(p)) trees.push(p.map(Math.round))
      continue
    }
    if (kind === 'hole') {
      const line = (e.geometry ?? []).map(proj)
      if (!line.length || !inside(line[0])) continue
      let len = 0
      for (let i = 1; i < line.length; i++) len += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
      const t = e.tags
      holes.push({
        course: t['golf:course:name'] ?? (/[A-Z]$/.test(t.ref ?? '') ? t.ref.slice(-1) : null),
        ref: (t.ref ?? '').replace(/[A-Z]$/, ''),
        par: t.par ? Number(t.par) : null,
        si: t.handicap ? Number(t.handicap) : t['handicap:men'] ? Number(t['handicap:men']) : null,
        line: line.map((p) => p.map(Math.round)),
        len: Math.round(len),
      })
      continue
    }
    for (const ring of rings(e)) {
      const pts = simplify(ring.map(proj), 0.8)
      if (!pts.some(inside)) continue
      const closed = kind !== 'treerow' && kind !== 'path'
      layers[kind].push(d(pts, closed))
      if (polys[kind]) polys[kind].push(pts)
    }
  }
  holes.sort((a, b) => String(a.course).localeCompare(String(b.course)) || Number(a.ref) - Number(b.ref))
  for (const h of holes) {
    const sc = scorecardHole(club, h.course, Number(h.ref))
    // La tarjeta investigada manda sobre el par del mapa (ej. Olivos Azul 7: el mapa dice 5, la tarjeta oficial 4).
    if (sc?.par) h.par = sc.par
    if (sc?.si && h.si == null) h.si = sc.si
  }
  for (const h of holes) h.tip = caddyTip(h, polys)
  const out = { club, attribution: '© colaboradores de OpenStreetMap (ODbL)', w: Math.round(W), h: Math.round(H), layers, trees, holes }
  fs.writeFileSync(`${OUT}/${club}.json`, JSON.stringify(out))
  const kb = Math.round(JSON.stringify(out).length / 1024)
  console.log(club, `${Math.round(W)}x${Math.round(H)} m`, `${kb} KB`, Object.entries(layers).map(([k2, v]) => `${k2}:${v.length}`).join(' '), `árboles:${trees.length}`, `hoyos:${holes.length}`)
}
}

// ---------- Consejos de caddy desde la geometría ----------
function centroid(pts) {
  let x = 0
  let y = 0
  for (const p of pts) {
    x += p[0]
    y += p[1]
  }
  return [x / pts.length, y / pts.length]
}
/** Posición de un punto respecto de la línea del hoyo: distancia recorrida desde el tee y desvío (+ derecha, - izquierda). */
function along(line, pt) {
  let best = { s: 0, off: Infinity, seg: 0 }
  let acc = 0
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const L = Math.hypot(dx, dy) || 1
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / (L * L)))
    const px = a[0] + t * dx
    const py = a[1] + t * dy
    const dist = Math.hypot(pt[0] - px, pt[1] - py)
    // y crece hacia abajo (sur): con ese eje, cruz > 0 es a la derecha de la dirección de juego.
    const cross = dx * (pt[1] - a[1]) - dy * (pt[0] - a[0])
    if (dist < Math.abs(best.off)) best = { s: acc + t * L, off: cross > 0 ? dist : -dist, seg: i }
    acc += L
  }
  return { ...best, total: acc }
}
const lado = (off) => (off > 0 ? 'derecha' : 'izquierda')
const yardas = (m) => Math.round(m * 1.0936)

function caddyTip(h, polys) {
  const line = h.line
  if (line.length < 2) return null
  const total = h.len
  const parTxt = h.par ? `Par ${h.par}` : 'Hoyo'
  const parts = [`${parTxt} de ${yardas(total)} yardas.`]
  // Quiebre (dogleg): no en los par 3
  const isPar3 = h.par === 3 || (h.par == null && total < 230)
  if (line.length >= 3 && !isPar3) {
    const [a, b, c] = [line[0], line[1], line[2]]
    const a1 = Math.atan2(b[1] - a[1], b[0] - a[0])
    const a2 = Math.atan2(c[1] - b[1], c[0] - b[0])
    let turn = ((a2 - a1) * 180) / Math.PI
    while (turn > 180) turn -= 360
    while (turn < -180) turn += 360
    if (Math.abs(turn) > 18) {
      const dist = Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]))
      parts.push(`Dogleg a la ${turn > 0 ? 'derecha' : 'izquierda'} a unas ${yardas(dist)} yardas del tee: ${h.par === 5 ? 'no hace falta arriesgar el primer golpe' : `dejá la salida del lado de ${turn > 0 ? 'la izquierda' : 'la derecha'} del fairway para abrir el ángulo`}.`)
    }
  }
  const near = (list, maxOff) =>
    list
      .map((pts) => ({ pts, ...along(line, centroid(pts)) }))
      .filter((x) => Math.abs(x.off) <= maxOff)
  // Bunkers de fairway y de green
  const bunkers = near(polys.bunker, 40)
  const greenSide = bunkers.filter((b) => total - b.s < 35)
  const approachB = bunkers.filter((b) => total - b.s >= 35 && total - b.s < 90 && !isPar3)
  const fairwayB = bunkers.filter((b) => total - b.s >= 90 && b.s > 120 && !isPar3)
  if (fairwayB.length) {
    const f = fairwayB.sort((x, y) => x.s - y.s)[0]
    parts.push(`Bunker de fairway a la ${lado(f.off)} a unas ${yardas(f.s)} yardas de la salida${fairwayB.length > 1 ? ` (hay ${fairwayB.length} en el recorrido)` : ''}.`)
  }
  if (approachB.length) {
    const a = approachB.sort((x, y) => y.s - x.s)[0]
    parts.push(`Bunker a la ${lado(a.off)} en la zona del approach, a unas ${yardas(total - a.s)} yardas del green.`)
  }
  if (greenSide.length) {
    const sides = new Set(greenSide.map((b) => (total - b.s > 12 ? 'adelante' : Math.abs(b.off) < 8 ? 'atrás' : lado(b.off))))
    parts.push(`Green defendido por ${greenSide.length === 1 ? 'un bunker' : `${greenSide.length} bunkers`} (${[...sides].join(', ')}).`)
  }
  // Agua
  const water = near(polys.water, 45)
  if (water.length) {
    const w = water.sort((x, y) => Math.abs(x.off) - Math.abs(y.off))[0]
    const where = total - w.s < 50 ? 'cerca del green' : w.s < 120 ? 'en la salida' : 'en el recorrido'
    parts.push(Math.abs(w.off) < 12 ? `Hay agua que cruza ${where}: calculá bien el carry.` : `Agua a la ${lado(w.off)} ${where}: si dudás, jugá hacia el otro lado.`)
  }
  // Árboles
  const woods = near(polys.wood, 45)
  if (woods.length && parts.length < 5) {
    const sides = new Set(woods.map((x) => lado(x.off)))
    parts.push(`Árboles ${sides.size === 2 ? 'a ambos lados' : `a la ${[...sides][0]}`}: priorizá quedar en el fairway.`)
  }
  if (parts.length === 1) parts.push(h.par === 3 ? 'Elegí el palo por la distancia al centro del green.' : 'Hoyo bastante abierto: buena oportunidad para atacar.')
  return parts.join(' ')
}

main()
