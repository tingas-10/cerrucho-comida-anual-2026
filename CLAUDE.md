# Guía para Claude · cerrucho-comida-anual-2026

Web personal de Agus (NO es de ABN) para la cena anual con amigos. Repo público en GitHub Pages + Firebase gratis. Hablarle a Agus en español argentino, sin jerga de código; él no usa terminal: darle pasos de un clic o hacerlo por él.

## Objetivo de mantenimiento

Que los cambios chicos salgan rápido por chat: editar el archivo correspondiente, `npm run build` para verificar, commit y push a `main` (GitHub Actions publica solo).

## Dónde vive cada cosa

| Qué cambiar | Archivo |
| --- | --- |
| Nombre del grupo, mail del dueño, textos de la web, alias iniciales, montos del regalo, quórum | `src/content/config.ts` |
| Fotos de la galería y álbumes (las imágenes van en `public/galeria/<album>/`) | `src/content/galeria.ts` |
| Categorías iniciales de premios y regla "Nadie" | `src/content/premios.ts` |
| Bebidas, recetas, envases, reserva, agua/hielo | `src/content/bebidas.ts` |
| Plantillas de tareas, lista personal y agenda | `src/content/tareas.ts` |
| Colores, tipografía, radios, estilos globales | `src/index.css` |
| Config de Firebase (pública por diseño; excepción autorizada por Agus) | `src/firebase/firebase.config.json` |
| Reglas de seguridad (al cambiarlas, Agus debe republicarlas: ver README) | `firestore.rules` |
| Edición activa (slug/año/título) | `EDICION_ACTUAL` en `src/content/config.ts` |

Los contenidos de `src/content/*` sólo se usan como **seed** al crear una edición. Para una edición ya creada, categorías/recetas/tareas se editan desde Administración (viven en Firestore). Cambiar el seed no modifica una edición existente.

## Estructura

- `src/data/` capa de datos: `adapter.ts` (interfaz), `firestoreAdapter.ts`, `memoryAdapter.ts` (modo demo + localStorage), `auth.ts`, `DataContext.tsx` (sesión y resolución de miembro), `hooks.ts` (useDoc/useCollection/useEdition/useMembers), `paths.ts` (todas las rutas de Firestore), `seed.ts` (bootstrap idempotente), `demoSeed.ts`, `types.ts`.
- `src/domain/` reglas puras con tests (`npm test`): `awards.ts` (conteo y ballotage), `beverages.ts` (validación y compras), `expenses.ts` (reparto en centavos, saldos), `gift.ts` (sorteo cripto), `polls.ts`, `format.ts` (fechas Buenos Aires).
- `src/ui/` carcasa (`Shell.tsx`), componentes base (`components.tsx`), `PollCard.tsx`, toast, tema.
- `src/pages/` una pantalla por archivo; `src/pages/admin/` una pestaña del panel por archivo.
- `docs/spec/` la especificación original del paquete (autoridad de producto).

## Reglas del dominio que no se negocian

- Premios: una selección por categoría; `NOBODY` es candidato real. Primera ronda: diferencia ≥ 3 gana; si no, ballotage con todos los votados a menos de 3 del líder. Ballotage: gana el mayor; empate = EMPATE (sin tercera ronda). Sin votos = SIN VOTOS. Los casos están en `docs/spec/06_Casos_reglas.json` y son tests.
- Nunca mostrar recuentos ni ganadores antes de revelar. El doc público `awards/{code}` sólo lleva `finalists` al abrir ballotage y `result` al revelar; lo sellado va en `awards/{code}/private/sealed` (sólo admin).
- Amigo invisible: `crypto.getRandomValues`, sin autoasignación, mínimo 3, una sola publicación por versión; el miembro sólo lee `giftAssignments/{suId}`.
- Bebidas: seis claves fijas; porcentajes enteros que suman 100; porciones 1–20; `noAlcohol` = todo cero y cuenta como respuesta. Compras: sumar ingredientes, reserva 10 %, restar stock una vez, redondear por envase; nunca sumar reserva después de redondear.
- Gastos: centavos enteros; resto repartido de a 1 por orden de id; suma exacta.
- Fechas en ms UTC, mostradas en `America/Argentina/Buenos_Aires` (UTC-3 fijo).

## Modo demo

Si `firebase.config.json` tiene `PEGAR_...`, la app usa `MemoryAdapter` + `DemoAuthAdapter` con datos ficticios (`demoSeed.ts`). Sirve para previsualizar sin backend y para verificar cambios de UI en el navegador: `npm run dev` y entrar como "Agustín (administrador)".

## Verificación antes de commitear

```bash
npm test && npm run build
```
