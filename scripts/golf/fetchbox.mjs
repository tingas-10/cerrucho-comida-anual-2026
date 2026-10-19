// Igual que fetch.mjs pero por recuadro alrededor del centro de cada cancha.
import fs from 'node:fs'
import { overpass } from './ov.mjs'
const C = { olivos: [-34.4712, -58.7], mayling: [-34.4335, -58.8729], mapuche: [-34.4462, -58.8512], estancias: [-34.4901, -59.0062], pilara: [-34.4674, -58.9535], medal: [-34.505, -58.9585], lacolina: [-34.513, -59.0325], orquidea: [-34.308, -59.0085], armenia: [-34.4225, -58.801] }
const only = process.argv[2]
for (const [id, [lat, lon]] of Object.entries(C)) {
  if (only && only !== id) continue
  const d = 0.014
  const bb = `${lat - d},${lon - d * 1.2},${lat + d},${lon + d * 1.2}`
  const q = `[out:json][timeout:180];
(
  nwr["golf"](${bb});
  nwr["natural"~"water|wood|tree_row|scrub"](${bb});
  node["natural"="tree"](${bb});
  nwr["landuse"="forest"](${bb});
  nwr["leisure"="golf_course"](${bb});
);
out geom;`
  const j = await overpass(q)
  fs.writeFileSync(`rawbox-${id}.json`, JSON.stringify(j))
  const count = {}
  for (const e of j.elements) {
    const k = e.tags?.golf ? 'golf=' + e.tags.golf : e.tags?.natural ? 'natural=' + e.tags.natural : e.tags?.landuse ? 'landuse=' + e.tags.landuse : e.tags?.leisure ?? 'otro'
    count[k] = (count[k] ?? 0) + 1
  }
  const holes = j.elements.filter((e) => e.tags?.golf === 'hole')
  console.log(id, JSON.stringify(count))
  console.log('   hoyos:', holes.map((h) => `${h.tags.ref ?? '?'}:p${h.tags.par ?? '?'}`).join(' '))
  await new Promise((r) => setTimeout(r, 5000))
}
