# Guía para Claude · cerrucho-comida-anual-2026

Web permanente de La Banda del cerrucho, personal de Agus (NO es de ABN): portada, Comida anual (una edición por año), FMO y Cumpleaños. Repo público en GitHub Pages + Firebase gratis (proyecto creado con la cuenta personal de Gmail de Agus). Hablarle a Agus en español argentino, sin jerga de código; él no usa terminal: darle pasos de un clic o hacerlo por él.

## Objetivo de mantenimiento

Que los cambios chicos salgan rápido por chat: editar el archivo correspondiente, `npm run build` para verificar, commit y push a `main` (GitHub Actions publica solo).

## Dónde vive cada cosa

| Qué cambiar | Archivo |
| --- | --- |
| Nombre del grupo, textos de la web, presidente inicial, lugares y comidas iniciales, miembros iniciales (alias + nombre), fechas candidatas, montos del regalo, quórum | `src/content/config.ts` |
| Fotos de la galería y álbumes (las imágenes van en `public/galeria/<album>/`) | `src/content/galeria.ts` |
| Categorías iniciales de premios y regla "Nadie" | `src/content/premios.ts` |
| Bebidas, frases del nivel de consumo (barra 0-100), recetas, envases, reserva, agua/hielo | `src/content/bebidas.ts` |
| Plantillas de tareas, lista personal y agenda | `src/content/tareas.ts` |
| FMO (fútbol): puntos del ranking, tamaños de equipo, nombres por defecto | `src/content/fmo.ts` |
| Pádel: formatos (1, 3 o 5 sets), puntos por formato, cupo de invitados | `src/content/padel.ts` |
| Colores, tipografía, radios, estilos globales | `src/index.css` |
| Config de Firebase (pública por diseño; excepción autorizada por Agus) | `src/firebase/firebase.config.json` |
| Reglas de seguridad (al cambiarlas: probar con `scripts/test-rules.mjs` y publicarlas, ver abajo) | `firestore.rules` |
| Edición activa (slug/año/título) | `EDICION_ACTUAL` en `src/content/config.ts` |

Los contenidos de `src/content/*` sólo se usan como **seed** al crear una edición. Para una edición ya creada, categorías/recetas/tareas se editan desde Administración (viven en Firestore). Cambiar el seed no modifica una edición existente.

## Estructura

- `src/data/` capa de datos: `adapter.ts` (interfaz), `firestoreAdapter.ts`, `memoryAdapter.ts` (modo demo + localStorage), `auth.ts`, `DataContext.tsx` (sesión y resolución de miembro), `hooks.ts` (useDoc/useCollection/useEdition/useMembers), `paths.ts` (todas las rutas de Firestore), `seed.ts` (bootstrap idempotente), `demoSeed.ts`, `types.ts`.
- `src/domain/` reglas puras con tests (`npm test`): `awards.ts` (conteo y ballotage), `beverages.ts` (validación y compras), `expenses.ts` (reparto en centavos, saldos), `gift.ts` (sorteo cripto), `polls.ts`, `format.ts` (fechas Buenos Aires).
- `src/ui/` carcasa (`Shell.tsx`), componentes base (`components.tsx`), `PollCard.tsx`, toast, tema.
- `src/pages/` una pantalla por archivo; `src/pages/admin/` una pestaña del panel por archivo.
- `src/pages/padel/` sección Pádel: partidos de 4 (al menos 3 de la banda, hasta 1 invitado) en una cancha azul, sets, ranking individual y de parejas, jugadores y 1 vs 1. Reglas puras en `src/domain/padel.ts`; colección `padelMatches`. Los invitados son los mismos de FMO (`fmoGuests`).
- `src/pages/fmo/` sección FMO (fútbol): partidos con cancha arrastrable, ranking, jugadores/invitados y 1 vs 1. Reglas puras en `src/domain/fmo.ts`. Colecciones `fmoMatches` y `fmoGuests`: todos los miembros activos leen y escriben.
- `docs/spec/` la especificación original del paquete (autoridad de producto).

## Acceso y roles (desde el 2026-10-03)

