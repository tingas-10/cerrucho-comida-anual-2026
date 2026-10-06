// ============================================================
// CONTENIDO EDITABLE · Bebidas, nivel de consumo, recetas y envases iniciales
// Son parámetros de cálculo de compras (no instrucciones de preparación).
// Después de crear la edición, recetas y envases se editan desde Administración > Bebidas y compras.
// ============================================================

// Lo que cada uno elige. Gin y vermouth no se eligen: se compran aparte para los finos (EXTRAS_FINOS).
export const BEBIDAS = ['fernet', 'cerveza', 'vino'] as const
export type BebidaKey = (typeof BEBIDAS)[number]

export const BEBIDA_LABEL: Record<BebidaKey, string> = {
  fernet: 'Fernet',
  cerveza: 'Cerveza',
  vino: 'Vino',
}

export const FINOS_TEXTO = 'Además se compra algo de gin y vermouth para los finos 🍸'

// Nivel de consumo: barra de 0% a 100% en pasos de 10. Cada nivel tiene su frase.
// Para las compras, 100% equivale a PORCIONES_AL_100 porciones (50% = la mitad, etc.).
export const NIVEL_PASO = 10
export const PORCIONES_AL_100 = 10
export const NIVEL_FRASES: Array<{ desde: number; frase: string }> = [
  { desde: 0, frase: 'señor charle un rato con dewinne' },
  { desde: 10, frase: 'eeee, soy un chocli o un yayin' },
  { desde: 30, frase: 'pase de ser yayin a ser yaggermaister' },
  { desde: 50, frase: 'al medio, sin dudar' },
  { desde: 70, frase: 'pincho mas latas que el 1 de alo' },
  { desde: 100, frase: 'imposible, solo el zubel puede poner 100%' },
]

export function fraseNivel(nivel: number): string {
  let out = NIVEL_FRASES[0].frase
  for (const f of NIVEL_FRASES) if (nivel >= f.desde) out = f.frase
  return out
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
  { id: 'cola', label: 'Coca', unidad: 'ml', envaseMl: 2250, envaseLabel: 'Botella 2,25 L' },
  { id: 'cerveza', label: 'Cerveza', unidad: 'ml', envaseMl: 500, envaseLabel: 'Lata o botella de ½ L', packUnidades: 6 },
  { id: 'vino', label: 'Vino', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'gin', label: 'Gin (para los finos)', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'vermut', label: 'Vermouth (para los finos)', unidad: 'ml', envaseMl: 750, envaseLabel: 'Botella 750 ml' },
  { id: 'agua', label: 'Agua', unidad: 'ml', envaseMl: 1500, envaseLabel: 'Botella 1,5 L' },
  { id: 'hielo', label: 'Hielo', unidad: 'g', envaseMl: 3000, envaseLabel: 'Bolsa 3 kg' },
]

// Ingredientes por porción (ml) de cada bebida. Con PORCIONES_AL_100 = 10, alguien en 50% que reparte
// 50% fernet y 50% cerveza da 2,5 porciones de cada una: medio fernet (375 ml) + 1,5 L de coca y
// 1,5 L de cerveza (3 de ½ L). Con 50% vino, 0,5 L de vino. (Pedido de Agus, 6/10/2026.)
export const RECETAS: Record<BebidaKey, Record<string, number>> = {
  fernet: { fernet: 150, cola: 600 },
  cerveza: { cerveza: 600 },
  vino: { vino: 200 },
}

// Compras fijas aparte de lo que elige cada uno (envases).
export const EXTRAS_FINOS: Record<string, number> = { gin: 1, vermut: 1 }

export const RESERVA_COMPRA_PCT = 10
export const AGUA_ML_POR_ASISTENTE = 1000
export const HIELO_G_POR_ASISTENTE = 500
