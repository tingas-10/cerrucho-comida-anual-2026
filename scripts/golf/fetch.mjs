// Baja de OpenStreetMap los elementos de golf de cada cancha (con geometría) y los guarda crudos.
import fs from 'node:fs'
import { overpass } from './ov.mjs'
const COURSES = {
  olivos: { area: 2400000000 + 176395380, osm: 'way/176395380' },
  mayling: { area: 3600000000 + 15551157, osm: 'relation/15551157' },
  mapuche: { area: 2400000000 + 259774834, osm: 'way/259774834' },
  jockey: { area: 3600000000 + 15569358, osm: 'relation/15569358' },
  estancias: { area: 3600000000 + 4793607, osm: 'relation/4793607' },
  pilara: { area: 3600000000 + 15592523, osm: 'relation/15592523' },
}
const only = process.argv[2]
for (const [id, c] of Object.entries(COURSES)) {
  if (only && only !== id) continue
  const q = `[out:json][timeout:180];
area(${c.area})->.a;
(
  nwr["golf"](area.a);
  nwr["natural"~"water|wood|tree_row|scrub"](area.a);
  node["natural"="tree"](area.a);
  nwr["landuse"~"forest|grass"](area.a);
  nwr["water"](area.a);
);
out geom;
${c.osm.replace('/', '(')});
out geom;`
  const j = await overpass(q)
  fs.writeFileSync(`raw-${id}.json`, JSON.stringify(j))
  const count = {}
  for (const e of j.elements) {
    const k = e.tags?.golf ? 'golf=' + e.tags.golf : e.tags?.natural ? 'natural=' + e.tags.natural : e.tags?.landuse ? 'landuse=' + e.tags.landuse : e.tags?.water ? 'water' : 'otro'
    count[k] = (count[k] ?? 0) + 1
  }
  const holes = j.elements.filter((e) => e.tags?.golf === 'hole')
  console.log(id, JSON.stringify(count))
  console.log('   hoyos:', holes.map((h) => `${h.tags.ref ?? '?'}${h.tags.name ? '(' + h.tags.name + ')' : ''}:p${h.tags.par ?? '?'}:hc${h.tags.handicap ?? '-'}`).join(' '))
  await new Promise((r) => setTimeout(r, 4000))
}
