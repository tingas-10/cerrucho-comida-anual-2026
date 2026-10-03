// ============================================================
// CONTENIDO EDITABLE · Categorías iniciales de premios
// Se cargan como borrador al crear una edición. Después se editan desde Administración > Premios
// mientras la categoría no esté abierta. No agregar categorías acá para una edición ya creada:
// hacerlo desde el panel.
// ============================================================

export type Eligibilidad = 'VAO' | 'EDITION'

// El VAO (Viaje Anual Obligatorio) todavía no forma parte de la web. Con `false` se ocultan sus
// tres premios y la columna "Fue al VAO". Para sumarlo más adelante, pasar a `true`.
export const VAO_ACTIVO = false

export interface CategoriaInicial {
  code: string
  label: string
  description: string
  eligibility: Eligibilidad
  order: number
  // Si es true, el título muestra el año siguiente de la edición (ej. "Promesa 2027").
  anioSiguiente?: boolean
}

export const CATEGORIAS_INICIALES: CategoriaInicial[] = [
  { code: 'revelacion_vao', label: 'Revelación VAO', description: 'La sorpresa del Viaje Anual Obligatorio', eligibility: 'VAO', order: 1 },
  { code: 'mvp_vao', label: 'MVP VAO', description: 'El más valioso del Viaje Anual Obligatorio', eligibility: 'VAO', order: 2 },
  { code: 'rey_noche_vao', label: 'Rey de la noche VAO', description: 'El protagonista de las noches del VAO', eligibility: 'VAO', order: 3 },
  { code: 'the_rat', label: 'The Rat', description: 'El que más cuidó el bolsillo este año', eligibility: 'EDITION', order: 4 },
  { code: 'pollera', label: 'Pollera', description: 'El que más se ganó este título durante el año', eligibility: 'EDITION', order: 5 },
  { code: 'cerrucho', label: 'Cerrucho', description: 'El que más hizo honor al nombre del grupo', eligibility: 'EDITION', order: 6 },
  { code: 'promesa', label: 'Promesa', description: 'El que promete sorprendernos el año que viene', eligibility: 'EDITION', order: 7, anioSiguiente: true },
  { code: 'amigo_oro', label: 'Amigo de Oro', description: 'El que siempre estuvo cuando hizo falta', eligibility: 'EDITION', order: 8 },
  { code: 'presidente', label: 'Presidente', description: 'El elegido para representar y movilizar a la banda', eligibility: 'EDITION', order: 9, anioSiguiente: true },
]

// Clave especial para "Nadie lo merece". No cambiar: la usan las reglas y el conteo.
export const NOBODY = 'NOBODY'
export const NOBODY_LABEL = 'Nadie lo merece'
// Diferencia mínima entre primero y segundo para ganar en primera ronda.
export const MARGEN_PRIMERA_RONDA = 3
