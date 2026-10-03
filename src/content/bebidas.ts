// ============================================================
// CONTENIDO EDITABLE · Bebidas, recetas y envases iniciales
// Son parámetros de cálculo de compras (no instrucciones de preparación).
// Después de crear la edición se editan desde Administración > Bebidas y compras.
// ============================================================

export const BEBIDAS = ['fernet', 'cerveza', 'gin', 'vodka', 'vino', 'aperol'] as const
export type BebidaKey = (typeof BEBIDAS)[number]

export const BEBIDA_LABEL: Record<BebidaKey, string> = {
  fernet: 'Fernet',
  cerveza: 'Cerveza',
  gin: 'Gin',
  vodka: 'Vodka',
  vino: 'Vino',
  aperol: 'Aperol',
}

export interface Ingrediente {
  id: string
  label: string
  unidad: 'ml' | 'g'
  envaseMl: number // contenido de un envase (ml o g)
  envaseLabel: string // ej. "Botella 750 ml"
  packUnidades?: number // si se compra por pack (ej. 6 latas)
}

export const INGREDIENTES: Ingrediente[] = [
  { id: 'fernet', label: 'Fernet', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'cola', label: 'Gaseosa cola', unidad: 'ml', envaseMl: 2250, envaseLabel: 'Botella 2,25 L' },
  { id: 'cerveza', label: 'Cerveza', unidad: 'ml', envaseMl: 473, envaseLabel: 'Lata 473 ml', packUnidades: 6 },
  { id: 'gin', label: 'Gin', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'tonica', label: 'Agua tónica', unidad: 'ml', envaseMl: 1500, envaseLabel: 'Botella 1,5 L' },
  { id: 'vodka', label: 'Vodka', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'jugo', label: 'Jugo', unidad: 'ml', envaseMl: 1000, envaseLabel: 'Botella 1 L' },
  { id: 'vino', label: 'Vino', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'aperol', label: 'Aperol', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'espumante', label: 'Espumante', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'soda', label: 'Soda', unidad: 'ml', envaseMl: 1500, envaseLabel: 'Botella 1,5 L' },
  { id: 'agua', label: 'Agua', unidad: 'ml', envaseMl: 1500, envaseLabel: 'Botella 1,5 L' },
  { id: 'hielo', label: 'Hielo', unidad: 'g', envaseMl: 3000, envaseLabel: 'Bolsa 3 kg' },
]

// Ingredientes por porción (ml) de cada bebida.
export const RECETAS: Record<BebidaKey, Record<string, number>> = {
  fernet: { fernet: 45, cola: 135 },
  cerveza: { cerveza: 473 },
  gin: { gin: 45, tonica: 135 },
  vodka: { vodka: 45, jugo: 135 },
  vino: { vino: 150 },
  aperol: { aperol: 60, espumante: 90, soda: 30 },
}

export const RESERVA_COMPRA_PCT = 10
export const AGUA_ML_POR_ASISTENTE = 1000
export const HIELO_G_POR_ASISTENTE = 500
export const PORCIONES_MIN = 1
export const PORCIONES_MAX = 20
export const PORCIONES_SUGERIDAS_UI = 4
