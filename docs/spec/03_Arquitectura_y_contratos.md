# Arquitectura y contratos de implementación

La Banda del cerrucho · Especificación técnica · Versión 1.0

Implementar las reglas del documento de producto en servidor y base de datos. La UI no es una barrera de permisos y el navegador no recibe datos reservados para después ocultarlos. Este documento fija la arquitectura, persistencia, transacciones, respuestas y controles de entrega. Es una especificación para escribir el código de producción; no es una base de datos ya desplegada.

## 1 Stack y organización

Frontend y BFF en Next.js App Router, React y TypeScript estricto; Tailwind para estilos; Lucide para iconos; Zod para validar entradas y DTO; React Hook Form para formularios; TanStack Query para estado remoto; Vitest para reglas; Playwright para recorridos y pgTAP para permisos y funciones de base de datos. Usar versiones estables con parches vigentes al iniciar el proyecto, fijar versiones en lockfile y evitar canary. No copiar el lockfile ni dependencias inferidas de ABN.

Supabase: PostgreSQL, Auth con OTP, Storage privado y Realtime. Vercel: hosting y rutas de servidor. Resend: SMTP de Supabase para acceso y API para comunicaciones transaccionales. Un worker Node separado, empaquetado en Docker y desplegado como servicio administrado, procesa archivos con Sharp y FFmpeg. Elegir Cloud Run para ese worker; la aplicación no necesita acceso a Google Drive. La cola persistente en PostgreSQL coordina trabajo, reintentos y deduplicación. El worker puede consultar cola mediante pooling de conexiones y atender tareas con límites de CPU y tiempo.

El proveedor de hosting no calcula ganadores en una función que escribe muchas filas desde el cliente. Los cierres, votos y sorteos son operaciones transaccionales mediante RPC de PostgreSQL. El sorteo genera una permutación en el BFF con crypto y la confirma con una RPC atómica. La base valida sus invariantes antes de guardarla.

Carpetas del repositorio: app para rutas; components para elementos compartidos y módulos; domain para reglas puras de premios, bebidas y gastos; server para acceso autorizado y DTO; supabase/migrations y supabase/tests; worker para multimedia y cola; tests/e2e; public para fuentes, iconos y recursos públicos genéricos. Las fotos privadas no se incluyen en public.

Ambientes local, staging y producción con Supabase y buckets separados. Los fixtures de prueba nunca entran a producción. El seed productivo es idempotente: crea edición y borradores si no existen, sin reabrir estados, borrar datos ni mandar correos. El directorio assets del paquete se importa a Storage después de preparar el proyecto; no forma parte de assets web públicos.

## 2 Variables de entorno y despliegue

| Variable | Uso | Exposición |
| --- | --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | URL del proyecto | Pública |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Cliente limitado por permisos | Pública |
| SUPABASE_SERVICE_ROLE_KEY | Gestión Auth y tareas de backend | Sólo servidor |
| DATABASE_URL | Conexión del worker y migraciones | Sólo servidor |
| RESEND_API_KEY | Notificaciones | Sólo servidor |
| EMAIL_FROM | Remitente con dominio verificado | Sólo servidor |
| APP_ORIGIN | Origen HTTPS oficial | Sólo servidor |
| OWNER_EMAIL | agustin@abndigital.com.ar para bootstrap | Sólo servidor |
| JOB_SECRET | Autorización de scheduler | Sólo servidor |
| WORKER_STORAGE_TOKEN | Credencial mínima para procesamiento | Sólo worker |

No entregar claves reales en documentación ni guardarlas en Git. El bootstrap crea al propietario mediante API Admin de Auth y vincula su UUID al miembro propietario. No conceder administración mediante comparación de string en el frontend. Deshabilitar signup libre; todos los usuarios de Auth se crean desde una ruta administrativa y se verifican por OTP.

Configurar dominio del remitente con SPF y DKIM, SMTP de producción y redirect allowlist exacta. La URL de producción puede ser la provista por Vercel; un dominio propio es opcional. No es necesario decidirlo para implementar. El código OTP vence en 600 segundos. Configurar el límite de intentos con el proveedor y una protección adicional en el BFF: reenvío de 60 segundos, 5 solicitudes por correo y hora, 30 por IP y hora, y 5 verificaciones fallidas por desafío antes de exigir uno nuevo. Respuestas genéricas para correos inexistentes.

El scheduler invoca cada minuto un endpoint de backend autorizado con JOB_SECRET. Ese endpoint reclama cierres y notificaciones vencidos. Votar valida plazo en base de datos aunque el scheduler no corra a tiempo. Las acciones de lectura pueden detectar módulos vencidos y pedir el cierre idempotente, sin revelar resultados privados. Registrar salud del scheduler y alertar si deja de ejecutar.

