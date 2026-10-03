# Pruebas de aceptación y entrega

La Banda del cerrucho · Criterios para aprobar el desarrollo

La entrega se acepta cuando los recorridos funcionan con datos persistidos, los permisos se comprueban también fuera de la interfaz y la sorpresa de los premios se conserva hasta la ceremonia. Los casos de este documento deben convertirse en pruebas del proyecto. La documentación actual no afirma que exista una aplicación ya construida o que sus pruebas end to end hayan pasado.

## 1 Recorridos completos obligatorios

**Organización desde cero.** Agus entra por OTP, vincula los borradores correctos, carga correos, publica fechas, recibe respuestas, confirma una fecha y obtiene RSVP nuevos. Se decide lugar y comida, se publican agenda y tareas, se cierran bebidas y se obtiene lista de compras. Antes de confirmar no aparece ningún dato como definitivo.

**Participación desde WhatsApp.** Un miembro abre un enlace en iPhone o Android, entra con su correo, vuelve a la pantalla pedida, completa disponibilidad y después RSVP, propone comida, declara bebidas, se ofrece para llevar hielo y carga una foto. Puede salir y volver sin perder participaciones ya guardadas.

**Regalo completo.** Participantes aceptan el monto, se cierra el padrón, se sortea una sola vez y cada uno ve sólo su destinatario. Una sesión distinta intenta consultar el destinatario de otro y no puede. Reenvío de correo no repite el sorteo. Los estados listo, entregado y recibido pertenecen a sus actores correctos.

**Premios completos.** Se abren nueve categorías con padrón congelado, se completan boletas, se cierra la primera ronda y se generan únicamente los ballotages necesarios. Usuarios que no participaron en primera ronda pueden hacerlo en segunda si eran electores. Se cierran, sellan y muestran resultados sólo cuando Agus revela la categoría correspondiente.

**Ceremonia con desconexión.** Un proyector con cuenta de miembro ve un sobre cerrado mientras Agus controla otra pantalla. Pierde conexión, Agus revela y el proyector reconecta. Recupera la publicación vigente sin hacer revelar otra vez y sin descargar resultados futuros.

**Cuenta final.** Dos miembros proponen gastos, Agus asigna grupos y aprueba. Una persona que no toma no comparte alcohol. Se registran transferencias y los saldos cierran en cero. Corregir un importe deja revisión, no borra rastros.

**Edición siguiente.** Archivar conserva premios revelados y álbumes privados. Crear 2027 copia plantillas y miembros autorizados, pero no reproduce votos, ganadores, destinatarios, RSVP ni fecha de 2026.

## 2 Matriz de aceptación

