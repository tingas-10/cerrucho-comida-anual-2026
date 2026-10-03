// ============================================================
// CONTENIDO EDITABLE · Fotos de la galería
// Para agregar una foto: copiarla a public/galeria/<album>/ y sumar una línea acá.
// Las fotos viven en el repo (público). No subir nada que no quieras público.
// ============================================================

export type FotoKind = 'photo' | 'meme' | 'video'

export interface Foto {
  id: string
  src: string // relativo a public/
  album: string // 'recuerdos' | '2026' | ...
  kind: FotoKind
  caption?: string
  autor?: string
  ancho: number
  alto: number
  destacada?: boolean
  poster?: string // sólo para videos
}

export const ALBUMES: Array<{ id: string; titulo: string; descripcion?: string }> = [
  { id: 'recuerdos', titulo: 'Recuerdos', descripcion: 'Fotos de la banda de todos los tiempos.' },
  { id: '2026', titulo: 'Comida anual 2026', descripcion: 'Lo que pase esa noche.' },
]

export const FOTOS: Foto[] = [
  { id: 'r10', src: 'galeria/recuerdos/10_grupo_portada.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1280, alto: 853, destacada: true, caption: 'La banda' },
  { id: 'r04', src: 'galeria/recuerdos/04_grupo_noche.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1200, alto: 1600, destacada: true },
  { id: 'r08', src: 'galeria/recuerdos/08_encuentro_aire_libre.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1280, alto: 853 },
  { id: 'r09', src: 'galeria/recuerdos/09_abrazo.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1280, alto: 853 },
  { id: 'r02', src: 'galeria/recuerdos/02_encuentro.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1152, alto: 2048 },
  { id: 'r06', src: 'galeria/recuerdos/06_colectivo.jpeg', album: 'recuerdos', kind: 'photo', ancho: 1086, alto: 1448 },
  { id: 'r01', src: 'galeria/recuerdos/01_retrato.jpeg', album: 'recuerdos', kind: 'photo', ancho: 960, alto: 1280 },
  { id: 'r07', src: 'galeria/recuerdos/07_retrato_salsa.jpeg', album: 'recuerdos', kind: 'photo', ancho: 720, alto: 1280 },
  { id: 'r03', src: 'galeria/recuerdos/03_composicion.jpeg', album: 'recuerdos', kind: 'meme', ancho: 992, alto: 1057, caption: 'Composición humorística' },
  { id: 'r05', src: 'galeria/recuerdos/05_grupo_noche_variante.jpeg', album: 'recuerdos', kind: 'photo', ancho: 768, alto: 1024 },
]
