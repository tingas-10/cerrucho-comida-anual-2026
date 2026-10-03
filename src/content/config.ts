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
  titulo: 'Cena de fin de año 2026',
  heroFoto: 'galeria/recuerdos/10_grupo_portada.jpeg',
  heroFotoSecundaria: 'galeria/recuerdos/04_grupo_noche.jpeg',
} as const

export const TEXTOS = {
  loginAyuda: 'Usá el mail con el que te invitaron.',
  loginRespuesta: 'Si ese mail tiene una invitación activa, te va a llegar un link para entrar.',
  heroSinFecha: 'La cena está por armarse. Tu primera misión es votar la fecha.',
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

// Alias observados en el grupo de WhatsApp. Son borradores sin mail:
// Agus los vincula y les carga el correo desde Administración > Miembros.
export const ALIAS_INICIALES = [
  'Agus',
  'Choclo',
  'Facu',
  'Felix',
  'Francisco',
  'Marcos',
  'Mateo',
  'Mene',
  'Nacho',
  'Pato',
  'pay',
  'Pipe',
  'rodri',
  'Saimon',
  'Santi',
  'Thomas',
  'Tita',
  'tobi',
  'Tomas',
  'Tomi',
  'Topo',
  'Torta',
  'Ucky',
] as const

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