## 3 Modelo lógico de datos

Todos los identificadores son UUID; fechas operativas se guardan como timestamptz UTC y se muestran en Buenos Aires. Fechas candidatas sin hora usan date local más hora local explícita y timezone, nunca medianoche UTC asumida. Importes son bigint en centavos; porcentajes son integer; ml y gramos de cálculo usan numeric, no float binario. Las tablas editables tienen version integer, created_at, updated_at y campos de retirada cuando corresponda.

Las relaciones que incluyen edición y entidad usan claves compuestas o validación equivalente para impedir cruces entre ediciones. No aceptar un option_id de otra encuesta ni un member_id ajeno al snapshot. Los miembros se identifican por member_id estable, no por alias ni correo.

| Tabla | Campos esenciales además de id | Restricción principal |
| --- | --- | --- |
| members | auth_user_id, display_name, alias, status, is_owner | auth_user_id único; un propietario inicial |
| private.member_contacts | member_id, email_normalized, verified_at | Correo único, privado |
| editions | slug, year, title, status, timezone, currency, owner_id, rules_version | slug único; moneda ARS inicial |
| edition_members | edition_id, member_id, participating, vao_participant, access | Par único; participación separada de acceso |
| member_preferences | member_id, email_opt_in, avatar_media_id | Sólo campos de perfil |
| rsvps | edition_id, member_id, status, plan_version, arrival, afterparty | Par único; versión del plan vigente |
| private.dietary_profiles | edition_id, member_id, tags, note | Propio y administrador |
| polls | edition_id, kind, method, state, open_at, close_at, quorum, version | Tipo y método inmutables al abrir |
| poll_options | poll_id, label, payload, order, special_kind | Opciones pertenecen a una versión |
| poll_electorate | poll_id, member_id, snapshot_version | Par único y padrón congelado |
| poll_responses | poll_id, member_id, payload, submitted_at, revision | Una respuesta actual por elector |
| private.poll_response_revisions | response_id, revision, payload, actor | Historial reservado |
| poll_closures | poll_id, closure_version, response_count, closed_at | Un cierre por versión |
| decisions | edition_id, key, poll_id, chosen_option_id, status, reason, plan_version | Una decisión vigente por clave |
| proposals | edition_id, author_id, type, payload, state | Sólo autor mientras esté pendiente |
| beverage_profiles | edition_id, member_id, portions, no_alcohol, percentages, revision | Seis claves fijas y suma válida |
| beverage_recipes | edition_id, drink_key, ingredient_id, amount, unit | Receta completa por versión |
| inventory_items | edition_id, ingredient_id, stock, pack_size, pack_units, unit_price | Unidades y precios no negativos |
| purchase_snapshots | edition_id, version, inputs, outputs, published_at | Reproducible e inmutable |
| gift_campaigns | edition_id, state, amount_cents, tolerance, version | Presupuesto antes de sortear |
| gift_participants | campaign_id, member_id, accepted_version, delivery_delegate, state | Par único; correo verificado |
| private.gift_wishes | campaign_id, member_id, wishes, avoid | Dueño, su dador y propietario |
| private.gift_draw_versions | campaign_id, version, roster_hash, state, created_by | Una versión vigente |
| private.gift_assignments | draw_version_id, giver_id, receiver_id, viewed_at, ready_at, delivered_at, received_at | Dador y receptor únicos; dador distinto receptor |
| award_categories | edition_id, code, label, description, eligibility, order, state | Código único por edición |
| award_elections | category_id, version, rule_snapshot, state | Una elección vigente por categoría |
| award_rounds | election_id, number, open_at, close_at, state, candidate_snapshot | Número 1 o 2, único |
| award_electorate | election_id, member_id | Padrón de primera ronda reutilizado |
| private.award_ballots | round_id, voter_id, choice_key, revision, accepted_at | Una boleta por ronda y elector |
| private.award_results | election_id, round_id, counts, outcome, tied_keys, rules_hash | Sin acceso directo de miembros |
| award_progress | election_id, member_id, answered | Sólo estado de completitud, sin opción |
| ceremony_sessions | edition_id, state, current_category_id, stage, sequence | Una sesión vigente |
| ceremony_publications | session_id, category_id, stage, nominees, result, published_at, sequence | Sólo contenido autorizado a mostrar |
| tasks | edition_id, title, target_quantity, unit, due_at, status | Cantidad no negativa |
| task_commitments | task_id, member_id, quantity, status | Par único; cupo validado en transacción |
| private.expense_receipts | expense_id, media_id | Pagador y administrador |
| expenses | edition_id, payer_id, amount_cents, category, status, revision | Sin beneficiarios válidos no aprobado |
| expense_shares | expense_id, member_id, amount_cents | Suma igual al gasto |
| settlements | edition_id, from_id, to_id, amount_cents, state | Importe positivo y personas distintas |
| agenda_items | edition_id, kind, label, starts_at, draft_offset, owner_id | Hora real o borrador explícito |
| transport_offers | edition_id, member_id, leg, seats, origin_hint, starts_at | Asientos positivos |
| private.transport_assignments | offer_id, passenger_id | Cupo y tramo válidos |
| albums | edition_id nullable, title, access_scope | Acceso privado por edición o grupo |
| media_items | album_id, uploader_id, type, processing_state, caption, capture_at, featured, removed_at | Sin paths sensibles en DTO común |
| private.media_objects | media_id, variant, storage_path, mime, bytes, hash | Objeto único y ruta privada |
| media_reactions | media_id, member_id, reaction | Triple único |
| notifications | member_id, type, entity_id, state, read_at | Sólo destinatario |
| private.jobs | kind, payload, dedupe_key, due_at, attempts, lease_until, state | dedupe_key único |
| private.audit_logs | actor_id, action, entity_type, entity_id, entity_version, reason, at | Append only, privado |
| private.idempotency_keys | actor_id, route, key, request_hash, response, expires_at | Triple único |
| private.reauth_proofs | member_id, session_id_hash, verified_at, expires_at | Generado por verificación OTP del servidor |

