# La Banda del cerrucho · Cena de fin de año

Web privada para organizar la comida anual con amigos: fecha, comida y lugar (propuestas con 👍/👎), bebidas y lista de compras, amigo invisible, nueve premios con ballotage, tareas, galería y archivo.

- **Web:** https://tingas-10.github.io/cerrucho-comida-anual-2026/
- **Hosting:** GitHub Pages (se publica solo con cada push a `main`).
- **Datos y login:** Firebase plan gratis (Auth por link de mail + Firestore). Sin Firebase, la web corre en **modo demostración** con datos ficticios y nada se guarda.
- **Fotos:** viven en el repo (`public/galeria/`), sin costo.

## Puesta en marcha (una sola vez)

### 1. Crear el proyecto de Firebase

1. Entrá a https://console.firebase.google.com con tu cuenta personal de Google y creá un proyecto nuevo (por ejemplo `cerrucho-cena`). Desactivá Google Analytics si te lo ofrece.
2. **Authentication → Comenzar → Email/Password → activá "Email link (sin contraseña)"** y guardá.
3. **Authentication → Settings → Authorized domains → Add domain:** `tingas-10.github.io`.
4. **Firestore Database → Crear base de datos → modo producción**, región `southamerica-east1` (San Pablo).
5. **Configuración del proyecto (engranaje) → Tus apps → Web (`</>`) → registrá la app** con cualquier apodo. Te muestra un bloque `firebaseConfig` con `apiKey`, `authDomain`, `projectId`, `appId`, etc. **Copialo entero y pegáselo a Claude en el chat.** Claude lo deja en `src/firebase/firebase.config.json` y lo publica.

### 2. Publicar las reglas de seguridad

Las reglas protegen los datos (votos, destinatarios, mails). Están en `firestore.rules`. Para publicarlas hay dos caminos:

- **Fácil (sin terminal):** en la consola de Firebase, **Firestore Database → Reglas**, borrá todo, pegá el contenido de `firestore.rules` y tocá **Publicar**.
- **Con terminal:** desde la carpeta del repo:

```bash
npx firebase-tools login
```

```bash
npx firebase-tools use --add
```

```bash
npx firebase-tools deploy --only firestore:rules
```

Cada vez que Claude cambie `firestore.rules`, hay que volver a publicarlas (Claude te avisa).

### 3. Activar GitHub Pages

En el repo de GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Listo: cada push a `main` corre los tests, construye la web y la publica.

### 4. Primer ingreso

Entrá a la web con `agustin@abndigital.com.ar`. Te llega un link al mail; al abrirlo, la app crea tu usuario de propietario, la edición 2026, las nueve categorías de premios, las tareas en borrador y los 23 alias del grupo como borradores sin mail. Desde **Administración → Miembros** cargás los mails (uno por uno o pegando una lista `alias, mail`). Nadie puede entrar hasta que tenga mail cargado.

No se mandan mails automáticos: el link de la web se comparte por el grupo de WhatsApp (hay un botón "Copiar invitación para WhatsApp").

## Cómo funciona el acceso

- Login **sin contraseña**: ingresás el mail, te llega un link (vence a la hora), lo abrís y entrás. Si abrís el link en otro dispositivo, te pide confirmar el mail.
- Sólo entran mails cargados por Agus como **miembros activos**. Cualquier otro mail ve "Ese mail no tiene invitación activa".
- El administrador es el dueño del mail fijado en `firestore.rules` y en `src/content/config.ts`.

## Checklist del organizador

1. Cargar mails de los miembros y marcar quién participa este año y quién fue al VAO (Administración → Miembros, botón **Confirmar padrón VAO**).
2. La consulta de fechas (jueves, viernes y sábados del 5/11 al 19/12) ya está abierta desde el primer ingreso; en Decisiones la cerrás cuando quieras.
3. Cerrar la consulta y **confirmar la fecha** (o fijarla desde Edición). Eso abre el RSVP.
4. Aprobar propuestas de comida y lugar, publicar las consultas y confirmar las decisiones. Cargar lugar, menú, agenda y salida en Edición.
5. Regalo: confirmar monto (consulta o a mano), **abrir inscripción**, cerrarla y **sortear**. El sorteo corre una sola vez en tu navegador; vos no ves el mapa salvo con acceso reservado (queda registrado).
6. Premios: abrir primera ronda (todas las categorías), cerrar (se cuentan y sellan sin mostrarse), abrir ballotage si hace falta, cerrar.
7. Bebidas: revisar lista de compras, stock, precios y responsables; cerrar con snapshot.
8. Tareas: publicar y asignar lo que falte.
9. La noche: desde Administración → Premios, tocá **Revelar** en cada categoría cuando la anuncies; recién ahí la banda lo ve en Premios.
10. Archivar la edición y crear la siguiente (Edición → Cierre).

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

`npm run build` hace typecheck y genera `dist/`. Sin `firebase.config.json` real, el dev server corre en modo demo (podés entrar como Agus o como cualquier miembro ficticio; el botón "Reiniciar demo" borra los datos locales).

## Limitaciones conocidas (decisiones por costo cero)

- **Sin servidor propio.** Firebase gratis no incluye Cloud Functions, así que el conteo de premios y el sorteo corren en el navegador del administrador al cerrar. El código no muestra los resultados, pero técnicamente pasan por su navegador. Las reglas de Firestore sí impiden que cualquier miembro lea boletas ajenas, resultados sellados o destinatarios ajenos.
- **Sin mails de aviso.** Sólo se manda el mail de acceso (Firebase). Novedades y recordatorios se comparten por WhatsApp con los botones "Copiar".
- **Sin subida de fotos desde la web.** Firebase Storage requiere plan pago. Las fotos se mandan por WhatsApp y Agus (o Claude) las agrega al repo.
- **Plazos.** No hay un reloj en servidor que cierre solo las votaciones: las reglas rechazan votos después de la hora de cierre, y el administrador las cierra con un botón.
- **Reautenticación reservada.** El acceso a información reservada pide motivo y queda auditado, pero no exige un segundo código por mail.
- **Cuota gratis.** 50.000 lecturas y 20.000 escrituras por día en Firestore. Alcanza de sobra para 25 personas; si alguien ajeno abusara, la web deja de responder hasta el día siguiente (sin costo).
