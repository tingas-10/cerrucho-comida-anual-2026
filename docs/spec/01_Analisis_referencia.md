# Análisis de la web de referencia

La Banda del cerrucho · Especificación de implementación · 2 de octubre de 2026

La web nueva debe conservar la estructura de panel de evento de Olimpiadas ABN y adaptarla a una cena anual con amigos. Este análisis describe la referencia observada y define qué se reutiliza en la experiencia nueva. La especificación funcional y técnica que acompaña este documento es la autoridad para implementar el producto.

## 1 Alcance de la inspección

Referencia: https://abn-olympics.web.app/

Se inspeccionaron las 14 rutas públicas mediante sus pantallas y HTML servido, y los archivos públicos CSS y JavaScript que permiten comprobar la estructura del frontend. Se recorrieron las interacciones de navegación, el módulo de resultados y su modo de proyección, y las secciones de sorteo, bebidas, cronograma, vestimenta, organización y multimedia. No se ejecutaron sorteos, no se votó ni se modificó información de la referencia.

El panel de Organización exige acceso. Sus formularios internos, las reglas desplegadas de Firestore, los trabajos privados de sincronización y el código fuente del repositorio no están comprobados. La presencia de botones, mensajes y código cliente demuestra la experiencia publicada, pero no valida los permisos del servidor. No copiar ni dar por segura una implementación por su apariencia.

Los datos cambian al hidratar y conectarse en vivo. Por ejemplo, el HTML inicial de bebidas mostraba cero respuestas y luego la pantalla cargó respuestas reales y una lista de compras. Los números del evento de ABN son una instantánea de la inspección y no deben trasladarse a la cena de amigos.

## 2 Estructura visual y navegación

La referencia tiene una carcasa persistente. En escritorio, el menú lateral ocupa 220 px y se reduce a 64 px al contraerlo. Permanece junto al contenido durante la navegación. Agrupa las páginas bajo Edición 2026 y Archivo. Cada entrada combina un icono de trazo con un nombre corto; la ruta activa tiene fondo suave y texto de mayor peso. Algunas acciones de participantes se agrupan visualmente dentro del menú.

La barra superior mide 44 px. Incluye el recorrido de navegación, un botón con la cantidad de asistentes, acceso a la cuenta y cambio de tema. El contenido usa márgenes de 16 px en pantallas pequeñas y 24 px desde el breakpoint de 640 px. El menú de escritorio desaparece por debajo de 640 px y se reemplaza por navegación horizontal desplazable debajo de la barra superior. Esta solución se conserva como referencia estructural; el producto nuevo tendrá navegación móvil específica para que votar no exija recorrer una fila muy larga.

Las páginas operativas tienen un rótulo pequeño en mayúsculas, título principal, una explicación breve y bloques de contenido. Las tarjetas poseen fondo separado de la página, borde fino, esquinas redondeadas y sombra discreta. La densidad es alta en tablas, pero los títulos y los resúmenes generan una jerarquía clara.

La tipografía publicada es Plus Jakarta Sans, con fuente cargada mediante recursos de Next.js. Los iconos tienen la estructura de Lucide. El CSS contiene utilidades de Tailwind y variables propias para tema, superficies, texto y estados. No se fija una versión exacta de Next.js ni de Tailwind a partir de estos indicios.

| Elemento | Valor observado | Aplicación en la nueva web |
| --- | --- | --- |
| Sidebar expandido | 220 px | 232 px para nombres algo más largos |
| Sidebar contraído | 64 px | 64 px con tooltips accesibles |
| Barra superior | 44 px | 56 px para uso táctil |
| Fondo claro | #F5F6FA | Conservar |
| Tarjeta clara | #FFFFFF | Conservar |
| Texto principal claro | #0E1119 | Conservar |
| Borde claro | #E0E2EA | Conservar |
| Fondo oscuro | #0C0E14 | Conservar |
| Tarjeta oscura | #171B26 | Conservar |
| Texto principal oscuro | #E2E4EB | Conservar |
| Acento de referencia | Azul sobrio | Dorado para la ceremonia y acciones puntuales |
| Estado activo | Fondo tonal y peso tipográfico | Conservar, sin depender sólo del color |

El tema se guarda en localStorage con una preferencia persistente. Existe tratamiento para reducir animaciones cuando el usuario lo solicita en el sistema. La adaptación debe mantener ambos comportamientos.

## 3 Portada

La portada ocupa prácticamente toda la altura disponible. Construye un muro de fotos en cuatro filas horizontales, con imágenes de alturas similares y anchos variables según su proporción. Las filas se desplazan; las imágenes se repiten para producir continuidad visual. Un gradiente radial del color de fondo aclara u oscurece el centro y facilita leer un título enorme, ABN TRIP. El título usa peso alto, tracking ajustado, tamaño responsive y una altura de línea muy compacta. Debajo aparecen cuatro marcas de color vinculadas a los países.

