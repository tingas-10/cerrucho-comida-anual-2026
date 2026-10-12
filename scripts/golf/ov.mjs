// Ayuda para consultar Overpass (OpenStreetMap) con reintentos.
export async function overpass(q) {
  for (const url of ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'cerrucho-golf-map/1.0' } })
      const t = await r.text()
      if (t.startsWith('{')) return JSON.parse(t)
      console.error('overpass', url, r.status, t.slice(0, 200))
    } catch (e) {
      console.error('overpass', url, String(e))
    }
    await new Promise((res) => setTimeout(res, 3000))
  }
  throw new Error('Overpass no respondió')
}