| ID | Caso | Resultado exigido |
| --- | --- | --- |
| A01 | Visitante abre URL interna | Acceso; sin nombres, fotos ni dirección |
| A02 | Correo no invitado pide OTP | Respuesta genérica y sin acceso |
| A03 | Miembro invitado usa OTP correcto | Acceso al miembro exacto y retorno a ruta |
| A04 | Código vencido, repetido o incorrecto | Rechazo sin sesión nueva |
| A05 | Reenvío antes de 60 segundos | Rate limit y tiempo restante |
| A06 | Usuario altera metadata o header de rol | No obtiene administración |
| A07 | Miembro suspendido conserva JWT viejo | No obtiene nuevos datos ni URLs |
| A08 | Intento de suspender propietario | Rechazado |
| A09 | Dos personas con alias igual | IDs distintos; no mezcla de votos |
| A10 | Cambio de mail sin verificar | Bloqueado hasta verificación nueva |
| F01 | Disponible para varias fechas | Cuenta Puedo una vez en cada fecha |
| F02 | No responde disponibilidad | Pendiente, no No puedo |
| F03 | Empate de Puedo | Desempata Capaz; después decisión explícita |
| F04 | No se alcanza quórum logístico | Baja participación; sin confirmar automático |
| F05 | Confirmar fecha | Exige RSVP separado |
| F06 | Cambiar fecha confirmada | RSVP anterior necesita reconfirmar |
| F07 | Agregar opción con encuesta abierta | Nueva versión, no mezcla silenciosa |
| V01 | Dos tabs guardan misma revisión | Una guarda y otra obtiene 409 |
| V02 | Voto llega después del plazo | Rechazo aunque job aún no cerró |
| V03 | Cierre y voto compiten | Resultado único según lock y hora del servidor |
| V04 | Repite Idempotency Key y body | Misma operación y respuesta |
| V05 | Repite key con body distinto | 409, sin nueva escritura |
| V06 | Member id u opción de otra edición | Rechazo en API y DB |
| B01 | Porcentajes 99, 101 o negativos | No guarda; indica corrección |
| B02 | No tomo alcohol | Cero porciones y seis ceros; respuesta completa |
| B03 | Una persona toma una porción y otra diez | Gráfico y compras ponderados por porciones |
| B04 | Todos no toman | Sin división por cero; agua e hielo calculados |
| B05 | Stock superior a necesidad | Cero compra, nunca cantidad negativa |
| B06 | Dos recetas comparten ingrediente | Suma antes de redondear envases |
| B07 | Compra por pack de cerveza | Muestra packs y latas correctamente |
| B08 | Faltan precios | Total parcial identificado, no cero completo |
| B09 | Cambia RSVP después de snapshot | Marca desactualización y delta |
| G01 | Sorteo con 2 participantes | Bloqueado; mínimo 3 |
| G02 | Sorteo con 3 o 23 participantes | Una entrada y salida por persona, sin sí mismo |
| G03 | Dos requests simultáneos de sorteo | Una versión publicada |
| G04 | Alta simultánea cambia roster hash | Rechaza batch completo |
| G05 | Miembro solicita assignment ajeno | No obtiene receptor ni deseos |
| G06 | Correo de regalo o logs | Sin destinatario ni semilla |
| G07 | RSVP No voy posterior al sorteo | No altera automáticamente la asignación |
| G08 | Reasignación extraordinaria | Nueva versión válida y aviso a afectados |
| P01 | Boleta incompleta | Categorías guardadas cuentan; otras pendientes |
| P02 | Se vota a sí mismo | Permitido conforme a regla publicada |
| P03 | A 10, B 7 | Ganador directo A |
| P04 | A 10, B 8 | Ballotage A y B |
| P05 | A 8, B 7, C 6 | Ballotage de tres |
| P06 | A 8, B 7, C 6, D 6 | Incluye a los cuatro, sin corte arbitrario |
| P07 | Nadie 8, A 7 | Incluye Nadie y A |
| P08 | Nadie único ganador | DESIERTO |
| P09 | Primera ronda sin votos | SIN VOTOS |
| P10 | Sólo A recibe un voto | A directo; informa baja participación al revelar |
| P11 | Ballotage A 10, B 9 | A gana aunque margen sea 1 |
| P12 | Ballotage A 9, B 9 | EMPATE sin tercera ronda |
| P13 | Ballotage A, B y C empatados | EMPATE entre los tres |
| P14 | Ballotage Nadie 7, A 7 | EMPATE, no desierto automático |
| P15 | Ballotage sin votos | SIN VOTOS, no recupera primera ronda |
| P16 | Alta de miembro tras apertura | No agrega elector sin nueva versión |
| P17 | Suspensión posterior a voto | Conserva voto aceptado, impide nuevos |
| P18 | Cambiar candidato tras apertura | Anular categoría afectada y versión nueva |
| P19 | Inspect network antes de revelar | Sin counts ni ganadores ajenos |
| P20 | Acceso reservado de Agus | Reauth, motivo, log y respuesta explícita |
| C01 | Miembro invoca reveal directamente | 403 |
| C02 | Revelar resultado no sellado | Rechazo de estado |
| C03 | Repite reveal o recarga proyección | Misma publicación y resultado |
| C04 | Archiva antes de revelar una categoría | No publica su resultado |
| C05 | Navega siguiente sin revelar | No publica ganador de esa categoría |
| T01 | Dos usuarios toman cupo único | Sólo uno obtiene compromiso |
| T02 | Usuario intenta asignar a otro | Rechazo |
| E01 | ARS 1000 entre tres | 333.34, 333.33, 333.33; suma exacta |
| E02 | RSVP cambia después de gasto | No cambia beneficiarios congelados |
| E03 | Propone gasto de otro pagador | Rechazo salvo ruta admin explícita |
| E04 | Transferencias confirmadas | Saldo actualizado y suma total cero |
| M01 | Miembro carga HEIC y MOV | Se procesan a formatos reproducibles |
| M02 | MIME declarado falso o archivo grande | Rechazo y liberación de reserva |
| M03 | Dos uploads exceden cuota en conjunto | No saltean límite por concurrencia |
| M04 | Fallo de worker y reintento | Sin duplicar objeto ni job completado |
| M05 | Archivo retirado o usuario ajeno | No emite nuevas URLs |
| M06 | URL privada expira | No queda un enlace permanente usable |
| M07 | Restaura antes de 30 días | Recupera elemento y referencias |
| N01 | Recuerdo de votación ya completada | No envía recordatorio pendiente |
| N02 | SMTP falla después de decidir | Reintenta aviso, no vuelve a decidir |
| N03 | Repite job de notificación | Un envío lógico; deduplicación |
| H01 | Crear nueva edición | Sin votos ni destinatarios heredados |
| H02 | Seed corre dos veces | No duplica ni sobreescribe datos vivos |
| H03 | Archivo importado histórico | Etiqueta Procedencia manual |