Los campos payload de respuestas logísticas tienen esquemas Zod por tipo y restricciones equivalentes de DB o RPC. Fechas usa mapa de option_id a yes, maybe o no. Aprobación usa lista sin duplicados de option_id. Voto único usa exactamente un option_id. No confiar en JSON arbitrario como sustituto de validación.

Las boletas de premios usan choice_key string, member UUID o la constante NOBODY. No representar Nadie con null: null significa sin respuesta. outcome sólo puede ser WINNER, TIE, DESERTED o NO_VOTES; un estado RUNOFF_REQUIRED es transición de elección, no resultado final público. TIE conserva todas las claves empatadas, incluida NOBODY.

Índices obligatorios: todas las FK; edition_id con status; polls state y close_at; award_rounds state y close_at; jobs state y due_at; media_items album_id, created_at e id para cursor; idempotency actor, route y key; contactos email_normalized; tablas de boleta por ronda y elector. No indexar públicamente votos para buscarlos por persona.

## 4 Autorización y límites entre datos

Habilitar RLS y configurar grants explícitos en cada tabla del esquema público. anon no obtiene filas del evento. Las tablas private no se exponen por REST, GraphQL ni Realtime, y no tienen grants para anon o authenticated. Los miembros leen contenido compartido autorizado y respuestas propias mediante vistas DTO o funciones que no devuelven campos reservados.

Lecturas desde BFF usan sesión validada con getUser o mecanismo equivalente vigente del SDK, no confían sólo en un objeto de sesión local. Las mutaciones llaman RPC con JWT del usuario. Funciones SECURITY DEFINER fijan search_path a esquemas explícitos, no usan SQL dinámico recibido del cliente y verifican auth.uid, miembro activo, edición, rol, versión y estado. Revocar EXECUTE a PUBLIC y anon. Conceder sólo las funciones necesarias a authenticated.

Service role se reserva para crear identidades de Auth, scheduler y worker. Si una ruta administrativa necesita esa credencial, primero autentica y autoriza al actor y pasa únicamente parámetros validados a una operación transaccional. No escribir una ruta genérica que acepte tabla, columnas o member_id arbitrarios usando service role. Separar credenciales del worker si el proveedor permite permisos menores.

Resolver roles contra membresía del servidor en cada acción sensible. user_metadata, alias, header isAdmin, variable de React y dominio de correo no conceden permisos. Vincular correo sólo después de OTP válido para el UUID previamente creado. Revocar acceso impide la siguiente solicitud de datos y la renovación de URLs, aunque aún exista un JWT emitido. Los canales en vivo no contienen secretos y no sustituyen esa autorización.

El acceso reservado del propietario usa RPC separada y proof de reautenticación ligado a sesión y miembro. Un refresh JWT reciente no demuestra reautenticación: iat puede cambiar sin ingreso de código. La verificación OTP explícita crea el proof server-side. Auditar apertura de resultados, votos nominados, mapa del sorteo y exportaciones reservadas. Los logs ordinarios no almacenan las respuestas retornadas.

Los DTO públicos para miembros contienen sólo campos requeridos. Los DTO de premios antes de revelar no incluyen counts, winner, tied_keys o resultado cifrado que se pueda descargar. Cifrar y mandar todo al navegador no resuelve el control de acceso si también se envía la llave. La única excepción es la selección propia que el usuario está autorizado a revisar.

