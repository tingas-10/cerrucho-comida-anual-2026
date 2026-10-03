// ============================================================
// CONTENIDO EDITABLE · Plantillas de tareas y agenda
// Se copian como borrador al crear una edición. Después se editan desde el panel.
// ============================================================

export interface TareaPlantilla {
  title: string
  description?: string
  quantity?: number
  unit?: string
  capacity: number // cuántos voluntarios acepta
}

export const TAREAS_PLANTILLA: TareaPlantilla[] = [
  { title: 'Confirmar lugar', description: 'Reservar y confirmar dirección y horario.', capacity: 1 },
  { title: 'Comprar comida', capacity: 2 },
  { title: 'Comprar bebidas', description: 'Según la lista de compras de Bebidas.', capacity: 2 },
  { title: 'Comprar hielo', quantity: 1, unit: 'bolsa por persona aprox.', capacity: 1 },
  { title: 'Llevar vasos', quantity: 40, unit: 'vasos', capacity: 2 },
  { title: 'Llevar parlante', capacity: 1 },
  { title: 'Preparar premios', description: 'Trofeos, sobres o lo que sea.', capacity: 2 },
  { title: 'Proyectar ceremonia', description: 'Tele o proyector + cable.', capacity: 1 },
  { title: 'Coordinar salida', capacity: 1 },
  { title: 'Limpieza', capacity: 4 },
]

// Lista personal de cada uno (checks privados, no son gastos).
export const LISTA_PERSONAL = [
  { key: 'regalo', label: 'El regalo del amigo invisible (si participás)' },
  { key: 'pago', label: 'Medio de pago' },
  { key: 'compromiso', label: 'Lo que te comprometiste a llevar' },
  { key: 'documento', label: 'Documento (si la salida lo pide)' },
]

// Agenda borrador: etapas sin hora oficial. Los offsets son sugerencias en minutos
// desde la llegada, para que Agus arme horarios rápido cuando haya fecha.
export const AGENDA_PLANTILLA = [
  { key: 'llegada', label: 'Llegada', offsetMin: 0 },
  { key: 'regalos', label: 'Regalos', offsetMin: 45 },
  { key: 'comida', label: 'Comida', offsetMin: 75 },
  { key: 'premios', label: 'Premios', offsetMin: 150 },
  { key: 'salida', label: 'Salida', offsetMin: 240 },
]
