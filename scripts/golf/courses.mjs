// Arma las canchas para la web a partir de las tarjetas investigadas (scorecards.json) y los mapas procesados.
// Uso: node courses.mjs <repo>
import fs from 'node:fs'

const REPO = process.argv[2]
const SC = JSON.parse(fs.readFileSync('scorecards.json', 'utf8'))
const map = (club) => {
  const f = `${REPO}/public/golf/mapas/${club}.json`
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null
}
const MAPS = { jockey: map('jockey'), olivos: map('olivos') }

function genericTip(par, yards) {
  if (!yards) return null
  const base = `Par ${par} de ${yards} yardas.`
  if (par === 3) return `${base} ${yards > 185 ? 'Par 3 largo: el centro del green ya es buen resultado.' : 'Elegí el palo por la distancia al centro del green.'}`
  if (par === 4) return `${base} ${yards > 400 ? 'Par 4 largo: priorizá el fairway y aceptá el bogey.' : yards < 330 ? 'Par 4 corto: buena chance de birdie con un buen approach.' : 'Salida al fairway y approach al centro.'}`
  return `${base} ${yards < 480 ? 'Par 5 corto: los que pegan largo pueden llegar en dos.' : 'Pensalo en tres golpes y dejate un approach cómodo.'}`
}

function hole(par, si, yards, mapClub, mapCourse, ref, researchedTip) {
  const mh = mapClub ? MAPS[mapClub]?.holes.find((h) => h.course === mapCourse && h.ref === String(ref)) : null
  const extra = researchedTip ? researchedTip.trim().replace(/[^.!?]$/, (c) => c + '.') : null
  // El consejo del mapa arranca con el largo medido en el dibujo; si hay tarjeta, manda la distancia de la tarjeta.
  const mapTip = mh?.tip && yards ? mh.tip.replace(/^Par \d+ de \d+ yardas\./, `Par ${par} de ${yards} yardas.`) : mh?.tip
  const tips = [mapTip ?? genericTip(par, yards), extra].filter(Boolean)
  return { par, si, yards: yards ?? (mh ? Math.round(mh.len * 1.0936) : null), tip: tips.join(' ') || null, mapRef: mh ? `${mapCourse}|${ref}` : null }
}

const courses = []
const add = (c) => courses.push({ archived: false, updatedAt: 0, ...c })

// Jockey (OpenStreetMap: 'C' Colorada, 'A' Azul)
for (const [key, code, label] of [['jockey_colorada', 'C', 'Colorada'], ['jockey_azul', 'A', 'Azul']]) {
  const sc = SC[key]
  add({
    id: `jockey-${label.toLowerCase()}`,
    name: `Jockey Club Argentino · ${label}`,
    club: 'jockey',
    mapCourse: code,
    holes: sc.holes.map((h) => hole(h.par, h.si, h.yards, 'jockey', code, h.n, h.tip)),
    source: `Par, dificultad y yardas (tee ${sc.tee.split(',')[0]}): golfify, offcourse y golfingrecord; totales confirmados por el club. Mapa y consejos: OpenStreetMap.`,
  })
}

// Olivos: tres nueves; las vueltas de 18 combinan dos (índice impar el primer nueve, par el segundo).
const nine = (name) => SC.olivos.nines.find((x) => x.name === name)
const olivosSrc = 'Par, dificultad y yardas (tee Blancos): tarjeta oficial del club. Mapa y consejos: OpenStreetMap.'
for (const name of ['Blanca', 'Colorada', 'Azul']) {
  add({
    id: `olivos-${name.toLowerCase()}`,
    name: `Olivos Golf Club · ${name} (9)`,
    club: 'olivos',
    mapCourse: name,
    holes: nine(name).holes.map((h) => hole(h.par, h.si, h.yards, 'olivos', name, h.n, h.tip)),
    source: olivosSrc,
  })
}
for (const [a, b, extra] of [['Blanca', 'Colorada', ' (campeonato)'], ['Azul', 'Blanca', ''], ['Colorada', 'Azul', '']]) {
  add({
    id: `olivos-${a.toLowerCase()}-${b.toLowerCase()}`,
    name: `Olivos Golf Club · ${a} + ${b}${extra}`,
    club: 'olivos',
    mapCourse: null,
    holes: [
      ...nine(a).holes.map((h) => hole(h.par, h.si * 2 - 1, h.yards, 'olivos', a, h.n, h.tip)),
      ...nine(b).holes.map((h) => hole(h.par, h.si * 2, h.yards, 'olivos', b, h.n, h.tip)),
    ],
    source: `${olivosSrc} Dificultad de 18: impares en el primer nueve, pares en el segundo.`,
  })
}

// Sin hoyos dibujados en el mapa: tarjeta y consejos según distancia (más lo publicado, si hay).
const simple = [
  ['mayling', 'Mayling Club de Campo', 'mayling', 'Par, dificultad y yardas (tee Negro): golfify, golfingrecord y Hole19. Consejos orientativos según la distancia.'],
  ['mapuche', 'Mapuche Country Club (9 hoyos x 2)', 'mapuche', 'Par y dificultad: golfify y Hole19 (9 hoyos que se juegan dos veces). Yardas del tee Blanco: golfify. Consejos orientativos según la distancia.'],
  ['estancias', 'Estancias Golf Club', 'estancias', 'Par y yardas (tee Azul): golfify, offcourse, golfpass y Top100. La dificultad de cada hoyo NO está confirmada (las fuentes no coinciden): conviene que la comisión la revise con la tarjeta del club.'],
  ['pilara', 'Pilará Golf Club', 'pilara', 'Par y yardas (tee Blanco): golfpass, offcourse y Hole19. Dificultad: golfpass, offcourse y golfify (Hole19 da otra). Consejos orientativos según la distancia y Top100.'],
]
for (const [key, name, club, source] of simple) {
  const sc = SC[key]
  const si = sc.holes.map((h, i) => h.si ?? sc.siCandidates?.golfpass_offcourse_golfify?.[i] ?? sc.siCandidates?.golfify?.[i] ?? i + 1)
  add({ id: key, name, club, mapCourse: null, holes: sc.holes.map((h, i) => hole(h.par, si[i], h.yards, null, null, h.n, h.tip)), source })
}

// Controles
for (const c of courses) {
  const n = c.holes.length
  const si = c.holes.map((h) => h.si)
  const okSi = new Set(si).size === n && si.every((x) => x >= 1 && x <= n)
  const par = c.holes.reduce((a, h) => a + h.par, 0)
  console.log(c.id.padEnd(24), `${n} hoyos par ${par}`, okSi ? 'índices OK' : 'ÍNDICES MAL', `mapa:${c.holes.filter((h) => h.mapRef).length}`)
}
fs.writeFileSync(`${REPO}/src/content/golf-canchas.json`, JSON.stringify(courses, null, 1))