## 5 Máquina de estados y operaciones atómicas

Encuestas: DRAFT, OPEN, CLOSED y VOID. Una encuesta vencida rechaza votos aunque siga OPEN hasta que el job la cierre. Cerrar guarda snapshot de electores, opciones, respuestas y regla. Reabrir usa nueva versión; no borra un cierre.

Premios por categoría: DRAFT, ROUND1_OPEN, ROUND1_CLOSED, RUNOFF_READY, ROUND2_OPEN, SEALED, REVEALED o VOID. ROUND1_CLOSED se resuelve transaccionalmente hacia RUNOFF_READY o SEALED. Sólo SEALED puede pasar a REVEALED. Sin votos produce un resultado NO_VOTES sellado. El administrador puede reanudar categorías distintas en momentos distintos, pero cada categoría conserva su propia cadena de versiones.

Regalos: DRAFT, ENROLLMENT_OPEN, ENROLLMENT_CLOSED, DRAW_PUBLISHED, DELIVERY y ARCHIVED. Una versión de sorteo tiene ACTIVE o VOID. Crear versión nueva desactiva anterior en la misma transacción. Confirmar monto posterior a publicación requiere aceptar incidencia, nueva versión de campaña y reaceptación del presupuesto por los participantes; no cambia obligaciones en silencio.

Todas las escrituras de una respuesta y todos los cierres toman el mismo lock de fila de encuesta o ronda. Bajo ese lock verificar state, revision y clock_timestamp frente al close_at. La aceptación se determina en ese instante del servidor, no por hora del navegador ni por el momento en que salió el pedido. Si el cierre espera a un voto ya aceptado, lo cuenta después del commit; si el plazo venció antes de obtener el lock, rechaza el voto.

Use expectedRevision para respuestas y expectedVersion para administración. Dos pestañas que editan la misma respuesta provocan 409 en la segunda versión obsoleta; se ofrece recargar y revisar. No normalizar ni pisar silenciosamente. Para operaciones de cierre, sorteo, aprobación, compra y revelación exigir Idempotency-Key. La misma clave y mismo body devuelven la misma respuesta; misma clave y body distinto produce 409.

Auditoría, versión, datos derivados y jobs de notificación se escriben dentro de la transacción. Envíos y procesamiento ocurren después del commit. Si SMTP falla, la decisión queda confirmada y se reintenta el aviso; nunca se repite un sorteo como mecanismo de reenvío.

## 6 Algoritmo de premios

Se cuentan exclusivamente boletas aceptadas de la ronda vigente y electores del snapshot. Suspensión posterior no elimina boletas válidas. Revisión vigente sustituye anterior, no suma otro voto. La regla queda vinculada por hash a la elección.

Pseudocódigo normativo de primera ronda:

```text
counts = countLatestValidBallots(round1)
votedOptions = options where counts[option] > 0
if votedOptions is empty: final NO_VOTES
if votedOptions has one option: final winnerOrDeserted(option)
leaderVotes = maximum count
secondVotes = second element of counts sorted descending
if leaderVotes - secondVotes >= 3:
    final winnerOrDeserted(uniqueLeader)
else:
    finalists = votedOptions where leaderVotes - counts[option] < 3
    create private round2 candidates with those keys
    publish finalist keys only when admin opens round2
```

winnerOrDeserted devuelve DESERTED cuando la opción es NOBODY y WINNER para una persona. Si hay líderes empatados, secondVotes iguala leaderVotes y se abre ballotage. La lista ordenada usa todas las opciones votadas, incluido NOBODY; el orden de nombres nunca resuelve igualdad. Validar que las claves existan en candidate_snapshot, y que estén autorizadas para esa ronda.

Ballotage:

```text
counts = countLatestValidBallots(round2)
if sum(counts) == 0: final NO_VOTES
topVotes = maximum count
topKeys = all candidates with count == topVotes
if topKeys has more than one element: final TIE(topKeys)
else: final winnerOrDeserted(topKeys[0])
```

Al cerrar primera ronda de nueve categorías, cada una calcula su resolución en una transacción consistente; un fallo no puede dejar categorías duplicadas en el mismo round. Puede usarse un cierre por categoría con idempotencia y un job de orquestación que señale progreso; la UI no dice cierre completo hasta que todas terminaron. No requiere transacción global larga que incluya email.

Al revelar, bloquear resultado y sesión de ceremonia, verificar que el propietario tiene permiso y que la elección está SEALED. Insertar una publicación con snapshot de resultado, actualizar categoría a REVEALED, incrementar sequence y generar evento seguro. Repetir la acción devuelve la publicación existente. Un cliente desconectado pide snapshot vigente y últimas publicaciones; no depende de haber recibido todos los eventos.

