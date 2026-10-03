// ============================================================
// CONTENIDO EDITABLE · Datos generales y textos de la web
// Cambiar acá nombres, textos y defaults. No hay lógica en este archivo.
// ============================================================

export const GRUPO = {
  nombre: 'La Banda del cerrucho',
  nombreCorto: 'La Banda',
  // Dueño y único administrador inicial. También está fijado en firestore.rules.
  ownerEmail: 'agustin@abndigital.com.ar',
  ownerAlias: 'Agustín',
  zonaHoraria: 'America/Argentina/Buenos_Aires',
  moneda: 'ARS',
  // Álbum compartido externo (Google Photos / Drive) para que la banda suba fotos.
  // Si está vacío, el botón "Subir fotos" explica cómo mandarlas.
  albumCompartidoUrl: '',
} as const

export const EDICION_ACTUAL = {
  slug: '2026',
  anio: 2026,
  titulo: 'Comida anual 2026',
  heroFoto: 'galeria/recuerdos/10_grupo_portada.jpeg',
  heroFotoSecundaria: 'galeria/recuerdos/04_grupo_noche.jpeg',
} as const

export const TEXTOS = {
  loginAyuda: 'Usá el mail con el que te invitaron.',
  loginRespuesta: 'Si ese mail tiene una invitación activa, te va a llegar un link para entrar.',
  heroSinFecha: 'La comida anual está por armarse. Tu primera misión es votar la fecha.',
  heroConFecha: 'Ya hay fecha. Confirmá si venís y sumate a lo que falta.',
  votoPrivado:
    'Tu voto no se muestra al grupo. Agus puede acceder a información reservada para resolver incidencias.',
  premiosRegla:
    'Un voto por categoría. Si el primero y el segundo quedan a menos de tres votos, hay ballotage entre todas las opciones votadas dentro de ese margen (también "Nadie lo merece"). En el ballotage gana el más votado; si empatan, es EMPATE. Podés votarte a vos mismo.',
  galeriaVacia: 'Este álbum espera sus primeras fotos.',
  archivoVacio: 'Todavía no cargamos premios de otros años.',
  noLlego: 'No llego',
  faltaDefinir: 'Falta definir',
} as const

// Miembros del grupo de WhatsApp (alias + nombre). Se cargan sin mail: Agus les carga el
// correo desde Administración > Miembros, donde también puede editar alias y nombre.
export const MIEMBROS_INICIALES: Array<{ alias: string; nombre: string }> = [
  { alias: 'pay', nombre: 'Pay Aguilar' },
  { alias: 'Saimon', nombre: 'Simon Avellaneda' },
  { alias: 'tobi', nombre: 'Tobi Aguilar' },
  { alias: 'Francisco', nombre: 'Francisco Chueco Baque' },
  { alias: 'Ucky', nombre: 'Ucky Baliña' },
  { alias: 'Pato', nombre: 'Pato Carrere' },
  { alias: 'Choclo', nombre: 'Choclo' },
  { alias: 'Facu', nombre: 'Facu Caputo' },
  { alias: 'Tomas', nombre: 'Tomas Chiocarelli' },
  { alias: 'Marcos', nombre: 'Marcos D.W.' },
  { alias: 'Felix', nombre: 'Felix' },
  { alias: 'Nacho', nombre: 'Nacho Furesz' },
  { alias: 'rodri', nombre: 'Rodri Landaburu' },
  { alias: 'Santi', nombre: 'Santi Lilo' },
  { alias: 'Mene', nombre: 'Mene' },
  { alias: 'Pipe', nombre: 'Pipe Martignone' },
  { alias: 'Topo', nombre: 'Topo Mao' },
  { alias: 'Tomi', nombre: 'Tomi Orreily' },
  { alias: 'Mateo', nombre: 'Mateo Ramirez' },
  { alias: 'Tita', nombre: 'Jero Sasiain' },
  { alias: 'Torta', nombre: 'Torta' },
  { alias: 'Agus', nombre: 'Agus Vayo' },
  { alias: 'Thomas', nombre: 'Thomas Warner' },
]

// Presidente inicial (puede confirmar fecha, lugar y comida). Se cambia desde Administración > Miembros.
export const PRESIDENTE_INICIAL = 'm-facu'

// Acceso: usuario y contraseña, sin mail. Por dentro, Firebase necesita un mail: se arma uno
// inventado con este dominio reservado (.invalid nunca existe ni recibe mails).
export const LOGIN_DOMINIO_INTERNO = 'miembros.cerrucho.invalid'
export const PASSWORD_MIN = 6

// Opciones iniciales de la comida anual (las carga el administrador; la banda suma las suyas).
export const LUGARES_INICIALES = ['El galpón de Pipe', 'Lo del Cufa', 'El SUM de Oliden Joven de Tingas']
export const COMIDAS_INICIALES = ['Picada más asado', 'Picada grande']

// Compatibilidad: lista de alias (derivada de MIEMBROS_INICIALES).
export const ALIAS_INICIALES = MIEMBROS_INICIALES.map((m) => m.alias)

// Fechas candidatas iniciales para la consulta de disponibilidad: todos los jueves,
// viernes y sábados entre estas dos fechas (inclusive), a la hora indicada.
export const FECHAS_CANDIDATAS = {
  desde: '2026-11-05',
  hasta: '2026-12-19',
  diasSemana: [4, 5, 6] as number[], // 0 = domingo … 4 = jueves, 5 = viernes, 6 = sábado
  hora: '21:00',
  cierreConsulta: '2026-10-31', // hasta cuándo se puede responder (23:59)
}

// Propuestas de comida en borrador (nunca son opciones reales hasta que Agus las publique).
export const COMIDA_BORRADORES = ['Asado', 'Pizzas', 'Catering', 'Restaurante'] as const

// Montos propuestos para el amigo invisible (en pesos, sin centavos).
export const REGALO_MONTOS_BORRADOR = [50000, 75000, 100000, 150000] as const
export const REGALO_TOLERANCIA_PCT = 10
export const REGALO_MIN_PARTICIPANTES = 3

// Quórum logístico (porcentaje de electores que tienen que responder).
export const QUORUM_LOGISTICO_PCT = 70
// Duración sugerida del ballotage de premios y de la segunda vuelta logística (horas).
export const BALLOTAGE_HORAS = 48
export const DESEMPATE_LOGISTICO_HORAS = 48