- Visitantes navegan sin entrar (sólo lectura). Miembros entran con **usuario y contraseña, sin mail**. Presidente (`config/roles.presidentId`, hoy `m-facu`) confirma fecha, lugar y comida. Administrador = Agus (`owner`).
- Por dentro: Firebase Auth email/contraseña con un mail interno `usuario.sufijo@miembros.cerrucho.invalid`. `logins/{usuario}` (público, sólo get) → {memberId, email}; `uids/{uid}` → memberId (sólo lo escribe el admin); `memberPrivate/{id}` guarda usuario, uid y año de nacimiento.
- El admin crea cuentas con una app secundaria de Firebase en memoria (`src/data/accounts.ts`) para no perder su sesión. **Resetear contraseña = crear una cuenta de acceso nueva** con otro sufijo y reapuntar `logins`/`uids`; nadie ve la contraseña vieja.
- Nunca escribir contraseñas en el chat ni en archivos: se muestran sólo en el modal de Administración.
- Las reglas se prueban con `GOOGLE_ACCESS_TOKEN=<token> node scripts/test-rules.mjs` (36 casos por rol contra el probador oficial; no publica nada) y se publican con `npx firebase-tools deploy --only firestore:rules --project cerrucho-comida-anual-2026`. Ningún token ni secreto va al repo (es público).

## Reglas del dominio que no se negocian

- Premios: una selección por categoría; `NOBODY` es candidato real. Primera ronda: diferencia ≥ 3 gana; si no, ballotage con todos los votados a menos de 3 del líder. Ballotage: gana el mayor; empate = EMPATE (sin tercera ronda). Sin votos = SIN VOTOS. Los casos están en `docs/spec/06_Casos_reglas.json` y son tests.
- El VAO (Viaje Anual Obligatorio) está apagado con `VAO_ACTIVO = false` en `src/content/premios.ts`: oculta sus tres premios y la columna "Fue al VAO". Agus lo va a sumar más adelante (VAO 2027); no mostrar nada de VAO hasta que lo pida.
- No hay módulo de ceremonia ni de gastos (Agus los sacó el 2026-10-02).
- **Los resultados de los premios no se publican nunca.** Sólo Agus (`owner`) los ve en Administración → Premios; lo sellado va en `awards/{code}/private/sealed` (regla: sólo `owner`). La votación tiene período (abre/cierra) y las reglas rechazan votos fuera de él. Al abrir ballotage, el doc público lleva `finalists` (se avisa en la UI).
- Amigo invisible: entra **toda la banda** (no suspendidos y que participan), sin inscripción. Agus toca Sortear; `crypto.getRandomValues`, sin autoasignación, mínimo 3. Cada miembro sólo lee `giftAssignments/{suId}` y ve los gustos de su destinatario.
- Propuestas de lugar y comida: van directo a votación (👍/👎). "Más votado" se muestra aparte de "Confirmado por el presidente".
- Fechas: calendario mensual con Puedo / No puedo / Capaz; "marcar pendientes como" sólo toca las sin responder. Las fechas candidatas las agrega sólo el admin.
- Bebidas: sólo fernet, cerveza y vino (más gin y vermouth fijos "para los finos", `EXTRAS_FINOS`). Nivel 0–100 en pasos de 10 (100 = `PORCIONES_AL_100` porciones). Regla de Agus: alguien en 50% con mitad fernet y mitad cerveza = medio fernet de 750 ml + 1,5 L de coca + 3 cervezas de ½ L; 50% vino = 0,5 L. Compras: sumar ingredientes, reserva 10 %, restar stock una vez, redondear por envase; nunca sumar reserva después de redondear. Las recetas de una edición creada viven en Firestore (`editions/{slug}.beverage`).
- Fechas en ms UTC, mostradas en `America/Argentina/Buenos_Aires` (UTC-3 fijo).

## Celular primero

La banda usa la web desde el celular. Reglas: nada de scroll horizontal de página a 330 px de ancho; campos con `font-size` de 16 px o más (si no, el iPhone hace zoom); botones y controles de 40 px de alto o más; tablas anchas se convierten en tarjetas debajo de `md`; las acciones de guardar largas van en una barra `sticky` arriba de la barra inferior. Los estilos propios de `src/index.css` viven dentro de `@layer base/components` para que las clases de Tailwind los puedan pisar: no escribir CSS fuera de capa.

## Modo demo

Con `VITE_DEMO=1` (o si `firebase.config.json` tiene `PEGAR_...`) la app usa `MemoryAdapter` + `DemoAuthAdapter` con datos ficticios (`demoSeed.ts`), sin tocar Firebase. Es lo que usa el servidor local `cerrucho` de `Documentos/Claude/.claude/launch.json` para verificar cambios de UI: botones de entrada rápida por rol (Agustín = admin, Facu = presidente, cualquier otro = miembro; contraseña `demo123`) o "Seguir mirando sin entrar" para visitante. En producción la web usa siempre Firebase.

## Verificación antes de commitear

```bash
npm test && npm run build
```