## 3 Pruebas de permisos y secreto

Crear cuentas ficticias de propietario, miembro A, miembro B, invitado sin verificar, miembro suspendido y miembro de otra edición. Probar API, RPC, REST de Supabase, Storage y suscripciones con cada identidad. No alcanza probar que el botón de administración no aparece.

Con miembros A y B comprobar que A no obtiene boleta, destinatario, wishes no autorizados, perfil alimentario ni recibo privado de B. Probar manipulación de IDs y cambios de edition_id, option_id y round_id. Consultas SQL de cliente no deben acceder al esquema private. Grants y RLS deben estar cubiertos por pgTAP en staging.

Capturar HTML SSR, payloads de Server Components, JSON de queries, errores y mensajes Realtime antes de revelar. Ninguno puede contener datos futuros de ganadores o recuentos. También revisar prefetch de rutas, exportaciones, archivos de demo, consola y source maps de producción. Un ganador oculto por CSS o codificado en el bundle es una falla de entrega.

Reautenticación reservada no se renueva por refresh token. Al cerrar sesión, invalidar proof. Controlar que la vista miembro del administrador no adopte el UUID de otro participante. La exportación reservada requiere la misma reautenticación que la lectura.

## 4 Diseño y accesibilidad

Verificar a 360 por 800, 390 por 844, 768 por 1024, 1366 por 768 y 1920 por 1080. Revisar Safari iOS, Chrome Android y navegadores de escritorio actuales. Los formularios no pueden depender de scroll horizontal. Un lector de pantalla debe entender estado de selección, porcentaje restante, errores y confirmación de guardado.

Navegar por teclado; no perder foco al abrir modal o cambiar categoría. Contraste WCAG AA para textos y controles, targets de 44 px y zoom al 200 por ciento. reduced motion detiene muro animado, confeti y apertura de sobre, manteniendo la información. El teclado virtual no tapa Guardar.

La portada con fotos no puede hacer ilegible título o acciones. El modo oscuro y claro conserva estados. Un error de carga muestra reintento y último dato conocido, nunca un ranking falso de ceros. En ceremonia, cualquier ganador o estado cabe entero a 1280 por 720.

## 5 Verificación antes de salir a producción

Ejecutar pruebas de dominio, RLS, integración y E2E de los siete recorridos completos. Ejecutar typecheck, lint y build. Medir carga con 30 identidades ficticias y 60 solicitudes concurrentes en staging. Probar un backup y restore de DB más Storage, no sólo exportar un SQL.

Verificar desde cuentas externas de prueba que el correo OTP llega a Gmail y Outlook, las URLs de producción son correctas, no hay registro libre y no queda un dataset ficticio publicado. Verificar worker HEIC, MOV y video vertical con audio. Asegurar que producción usa sus propios secrets, la cola está sana y el scheduler tiene ejecuciones recientes.

Preparar un ensayo de ceremonia en staging con resultados ficticios para ganador, empate, desierto y sin votos. El ensayo no cambia producción ni dispara avisos reales. Antes de la cena, ejecutar un ensayo del proyector con la conexión disponible.

## 6 Definición de entrega terminada

Entregar repositorio, acceso de propietario, staging y producción configurables, documentación de operación, migraciones reproducibles, manifest de recursos, OpenAPI y resultados de pruebas. Todos los módulos pedidos deben guardar y leer datos del servidor. Dejar una lista explícita de cualquier limitación comprobada, sin presentar botones decorativos como funcionalidades.

El checklist funcional del propietario debe incluir: carga de miembros, invitación, publicación de fechas, confirmación de plan, presupuesto de regalo, sorteo, apertura y cierre de premios, apertura de ballotage, revelación por categoría, edición de compras, moderación de galería y creación del año siguiente.

El administrador puede empezar sin fecha ni correos completos. Los datos faltantes aparecen como pendientes administrables. La entrega no requiere que el grupo ya haya decidido la cena para considerarse un producto completo.
