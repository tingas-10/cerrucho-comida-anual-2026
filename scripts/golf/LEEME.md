# Mapas y tarjetas de las canchas de golf

1. `node fetch.mjs jockey` y `node fetchbox.mjs <club>`: bajan de OpenStreetMap (Overpass) los elementos de golf de cada club (`raw-*.json`, no se suben al repo).
2. `node process.mjs ../../public/golf/mapas`: arma el mapa liviano de cada club y los consejos de caddy calculados desde el dibujo (largo, dogleg, bunkers, agua, árboles).
3. `node courses.mjs ../..`: arma `src/content/golf-canchas.json` con par, dificultad, metros y consejos, a partir de `scorecards.json` (tarjetas investigadas el 12/10/2026, con fuentes y conflictos anotados).

Datos de mapas © colaboradores de OpenStreetMap (ODbL). Si alguien dibuja en OpenStreetMap los hoyos de Mayling, Mapuche, Estancias o Pilará, se repiten los pasos y aparecen sus mapas por hoyo.