## 7 Algoritmo de amigo invisible

Obtener snapshot de participantes inscritos y verificados. Si menos de tres, rechazar con GIFT_MIN_PARTICIPANTS. Usar Fisher Yates con crypto.randomInt para crear una permutación uniforme de receptores. Rechazar la permutación completa si cualquier giver coincide con receiver y repetir con nueva aleatoriedad. Con sólo restricción de autoasignación, el rechazo produce un sorteo uniforme sobre permutaciones válidas. Máximo operativo de 10000 intentos; si se agota, devolver error técnico y no publicar una asignación parcial.

No usar Math.random, sort con comparador aleatorio, semilla pública, fechas, UUID ordenados ni código del navegador para asignar. No guardar semilla ni exponer el vector de receptores en logs. El administrador envía a RPC un batch completo ligado al roster_hash y a la versión esperada de campaña. La DB verifica conjuntos idénticos de dadores y receptores, cardinalidad, unicidad, ausencia de autoasignación y padrón vigente. Si hubo alta o baja simultánea, rechazar todo con 409.

El roster_hash se calcula sobre IDs ordenados, versión de presupuesto y aceptación, no sobre nombres. Para tamaño 23 no hace falta un servicio externo. Conservar la asignación en private y ofrecer my-assignment que une por giver_id igual al miembro autenticado. La consulta para wishes valida esa relación. Descargar historial como miembro nunca entrega el mapa reservado.

El estado recibido pertenece al receptor, entregado al dador y regalo listo al dador. Para retiradas y reasignaciones excepcionales validar batch completo con las mismas restricciones y actualizar estados por versión. Un registro visto de una asignación anterior no significa que vio la nueva.

## 8 Algoritmo de bebidas

En perfiles de consumo positivo, six percentages suma exactamente 100, cada valor entre 0 y 100 y portions entre 1 y 20. En no_alcohol, portions y percentages son cero. El API no acepta propiedades de bebida adicionales. El miembro sólo edita su perfil.

Para cada asistente con RSVP Voy de la plan_version vigente y respuesta completa: servings para bebida igual a portions por porcentaje dividido 100. Para cada ingrediente de receta, sumar servings por cantidad de ingrediente. Demanda protegida igual a esa suma por 1.10. Pendiente igual a máximo entre cero y demanda protegida menos stock en la misma unidad. Packs igual al techo de pendiente dividido contenido total del pack. No redondear por persona ni por bebida antes de sumar ingredientes compartidos.

Ejemplo técnico de cerveza: cuatro servings generan 1892 ml; con reserva, 2081.2 ml. Una lata de 473 ml produce ceil de 4.4, cinco latas. Si sólo se compran packs de seis, ceil de 4.4 dividido 6, un pack, equivalente a seis latas. El UI muestra ambos número de packs y unidades, no seis packs.

El reparto grupal por porcentaje usa suma de servings de cada bebida dividido suma de servings de las seis opciones. No promediar porcentajes de un bebedor de una porción y otro de diez si se va a usar ese promedio para comprar. Cero alcohol en todas las respuestas produce gráfico sin consumo y agua e hielo según asistentes; no dividir por cero.

Los inputs del snapshot incluyen plan_version, RSVP ids y revisiones, profiles, recipe_version, package_version, reserve y stock. Cambiar uno marca el snapshot Desactualizado. Una compra confirmada se liga a snapshot_id, registra unidades reales y sólo modifica stock al entrar físicamente; no descuenta dos veces por calcular y por aprobar gasto.

## 9 Algoritmo de gastos

Por gasto equitativo de A centavos y n beneficiarios, base igual a división entera A por n. Resto igual a A menos base por n. Asignar un centavo adicional a los primeros resto beneficiarios ordenados por UUID. Para devoluciones negativas, repartir valor absoluto y aplicar signo al resultado. Rechazar n igual a cero y lista con duplicados.

Saldo por persona igual a gastos que pagó menos costo que le corresponde, más transferencias que hizo menos transferencias que recibió. Se incluyen sólo gastos aprobados y transferencias confirmadas. La suma de saldos debe ser cero. Ejemplo ARS 1000 entre tres: 333.34, 333.33 y 333.33.

Para sugerencias, ordenar deudores y acreedores por saldo absoluto descendente y UUID como segundo criterio; emparejar hasta cubrir importes con min de deuda y crédito. Es reproducible y válido, sin exigir optimización combinatoria. Aprobación o corrección actualiza una versión del libro; el UI vuelve a pedir saldos.

## 10 Contrato HTTP

