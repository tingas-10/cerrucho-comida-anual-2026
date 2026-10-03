# La Banda del cerrucho

La web permanente de la banda: portada, **Comida anual** (fecha con calendario, lugar y comida con 👍/👎, bebidas, amigo invisible, premios, agenda y tareas), **FMO** (fútbol de la banda) y **Cumpleaños**. Pensada para usarse desde el celular.

- **Web:** https://tingas-10.github.io/cerrucho-comida-anual-2026/
- **Hosting:** GitHub Pages (se publica solo con cada push a `main`).
- **Datos y acceso:** Firebase plan gratis (Auth + Firestore). Sin Firebase, la web corre en **modo demostración** con datos ficticios y nada se guarda.
- **Fotos de la galería:** viven en el repo (`public/galeria/`). Las fotos de perfil se guardan chiquitas (160 px) dentro de Firestore, sin costo.

## Quién ve y hace qué

| Rol | Quién | Puede |
| --- | --- | --- |
| Visitante | Cualquiera con el link, sin entrar | Mirar portada, comida anual (fecha, lugar, comida, regalo, premios sin resultados), FMO y cumpleaños. No vota ni edita. |
| Miembro | Cada integrante, con usuario y contraseña | Responder fechas, votar 👍/👎, proponer lugar o comida, cargar bebidas, ver a quién le regala, votar premios dentro del período, editar su perfil. |
| Presidente | Facu Caputo (se cambia en Administración → Miembros) | Lo mismo que un miembro, más **confirmar fecha, lugar y comida** como definitivos. |
| Administrador | Agus | Todo: usuarios y contraseñas, fechas candidatas, sorteo del amigo invisible, períodos de votación. **Sólo Agus ve los resultados de los premios.** |

Las reglas de `firestore.rules` hacen cumplir esto en el servidor, no sólo en pantalla.

## Cómo funciona el acceso

- **Usuario y contraseña, sin mail.** Agus crea los usuarios desde **Administración → Miembros** ("Crear los N usuarios" o uno por uno) y la web le muestra un texto listo para pasar por WhatsApp.
- Por dentro, Firebase necesita un mail: la web usa uno interno inventado (`usuario.xxxxxx@miembros.cerrucho.invalid`) que nadie ve ni recibe.
- **Resetear contraseña:** Agus toca "Resetear contraseña" y la web genera una nueva. Nadie ve la contraseña vieja (por dentro se crea una cuenta de acceso nueva y la vieja queda desconectada).
- Cada miembro puede cambiar su contraseña desde **Mi perfil**.
- En el primer ingreso se pide el cumpleaños (día y mes los ve la banda; el año queda privado) y, opcionalmente, foto y contraseña propia.

## Datos que se conservan entre años

Miembros, cumpleaños, gustos, fotos, FMO y archivo de ediciones viven fuera de la edición. Cada comida anual es una edición nueva (`EDICION_ACTUAL` en `src/content/config.ts`).

## Checklist del organizador

1. **Crear tu propio usuario primero** (Administración → Miembros → tarjeta Agustín → Crear usuario), cerrar sesión y entrar con él.
2. "Crear los N usuarios" y pasar la lista por WhatsApp.
3. Fechas: la banda marca Puedo / No puedo / Capaz en el calendario; el presidente confirma la fecha.
4. Lugar y comida: la banda propone y vota con 👍/👎; el presidente confirma.
5. Amigo invisible: fijar monto y tocar **Sortear** (entra toda la banda). Cada uno ve sólo a quién le regala.
6. Premios: programar el período de votación (abre y cierra solo). Al cierre, **Contar votos**: el resultado lo ves sólo vos.
7. Archivar la edición y crear la siguiente (Edición → Cierre).

## Reglas de seguridad

Están en `firestore.rules`. Se prueban con el probador oficial de Firebase (36 casos por rol) y se publican con el Firebase CLI logueado con la cuenta dueña del proyecto:

```bash
npx firebase-tools deploy --only firestore:rules --project cerrucho-comida-anual-2026
```

## Desarrollo

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

`npm run build` hace typecheck y genera `dist/`. Con `VITE_DEMO=1` el dev server corre en modo demo: botones de entrada rápida para cada rol (contraseña demo `demo123`).

## Limitaciones conocidas (decisiones por costo cero)

- **Sin servidor propio.** Firebase gratis no incluye Cloud Functions, así que el conteo de premios y el sorteo corren en el navegador del administrador. Las reglas impiden que cualquier otro lea boletas ajenas, resultados sellados o destinatarios ajenos.
- **Sin mails ni avisos automáticos.** Todo se comparte por WhatsApp con los botones "Copiar".
- **Sin subida de fotos a la galería desde la web.** Firebase Storage requiere plan pago. Las fotos se mandan por WhatsApp y Agus (o Claude) las agrega al repo.
- **Cuota gratis.** 50.000 lecturas y 20.000 escrituras por día en Firestore. Alcanza de sobra para la banda.