La nueva portada conserva fotos auténticas, título grande y tratamiento editorial, pero reduce el hero para que los pendientes estén visibles al entrar. El texto será La Banda del cerrucho y Cena de fin de año 2026. No usar los logos de ABN ni las marcas de países. La identidad es la del grupo de amigos.

## 4 Inventario funcional de las páginas

| Ruta | Qué presenta la referencia | Cómo se adapta |
| --- | --- | --- |
| / | Muro de fotos y título del viaje | Inicio con fotos, decisiones y pendientes personales |
| /paises | Padrón agrupado por cuatro países, asistencia y resumen | Miembros y asistencia, sin equipos ni países |
| /sorteo | Bombo, semilla, ensayo y asignación de países | Amigo invisible con sorteo secreto en servidor |
| /calendario | Tres vías para juegos, comidas e hitos | Agenda de una noche y decisiones previas |
| /dresscode | Inspiración de vestimenta en columnas animadas | Dress code opcional dentro de la salida y agenda |
| /juegos | Disciplinas, puntajes, medallero en vivo y proyección | Premios, ballotage y ceremonia con revelación controlada |
| /anotarse | Selección personal de disciplinas | Confirmar asistencia y compromisos propios |
| /bebidas | Nivel individual, reparto de 100 por ciento y compras | Reparto de seis bebidas y cantidades por receta |
| /autos | Viajes compartidos y estado personal | Traslado a la cena y salida posterior |
| /bolso | Lista personal y objetos compartidos con responsables | Qué llevar y tareas de organización |
| /ficha | Información privada para el viaje | Preferencias alimentarias pertinentes, sin ficha médica general |
| /organizacion | Acceso protegido para organizadores | Administración completa de Agus |
| /historial | Campeones y resultados de otras ediciones | Premios y cenas de años anteriores |
| /multimedia | Fotos y videos, filtros por año y visor | Galería privada con carga desde el celular |

### 4.1 Países y sorteo

El padrón se muestra por país con subgrupos que viajan y no viajan. La página indica que se alimenta de Humand. El sorteo distingue viajeros, satélites y personas fuera del bombo, permite ensayar y tiene una semilla visible para una asignación reproducible. También se observa recuperación de asignaciones en vivo.

Para la cena no existe Humand ni una necesidad de equilibrar países o géneros. Se reemplaza ese padrón por miembros administrados por correo. La semilla visible del sorteo no se reutiliza: un amigo invisible generado en el navegador o reproducible a partir de información pública perdería el secreto. La pantalla nueva muestra exclusivamente a quién regala el usuario autenticado.

### 4.2 Cronograma y vestimenta

El cronograma organiza tres días en columnas y franjas horarias. Separa actividades, comidas e hitos; hay actividades sin horario. La vestimenta combina textos cortos, inspiración visual y ampliación de imágenes.

La nueva agenda es una línea temporal de una sola noche. Antes de confirmar la fecha muestra etapas sin hora oficial. Después permite publicar horarios, domicilio, entrega de regalos, cena, premios y salida. No trasladar los horarios del viaje ni inventar reservas.

### 4.3 Juegos y proyección

El medallero usa datos en vivo y se acompaña de listas de disciplinas con primer y segundo puesto. El modo Proyectar sustituye la carcasa habitual por una presentación grande de resultados. Cuando no hay cuenta, se informa que se está mirando sin editar y los controles de carga quedan deshabilitados en la experiencia visible.

El patrón de proyección es muy útil para la ceremonia. La diferencia fundamental es que el medallero puede actualizarse públicamente mientras se juega; los premios de amigos deben mantener ganadores y recuentos ocultos hasta revelar cada categoría. El nuevo frontend nunca debe recibir ganadores de categorías no reveladas, aunque no los pinte.

### 4.4 Bebidas

La referencia combina un nivel personal de consumo, porcentajes cuya suma es 100 y una casilla de no consumo. La lista de compras cambia en vivo e incluye bebidas para mezclar. Hay buscador por persona, campos numéricos con botones para subir y bajar y un indicador de porcentaje restante. La referencia usa seis opciones, incluye vermú y agrega una cantidad fija de cerveza para juegos durante dos noches.

La adaptación usa exactamente Fernet, Cerveza, Gin, Vodka, Vino y Aperol. Se eliminan los agregados propios del viaje. Cada respuesta combina porcentajes con cantidad estimada de porciones; las compras se calculan por ingredientes, tamaños de envases, stock y asistentes confirmados. No se puede interpretar un porcentaje grupal como un volumen de destilados.

### 4.5 Autos y listas

Autos separa la coordinación general del viaje propio. Arma tu bolso combina una lista privada y elementos comunes donde se ve quién aporta y cuánto falta. Ambos patrones sirven para coordinar remises, transporte compartido, hielo, parlantes, vasos, comida y limpieza.