API bajo /api/v1. Usar DTO Zod compartidos entre BFF y frontend. Sólo queries listadas pueden ordenar o filtrar; paginación con cursor firmado u opaco y máximo 100 para administración, 24 para galería. Respuesta común: data, meta con version y serverTime, error nullable. No devolver errores de SQL ni estado de auth interno.

| Método y recurso | Request esencial | Regla y salida |
| --- | --- | --- |
| POST /auth/request-code | email | Respuesta genérica, sólo identidades invitadas |
| POST /auth/verify-code | email, code, challengeId | Sesión y member DTO si acceso válido |
| POST /auth/logout | vacío | Cierra sesión actual y proof reservado |
| POST /auth/reauth | desafío y OTP | Proof reservado de 10 minutos |
| GET /me | vacío | Perfil, rol validado y acceso a ediciones |
| PATCH /me | alias, avatarMediaId, expectedRevision | Sólo campos propios permitidos |
| GET /editions/{id}/dashboard | vacío | Decisiones, pendientes y progreso seguro |
| POST /admin/members | alias, nombre, email opcional | Crea borrador o identidad, sin enviar |
| POST /admin/members/{id}/invite | expectedVersion | Encola invitación idempotente |
| PATCH /admin/members/{id} | campos permitidos, expectedVersion | Verifica protección del propietario |
| POST /admin/members/import | filas CSV parseadas | Preview y confirmación separados |
| GET /editions/{id}/polls/{pollId} | vacío | Opciones, respuesta propia y agregados permitidos |
| PUT /polls/{id}/my-response | choice o choices o availability, expectedRevision | Verifica snapshot y plazo |
| POST /admin/polls/{id}/open | times, expectedVersion | Congela opciones y electores |
| POST /admin/polls/{id}/close | expectedVersion, reason opcional | Cierre atómico, sin ganador de premio en DTO |
| POST /admin/decisions/{key}/confirm | editionId, optionId, reason, expectedVersion | Decisión oficial |
| PUT /editions/{id}/my-rsvp | status, planVersion, expectedRevision | Confirmación de fecha vigente |
| POST /editions/{id}/proposals | type, payload | Propuesta pendiente del actor |
| PUT /editions/{id}/my-beverages | portions, noAlcohol, percentages, expectedRevision | Perfil válido propio |
| GET /editions/{id}/beverage-summary | vacío | Agregado y cobertura, sin intensidad nominada |
| POST /admin/beverages/{id}/snapshot | expectedVersion | Inputs y compras reproducibles |
| PUT /gifts/{id}/my-enrollment | acceptedBudgetVersion, delegate | Inscripción personal |
| PUT /gifts/{id}/my-wishes | wishes, avoid | Lista propia |
| POST /admin/gifts/{id}/draw | expectedVersion, rosterHash | Publicación completa, resumen sin mapa |
| GET /gifts/{id}/my-assignment | vacío | Sólo receptor del actor y lista autorizada |
| PATCH /gifts/{id}/my-status | viewed o ready o delivered o received, version | Estado del rol correspondiente |
| PUT /awards/{roundId}/my-ballot | choiceKey, expectedRevision | Boleta propia válida |
| GET /editions/{id}/my-award-progress | vacío | Selecciones propias y reglas |
| POST /admin/awards/{id}/open-runoff | times, expectedVersion | Publica candidatos de segunda ronda |
| GET /ceremonies/{id}/snapshot | lastSequence opcional | Sólo publicaciones autorizadas |
| POST /admin/ceremonies/{id}/stage | categoryId, stage, expectedVersion | Muestra sólo escenario autorizado |
| POST /admin/awards/{id}/reveal | ceremonyId, expectedVersion | Publicación única del resultado |
| POST /admin/reserved/read | entityType, entityId, reason | Reauth y auditoría; DTO reservado |
| POST /tasks/{id}/my-commitment | quantity, expectedRevision | Cupo atómico propio |
| PATCH /tasks/{id}/my-commitment | status, expectedRevision | Estado propio |
| POST /editions/{id}/expenses | concept, amountCents, category, receiptId | Pagador igual al actor |
| POST /admin/expenses/{id}/approve | beneficiaryIds o shares, expectedVersion | Asigna centavos y aprueba |
| GET /editions/{id}/ledger | vacío | Gastos compartidos seguros y saldo |
| POST /editions/{id}/settlements | toMemberId, amountCents | Propuesta del pagador |
| POST /media/upload-intent | albumId, mime, bytes, sha256 | Autoriza objeto privado pendiente |
| POST /media/{id}/complete-upload | uploadId | Verifica objeto y encola procesamiento |
| GET /albums/{id}/media | cursor, type | Metadata segura paginada |
| POST /media/{id}/access-url | variant | URL temporal después de autorización |
| PATCH /media/{id} | caption, featuredConsent, expectedRevision | Propio o admin |
| DELETE /media/{id} | expectedVersion | Retirada recuperable |
| POST /admin/media/{id}/restore | expectedVersion | Restaura antes de purga |
| GET /notifications | cursor | Sólo destinatario |
| POST /admin/editions/{id}/archive | expectedVersion, pendingNotes | No revela premios ni sorteo |
| POST /jobs/tick | autorización de scheduler | Reclama jobs sin sesión de miembro |

El desarrollador puede dividir un recurso en subrutas para mantener código, pero no alterar permisos ni semántica. Documentar todas las rutas adicionales en OpenAPI y mantener ejemplos contractuales. El paquete no necesita definir por adelantado cada endpoint CRUD trivial; debe haber CRUD completo del administrador para las entidades configurables del producto.

Errores comunes: 400 VALIDATION_ERROR con fields; 401 SESSION_REQUIRED; 403 ACCESS_DENIED; 404 NOT_FOUND para entidades ajenas cuya existencia no se desea divulgar; 409 REVISION_CONFLICT o STATE_CONFLICT; 422 INVARIANT_VIOLATION; 423 POLL_CLOSED; 429 RATE_LIMITED con retryAfter; 503 SERVICE_UNAVAILABLE. No interpretar un error como una lista vacía. Una categoría sin votos es una respuesta válida con outcome, no 404.

Ejemplo de voto guardado: request choiceKey igual al UUID permitido y expectedRevision 2; response data con roundId, choiceKey propio, revision 3 y saved true. Nunca añadir candidateCounts a esta respuesta. La confirmación toast aparece sólo al recibir saved true; con error, la elección permanece marcada como Sin guardar.

## 11 Realtime y reconexión

Usar canales privados autorizados por membresía o por sesión de ceremonia. Mensajes contienen eventType, entityId, version y sequence, no boletas ni datos de identidad reservados. Al recibir un cambio, el cliente invalida la query correspondiente y vuelve a pedir un DTO autorizado. Para ceremonia, se puede emitir el resultado ya publicado; nunca un resultado sellado.

No habilitar replicación de tablas private ni emitir payload completo de un UPDATE sensible. award_progress sólo permite al administrador consultar progreso agregado y al propio miembro revisar su estado. No dar acceso del grupo a filas de progreso por categoría que permitan reconstruir participación individual.

Si cae Realtime, usar polling cada 15 segundos mientras la pestaña esté visible; ceremonia cada 3 segundos. Mostrar Reconectando y última actualización. Al recuperar conexión, releer snapshot, comprobar sequence y continuar desde estado persistido. El usuario puede seguir mirando datos descargados marcados como desactualizados, pero no confirmar decisiones ni mostrar votos como guardados sin respuesta del servidor.

No guardar un voto de premio en una cola offline que pueda enviarse después de vencer. Permitir borrador de formulario sólo en memoria de la pestaña. El service worker de una PWA opcional sólo cachea fuentes, iconos y shell genérico; no cachea respuestas privadas, códigos, destinatarios, fotografías ni resultados sellados.

## 12 Archivos y procesamiento

Buckets privados media-originals, media-derived y receipts. Object keys con UUID y variante, nunca correo o nombre de persona. Upload-intent valida rol, album, MIME declarado, cantidad, cuota y tamaño. La URL de subida permite sólo el object key autorizado y vence en 10 minutos. Al completar, inspeccionar bytes, magic signature, tamaño real y checksum; extensión no alcanza.

Usar upload resumible para videos y lotes. Reservar cuota al generar intent y liberarla si caduca o falla. Para uploads concurrentes, cuota y reservas se modifican con lock; no permitir que dos lotes salten el límite. Complete-upload es idempotente. Objetos incompletos se limpian después de 24 horas.

Worker: reclamar job con FOR UPDATE SKIP LOCKED y lease, leer objeto privado, validar de nuevo, convertir y escribir derivados. Sharp con soporte HEIC/libheif en la imagen Docker; probar ese soporte en build. FFmpeg normaliza rotación y genera MP4 H264/AAC con faststart, máximo 1080p, más póster JPEG. Originales quedan privados. Límites de tiempo y memoria impiden que un video inválido bloquee la cola. Tres reintentos con backoff; después Error, con opción de reintento administrativo.

Derivados de imágenes: anchos 320, 640 y 1280, sin ampliar más que el original; conservar proporción y quitar EXIF/GPS. Conservar orientación visual. La fecha de captura puede almacenarse si existe sin inventar año del evento. El hero usa thumb de 1280, srcset y focal point elegidos por Agus. En el seed no hay focal points atribuidos a personas.