La nueva aplicación permite que cada miembro se ofrezca o se retire de una tarea, sin editar los títulos, cantidades ni responsables ajenos. La administración puede reasignar y ajustar los recursos.

### 4.6 Historial y multimedia

Historial permite cambiar de edición y vincula resultados con fotos. Multimedia muestra una grilla tipo masonry, filtros por año, apertura en grande y navegación con flechas. Durante la inspección ofrecía carga progresiva de 120 archivos y miniaturas provenientes de Google Drive.

Para un grupo pequeño, conservar grilla, filtros y lightbox, pero usar páginas de 24 elementos y originales privados. Incorporar carga múltiple de fotos y videos, progreso y reintentos. Una imagen de Drive en una web pública no satisface por sí sola la privacidad de los nuevos miembros. No almacenar los nuevos archivos en rutas públicas.

## 5 Arquitectura pública comprobable

El HTML contiene recursos /_next/static, payloads de React Server Components, un componente compartido Shell y un componente MediaWall. Esto permite identificar Next.js y React. El código público incluye SDK de Firebase Authentication y Firestore, configuración de aplicación y suscripciones en vivo. También hay datos de padrón y textos que describen sincronización con Humand. Las miniaturas usan URLs de Google Drive. El dominio web.app es consistente con hosting de Firebase.

Estos hallazgos no prueban cómo está organizado el repositorio ni qué funciones privadas se despliegan. No reutilizar credenciales, claves, identificadores de infraestructura, conexiones con Humand, logos o archivos de ABN. El producto nuevo se implementa como proyecto independiente.

| Capa | Evidencia pública | Decisión nueva |
| --- | --- | --- |
| Frontend | Next.js, React, utilidades Tailwind | Next.js App Router, TypeScript y Tailwind |
| Identidad | Firebase Auth y cuenta corporativa en la UI | Supabase Auth con OTP por correo invitado |
| Datos | SDK Firestore y estados en vivo | PostgreSQL de Supabase con transacciones |
| Multimedia | Miniaturas y originales enlazados a Drive | Storage privado y URLs temporales autorizadas |
| Padrón | Datos y textos de Humand | Administración propia e importación CSV |
| Despliegue | Dominio de Firebase | Vercel y Supabase como arquitectura elegida |

La elección de PostgreSQL permite expresar unicidad de votos, snapshots de electores, cierres y sorteos de manera transaccional. Es una decisión de implementación nueva; no una reconstrucción supuesta del servidor de ABN.

## 6 Qué preservar y qué corregir

Preservar la navegación persistente, fotos reales, tipografía, tarjetas, temas claro y oscuro, explicaciones breves, listas personales, archivo anual y pantalla de proyección.

Adaptar los formularios anchos a tarjetas individuales en móvil. Mostrar carga inicial como Cargando respuestas, nunca como cero real. No sustituir un fallo de conexión por un resultado vacío. Después de una reconexión, releer el estado del servidor antes de habilitar acciones sensibles.

La portada debe impulsar decisiones. La ficha de cada usuario es un punto de participación, y el administrador debe ver quién tiene pendientes sin acceder a ganadores accidentalmente. Las reglas de voto, cierre, desempate y cambio de participantes deben existir en servidor y tener pruebas; esconder botones sólo aporta experiencia de uso.

## 7 Imágenes suministradas y criterio de uso

Se revisaron las 11 imágenes adjuntas. Una es el encabezado del grupo de WhatsApp y diez son fotos o composiciones. Hay dos imágenes similares del grupo de noche, una foto amplia del grupo en una reunión al aire libre, fotos de encuentros y retratos, y una composición humorística. No se identificó a las personas por sus caras ni se asignaron fotografías a nombres.

La portada inicial usará la foto amplia del grupo del archivo WhatsApp Image 2026-09-28 at 17.35.28.jpeg. La foto de noche de mayor resolución será el segundo recurso colectivo. Las demás se incorporan al álbum Recuerdos, incluidas las composiciones, con su clasificación en el manifiesto. No atribuirles año de evento o ubicación a partir del nombre del archivo. Los retratos no se convierten en avatares de personas concretas automáticamente.

El encabezado contiene 23 alias visibles y la etiqueta You. Los alias transcritos son: Agus, Choclo, Facu, Felix, Francisco, Marcos, Mateo, Mene, Nacho, Pato, pay, Pipe, rodri, Saimon, Santi, Thomas, Tita, tobi, Tomas, Tomi, Topo, Torta y Ucky. You es una etiqueta del cliente de WhatsApp; no crear una persona con ese nombre. El alias Agus tampoco se fusiona automáticamente con el administrador por semejanza de nombre. Los registros quedan como borradores hasta que la administración confirme la correspondencia y cargue el correo.

El manifiesto de recursos del paquete conserva nombres originales, nombres seguros para el proyecto, tamaño, dimensiones, huella SHA256, orden y uso propuesto. El desarrollador recibe todos los originales y no necesita volver a pedirlos.