GET access-url valida que archivo esté listo y visible, actor tenga acceso al álbum y variante autorizada. URLs de lectura vencen en 300 segundos. Comprobantes exigen pagador o administrador. Los logs redactan query de firmas. Restauración antes de 30 días cambia visibilidad; purga posterior elimina bytes y conserva metadata de auditoría. Las cuotas se ajustan sólo después del borrado físico.

## 13 Seguridad del frontend y operación

Marcar módulos de servidor con server-only. Usar salida escapada y no permitir HTML en captions, descripciones o propuestas. Validar links http o https sin protocolos javascript, data ni file. No fetch automático de URLs propuestas, para no introducir SSRF. Enlaces externos con protección de opener. Imágenes originales privadas no se usan como URL pública de Open Graph.

Cookies de sesión seguras según mecanismo SSR del proveedor, Secure y política SameSite compatible, y sin secretos en localStorage. Validar Origin y protección CSRF para rutas mutantes basadas en cookies. Header no-store para datos de sesión, panel privado, votos y acceso reservado. No compartir caché SSR por usuario. Open Graph sólo contiene marca y descripción genéricas.

Sin indexación de datos privados; robots noindex no sustituye autenticación. CSP consistente con assets propios, proveedor de datos y reproductor. Desactivar analytics que registren contenido de formularios. Logs contienen traceId, actor opaco, operación, resultado y duración; no OTP, boletas, destinatarios, comprobantes, firmas ni service keys.

Backups diarios de DB con retención mínima de siete días mediante el plan o exportación programada; respaldo independiente de originales y derivados al menos semanal y antes de la ceremonia. No asumir que backup de PostgreSQL incluye Storage. Ensayar restauración de staging antes de entregar. Preservar IDs y estados revelados durante restauración; una DB antigua debe revisar publicaciones para no anunciar otro ganador. Exportación administrativa previa a evento incluye configuración y resultados en contenedor reservado, nunca en un enlace público.

Objetivos de desempeño: panel interactivo con LCP inferior a 2.5 segundos en conexión móvil razonable, CLS inferior a 0.1, respuestas de voto p95 inferiores a 1 segundo sin contar redes extremas y actualización de ceremonia inferior a 2 segundos con Realtime activo. Medir en staging con 30 usuarios y 60 solicitudes concurrentes; estos valores son criterios de entrega, no SLA comercial de proveedores.

## 14 Desarrollo y puesta en marcha

Orden de trabajo: identidad, miembros y permisos; carcasa y seed; fecha y encuestas; asistencia, comida, tareas; bebidas y gastos; amigo invisible; premios y privacidad; ceremonia; multimedia; notificaciones y archivo; pruebas de permisos y carga; puesta en marcha. Cada etapa deja rutas reales y datos persistidos. No iniciar galería pública para simplificar demostraciones.

El desarrollador entrega repositorio completo, README reproducible, env.example sin valores secretos, migraciones, seeds, OpenAPI, worker Docker, instrucciones de deploy, pruebas y registro de resultados. Dejar una versión staging con cuentas ficticias para ensayar los nueve premios, sin enviar a personas reales. La entrega productiva incorpora propietario y recuerdos, pero ninguna encuesta abierta, correo enviado, fecha confirmada o sorteo real por defecto.

La primera configuración de Agus debe permitir vincular alias y cargar correos, marcar padrón VAO, proponer fechas y publicar consultas desde el panel. Es ingreso de datos del evento, no una dependencia pendiente que el desarrollador deba resolver preguntando reglas. Si faltan credenciales de proveedores para producción, desarrollar y verificar con ambiente local y staging; documentar cuáles accesos concretos requiere el deploy sin inventar claves.

## 15 Fuentes técnicas verificadas

Se consultó documentación oficial para comprobar las capacidades elegidas. Los límites de producto de este paquete son decisiones de implementación, no límites comerciales supuestos de los proveedores.

Supabase Auth permite códigos temporales y enlaces sin contraseña; shouldCreateUser false evita altas automáticas en el flujo cliente. El template usa Token para OTP y la expiración se configura. Referencia: https://supabase.com/docs/guides/auth/auth-email-passwordless

RLS y grants se deben revisar juntos; service role puede saltarse RLS y debe quedar en servidor. Las vistas requieren atención para no ampliar lecturas. Referencia: https://supabase.com/docs/guides/database/postgres/row-level-security

Storage distingue acceso privado y entrega autorizada; utilizar URLs temporales para lectura y subida conforme al SDK vigente. Referencia: https://supabase.com/docs/guides/storage/serving/downloads

Next.js recomienda separar autenticación, sesión y autorización, y verificar acceso cerca de los datos y en acciones de servidor. Referencia: https://nextjs.org/docs/app/guides/authentication

Referencia visual y funcional observada: https://abn-olympics.web.app/
