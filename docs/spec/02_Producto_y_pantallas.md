# Especificación del producto y las pantallas

La Banda del cerrucho · Cena anual de fin de año · Versión 1.0

Construir una aplicación web privada que permita organizar la cena anual, participar de las decisiones, sortear el amigo invisible, votar nueve premios sin anticipar los ganadores y guardar los recuerdos. Debe funcionar especialmente bien desde los enlaces que se abren en WhatsApp y desde el celular durante la noche. La estructura visual deriva del panel de Olimpiadas ABN; el contenido y las reglas de este documento corresponden exclusivamente al grupo de amigos.

La primera edición se llama Cena de fin de año 2026. Fecha, lugar, menú, presupuesto y salida empiezan sin confirmar. La aplicación debe poder ponerse en marcha en ese estado. Los datos que hoy no existen se completan desde sus pantallas normales, sin bloquear el desarrollo ni requerir decisiones adicionales de producto.

## 1 Alcance de la primera entrega

La primera versión incluye acceso por correo sin contraseña, miembros, asistencia, disponibilidad de fechas, propuestas y encuestas, comida, bebidas y compras, amigo invisible, premios y ballotage, ceremonia en vivo, tareas, gastos, agenda, salida y transporte, galería y archivo anual. Todos estos módulos forman parte de la entrega funcional; el orden de desarrollo no autoriza a dejar alguno como una maqueta.

No se requieren una app nativa, chat interno, cobro online, integración automática con WhatsApp, identificación de caras ni servicios de IA. El grupo conversa en WhatsApp; la web consolida decisiones y compromisos. Los botones para compartir producen texto o abren el selector de compartir del dispositivo. No envían mensajes por su cuenta.

## 2 Principios de experiencia

El usuario tiene que encontrar su próxima acción en menos de diez segundos. El inicio prioriza pendientes personales, cierres próximos y decisiones confirmadas. La plataforma debe distinguir propuesta, votación abierta y decisión oficial. Una mayoría provisional no confirma una reserva ni una fecha.

Las participaciones pertenecen a quien las hizo: cada miembro modifica sus votos, asistencia, porcentajes, propuestas, tareas y archivos propios dentro de los plazos. El administrador modifica la organización. No pedir nuevamente nombre o correo en cada formulario.

El lenguaje usa español rioplatense: Entrá, Elegí, Guardá, Ya votaste, Falta definir y No llego. Puede tener humor corto del grupo en títulos o ayudas, pero errores, importes, privacidad y reglas deben ser inequívocos. Conservar la escritura cerrucho indicada por el usuario.

## 3 Roles y visibilidad

Agustín, agustin@abndigital.com.ar, es el único administrador inicial y propietario. Debe autenticarse por el mismo mecanismo sin contraseña que los demás. Su rol se asigna en el servidor y nunca desde un parámetro, el nombre, el dominio del correo ni metadatos editables por el cliente.

| Acción o información | Visitante | Miembro activo | Administrador |
| --- | --- | --- | --- |
| Ver identidad genérica y acceso | Sí | Sí | Sí |
| Ver panel del evento y miembros | No | Sí | Sí |
| Editar respuesta o perfil propios | No | Sí | Sí |
| Votar una vez por pregunta y ronda | No | Sí si es elector | Sí si es elector |
| Proponer comida, lugar o salida | No | Sí | Sí |
| Aprobar propuestas y publicar opciones | No | No | Sí |
| Cambiar fechas, reglas, agenda o costos | No | No | Sí |
| Cargar fotos y videos | No | Sí | Sí |
| Editar o retirar archivo propio | No | Sí | Sí |
| Moderar cualquier archivo | No | No | Sí |
| Ver su destinatario del regalo | No | Sí si participa | Sí si participa |
| Ver sorteos completos y resultados sellados | No | No | Sí mediante acceso explícito auditado |
| Ver votos identificados de premios | No | Sólo su voto | Sí mediante acceso explícito auditado |
| Gestionar correos, invitaciones y permisos | No | No | Sí |

Los miembros ven todas las secciones funcionales y el archivo autorizado. No ven administración, correos ajenos, destinatarios ajenos, perfiles alimentarios privados, recibos privados ni resultados de premios sin revelar. La lista de miembros publica nombre o alias y avatar, no su correo.

El acceso completo del administrador es una excepción explícita al secreto de los premios y regalos. Por defecto tampoco se le muestran ganadores ni el mapa del sorteo. Un botón Ver información reservada exige reautenticación reciente, motivo y confirmación dentro de la app. Se registra qué conjunto abrió y cuándo. La interfaz dice: Tu voto no se muestra al grupo. El administrador puede acceder a información reservada para resolver incidencias. No prometer anonimato absoluto.

Administrar no equivale a votar por otra persona. El administrador puede anular una votación, reabrirla, gestionar el padrón o registrar un resultado manual extraordinario, siempre con motivo y versión. No puede modificar silenciosamente una boleta individual. Un resultado manual lleva la marca Resolución del administrador y nunca se presenta como escrutinio automático.

## 4 Acceso y miembros

### 4.1 Inicio de sesión

Pantalla pública: logotipo tipográfico del grupo, Cena de fin de año, campo de correo, botón Enviarme código y ayuda Usá el mail con el que te invitaron. Sin fotos privadas, domicilios, listas ni estado de votaciones antes de entrar.

El acceso principal usa un código de seis dígitos recibido por correo, con vencimiento de diez minutos y reenvío después de sesenta segundos. Es un código temporal, no una contraseña. Permitir pegar el código completo, autocompletarlo donde el navegador lo soporte y corregir el correo. No implementar contraseña, registro libre ni selección de nombre para identificarse.

Al solicitar acceso se responde siempre: Si ese mail tiene una invitación activa, te va a llegar un código. Al verificar correctamente se valida otra vez la invitación y el estado del miembro. Un correo que no esté habilitado no puede entrar aunque consiga autenticar una cuenta en el proveedor.

En la primera entrada, pedir alias de visualización, avatar opcional y consentimiento de participación. No exigir teléfono, dirección ni fecha de nacimiento. Mantener sesión mediante las cookies del flujo SSR y ofrecer Cerrar sesión. Para información reservada del administrador exigir una verificación de correo realizada en los últimos diez minutos.

### 4.2 Administración de miembros

Crear, editar, suspender, reactivar, vincular un borrador e invitar. Campos: identificador estable, nombre, alias, correo único, estado y participación en la edición. Al cargar un correo válido, crear identidad de autenticación sin mandar invitación todavía; Enviar invitación es una acción separada. También soportar importación CSV con vista previa, validación por fila y reporte de duplicados.

El seed incorpora los 23 alias observados como borradores sin correo y el propietario real como cuenta separada. La etiqueta You queda sólo en el registro de origen. Un botón Vincular con el propietario permite resolver la posible correspondencia de Agus después de revisarla. No adivinar mails, apellidos ni avatares.

Antes de publicar votaciones, el administrador define quién participa en la edición. Un miembro puede pertenecer al grupo y no participar ese año. Los electores de una encuesta se congelan al abrirla. Agregar un miembro más tarde no le asigna automáticamente derecho a modificar una elección abierta o cerrada.

Suspender el acceso no borra votos válidamente emitidos ni registros históricos. El propietario no se puede suspender, borrar ni degradar desde una acción ordinaria. Para cambiar el correo de otro miembro, desvincular la sesión anterior, bloquear acceso y exigir verificación del nuevo correo; conservar el identificador de persona y su historial.

## 5 Navegación y lenguaje visual

| Grupo | Pantalla | Ruta |
| --- | --- | --- |
| Esta edición | Inicio | /e/2026 |
| Esta edición | Fecha y asistencia | /e/2026/fecha |
| Esta edición | Comida y lugar | /e/2026/comida |
| Esta edición | Bebidas | /e/2026/bebidas |
| Esta edición | Amigo invisible | /e/2026/amigo-invisible |
| Esta edición | Premios | /e/2026/premios |
| Esta edición | Agenda y salida | /e/2026/agenda |
| Organización | Tareas y compras | /e/2026/tareas |
| Organización | Gastos | /e/2026/gastos |
| La banda | Miembros | /miembros |
| La banda | Galería | /galeria |
| La banda | Archivo | /archivo |
| Administración | Panel privado | /admin |
| Ceremonia | Pantalla de proyección | /e/2026/ceremonia |

El año de la URL es un slug de edición, no un filtro suficiente de permisos. Todas las pantallas verifican acceso a la edición consultada.

En escritorio desde 1024 px, sidebar de 232 px, contraíble a 64 px, topbar de 56 px y ancho máximo de contenido de 1200 px. Entre 768 y 1023 px, sidebar compacto. Por debajo de 768 px, barra inferior con Inicio, Organizar, Premios, Fotos y Más. Organizar abre un menú de Fecha, Comida, Bebidas, Regalos, Tareas y Gastos. Más contiene miembros, agenda, archivo, cuenta y administración sólo si corresponde. Respetar safe areas del teléfono.

Fuente Plus Jakarta Sans alojada con el proyecto, tamaño base de 16 px, títulos de módulo de 28 a 36 px, hero de 44 a 88 px. Separaciones de 8, 12, 16, 24 y 32 px. Tarjetas con radio de 16 px, botones de 10 px, controles de al menos 44 px de alto. Color dorado claro #D9B45F sobre fondo oscuro; en tema claro usar #795800 para texto y controles que requieran contraste. No usar blanco sobre dorado claro para texto pequeño. Premios puede incorporar una fuente serif de sistema en la proyección; los formularios siguen en Jakarta.

Cada módulo debe diseñarse en móvil y escritorio, con estados vacío, cargando, guardando, error, sin conexión, cerrado y sólo lectura. Nada esencial aparece sólo al pasar el mouse. Navegación por teclado, foco visible, labels, lectura de errores y reduced motion son obligatorios.

## 6 Inicio

Hero con foto colectiva, overlay legible y nombre del grupo. Texto inicial: La cena está por armarse. Tu primera misión es votar la fecha. Cuando hay fecha oficial, mostrar día, hora, lugar y cuenta regresiva; antes no mostrar contador falso.

Debajo, Mis pendientes ordenados por fecha de cierre: disponibilidad, asistencia, comida, presupuesto de regalo, bebidas, premios, ballotage y tareas asumidas. Cada tarjeta tiene una acción directa, tiempo límite y estado real. Mostrar de 0 a 8 pendientes y al completar uno retirarlo después de confirmar el guardado.

Panel El plan muestra seis decisiones: Fecha, Lugar, Menú, Regalo, Premios y Salida. Estados Sin definir, En votación, Confirmado, Pendiente de reserva o Cerrado según el módulo. Una decisión confirmada incluye quién la confirmó y cuándo. Otro bloque muestra asistentes confirmados, respuestas pendientes y últimas novedades administrativas. No incluir un feed con cada voto de premio.

Para el administrador, una vista adicional presenta próximos cierres, encuestas con poca participación, propuestas pendientes, usuarios sin correo y errores de envío. Generar un mensaje breve para copiar a WhatsApp con pendientes logísticos, enlace de la edición y sin datos reservados.

## 7 Fecha y asistencia

### 7.1 Disponibilidad

Agus agrega fechas candidatas con hora de inicio propuesta, comentario y fecha de cierre. No se publican fechas ficticias desde el seed. Un asistente puede proponer otra fecha; aparece pendiente de aprobación. Una fecha aprobada antes de abrir la encuesta se vuelve opción normal.

Por cada opción, todos responden Puedo, Capaz o No puedo. Son respuestas excluyentes para esa fecha; se puede elegir Puedo para varias fechas. Agregar Marcar todas como puedo y Marcar todas como no puedo. Una respuesta enviada debe cubrir todas las fechas. No responder no equivale a No puedo ni a Capaz.

La recomendación se ordena primero por cantidad de Puedo y luego por cantidad de Capaz. Si persiste empate, se muestra Empate de disponibilidad con ambas opciones; Agus elige explícitamente con motivo. Siempre mostrar respondieron X de N y la matriz por persona a los miembros. No elegir automáticamente la fecha al vencer el plazo.

Quórum logístico predeterminado: techo de 70 por ciento de los electores. Con menos respuestas el estado es Cierre con baja participación, no resultado oficial. El administrador puede extender o confirmar con motivo. La confirmación conserva snapshot de todas las disponibilidades y registra la decisión.

Si ninguna fecha tiene siquiera un Puedo, mostrar Ninguna opción viable y proponer abrir una nueva consulta. Cuando aparecen opciones después de abrir una encuesta, no insertarlas silenciosamente: publicar una nueva versión que exige revisar todas las respuestas, o una nueva encuesta. La decisión debe quedar visible como actualización.

### 7.2 Confirmación definitiva

Una vez fijada la fecha, abrir RSVP: Voy, No voy o Todavía no sé, y llegada estimada opcional. La disponibilidad anterior no confirma asistencia. Se puede votar premios sin ir a la cena si se es elector de esa edición. El amigo invisible requiere una inscripción independiente.

Cambiar la fecha oficial marca los RSVP como Necesita reconfirmar. Dejan de contar para compras hasta confirmar el nuevo plan. Retener respuestas anteriores como historial; no borrarlas. El padrón del regalo y las votaciones de premios no cambian automáticamente por una modificación de RSVP.

No activar acompañantes por defecto. El módulo puede habilitarlos desde administración, y cada acompañante es un asistente logístico con su identificador, restricciones y bebidas, sin cuenta, voto ni premio por defecto.

## 8 Encuestas de decisiones

Motor reutilizable para lugar, menú, monto de regalo, horario, dress code, salida, presupuesto general y consultas nuevas creadas por el administrador. Campos: título, descripción, opciones, audiencia, método, privacidad, apertura, cierre, quórum y regla de desempate. El método no se cambia una vez abierta.

Predeterminado: aprobación múltiple para propuestas de comida, lugar y salida, porque permite marcar todas las opciones aceptables. Para monto de regalo, horario y otras alternativas mutuamente excluyentes, una sola opción. El presupuesto incluye No participo del regalo como inscripción aparte, no como un voto de monto. No mezclar abstención con rechazo.

Con aprobación, gana la opción con más aprobaciones, sin convertir la suma de aprobaciones en porcentaje de votantes. Mostrar personas que aprobaron la opción dividido electores, y participación aparte. Con voto único, el porcentaje se calcula sobre boletas válidas de esa consulta.

En encuestas logísticas el recuento es visible durante la votación. Los miembros ven su elección y agregados, salvo disponibilidad de fechas que también muestra matriz identificada. El administrador puede ver respuestas nominadas para organizar. Las encuestas de premios usan reglas y privacidad específicas.

Empate en encuesta logística: segunda consulta de voto único entre líderes durante 48 horas, sin trasladar votos previos. Si vuelve a empatar, el administrador confirma una alternativa y registra el motivo. La recomendación es orientativa hasta que Agus confirme la elección oficial. Opciones Necesitamos otra alternativa y No me sirve ninguna pueden incluirse al publicar; si ganan, la decisión queda sin resolver y se crea una nueva consulta.

## 9 Comida y lugar

Dos decisiones separadas: dónde y qué comemos. Una opción de lugar contiene nombre, dirección privada, enlace externo validado, capacidad, presupuesto estimado por persona, disponibilidad de reserva y responsable. Una opción de comida contiene nombre, modalidad, costo estimado, inclusiones y compatibilidad alimentaria declarada. No asumir que una opción resuelve alergias porque se votó.

Los miembros pueden presentar propuestas, editar sus propuestas mientras están pendientes y retirarlas. Sólo Agus las aprueba, las convierte en opción y publica cambios. Por defecto hay ejemplos en borrador Asado, Pizzas, Catering y Restaurante, sin importe ni disponibilidad. Nunca figuran como opciones reales hasta publicarse.

Cada persona completa restricciones alimentarias opcionales: vegetarianismo, veganismo, sin gluten, alergias y comentario. La respuesta nominada es privada para esa persona y Agus; el grupo ve necesidades agregadas únicamente si hay al menos tres personas por categoría. Por debajo, se muestra Hay necesidades alimentarias a contemplar sin identificar. No pedir historial médico.

Luego de confirmar menú y lugar, mostrar qué incluye, costo estimado por persona, responsable, estado de reserva, dirección, horario y qué traer. El costo estimado no reemplaza gastos reales. Rechazar confirmación de un lugar cuya capacidad sea menor que los asistentes actuales, salvo justificación explícita y advertencia visible de cupo.

## 10 Bebidas y cálculo de compras

Formulario personal con seis opciones fijas: Fernet, Cerveza, Gin, Vodka, Vino y Aperol. Cada porcentaje es entero de 0 a 100 con botones y campo numérico. El total debe ser exactamente 100 para quien tome alcohol; no normalizar valores automáticamente al guardar. Mostrar Te faltan 20 puntos o Te pasaste por 10. Ofrecer presets 100 por ciento en una bebida y Mitad y mitad, sin marcar una respuesta como válida sin que el usuario guarde.

Preguntar también Cuántas porciones calculás para la cena, entero de 1 a 20. Proponer 4 como valor inicial de interfaz, sin contarlo como respuesta. Esto sirve para estimar compras, no establece una recomendación de consumo. No incluir la salida posterior en esa cantidad. No tomo alcohol establece cantidad 0 y porcentajes 0; se cuenta como respuesta completa. Se puede cambiar de opinión antes del cierre.

El gráfico del grupo muestra reparto ponderado por porciones y cobertura de respuestas entre asistentes confirmados. No toma es un contador separado. Nunca incluir a quien no contestó como si tomara una bebida predeterminada. Para quienes faltan, mostrar escenario pendiente con una variable editable por Agus y separado del cálculo basado en respuestas; el valor predeterminado es cero, no una imputación silenciosa.

| Bebida | Ingredientes por porción para estimar compras | Presentación inicial |
| --- | --- | --- |
| Fernet | 45 ml fernet y 135 ml cola | 750 ml y cola de 2250 ml |
| Cerveza | 473 ml cerveza | Lata de 473 ml y pack de 6 |
| Gin | 45 ml gin y 135 ml tónica | 750 ml y tónica de 1500 ml |
| Vodka | 45 ml vodka y 135 ml jugo | 750 ml y jugo de 1000 ml |
| Vino | 150 ml vino | 750 ml |
| Aperol | 60 ml Aperol, 90 ml espumante y 30 ml soda | 750 ml, 750 ml y soda de 1500 ml |

Son parámetros de cálculo editables por administración, no instrucciones de preparación ni proporciones médicas. Cantidad de una bebida para una persona: porciones por porcentaje dividido 100. Sumar ingredientes para todos los asistentes respondidos, aplicar reserva de compra del 10 por ciento y restar stock disponible una sola vez. Redondear hacia arriba a unidades o packs enteros. Si el resultado es cero, comprar cero envases.

Ejemplo: dos personas, ambas con cuatro porciones y 50 por ciento fernet y 50 por ciento cerveza, generan cuatro porciones de cada bebida. Se necesitan 180 ml de fernet, 540 ml de cola y cuatro latas. Con reserva del 10 por ciento y stock cero, se propone una botella de fernet, una de cola y cinco latas; si se compra sólo por pack de seis, un pack. No sumar otro 10 por ciento después de redondear.

Agregar agua estimada de 1000 ml por asistente e hielo de 500 g por asistente, ambos editables y claramente identificados como supuestos de compra. Bebidas sin alcohol adicionales se configuran como insumos; no agregarlas a los seis porcentajes. La lista muestra cantidad calculada, stock, pendiente de comprar, envase, responsable y estado comprado. Los precios sólo aparecen si se cargaron; total incompleto si faltan precios.

Al cerrar bebidas, guardar snapshot con asistentes, respuestas, recetas, reserva y stock. Cambios posteriores generan una nueva versión y un delta de compras. Nunca borrar compras ya hechas ni sobrescribir gastos reales. Agus puede ajustar cantidades finales con motivo. Los miembros pueden asumir una tarea de compra, registrar que la realizaron y proponer su gasto; la aprobación del gasto corresponde a Agus.

## 11 Amigo invisible

### 11.1 Presupuesto e inscripción

La aplicación consulta el monto por voto único. Seed en borrador: ARS 50000, 75000, 100000 y 150000; todos son propuestas, ninguna está confirmada. Una vez cerrada y confirmada la consulta, el monto se vuelve referencia común y se comunica con tolerancia inicial de más o menos 10 por ciento. El monto y tolerancia son configurables antes del sorteo. No exponer públicamente cuánto costó el regalo real.

Cada participante acepta Me sumo, el monto y la fecha límite. RSVP de cena no lo inscribe automáticamente. Por defecto se admite a cualquier miembro activo de la edición, asista o no, si acuerda entregar el regalo mediante otra persona. Pedir responsable de entrega cuando no vaya. Tiene que haber al menos tres participantes con correo verificado para el sorteo oficial.

Permitir lista de deseos y No me regales, ambos opcionales y visibles a quien regala y al propietario de la lista. Evitar exponer la lista completa del grupo en la pantalla del regalo.

### 11.2 Sorteo

Al cerrar inscripción, congelar padrón y presupuesto. Sortear en servidor con aleatoriedad criptográfica una permutación válida: nadie se regala a sí mismo, cada persona da un regalo y recibe exactamente uno. Se permiten pares recíprocos porque el requisito original no los prohíbe. No implementar restricciones de parejas o de años anteriores en esta versión. El ensayo sólo usa miembros ficticios y un ambiente separado.

Publicar las asignaciones de una sola operación. Un usuario ve exclusivamente Te tocó regalarle a seguido del alias de su destinatario. La notificación por correo dice Tu amigo invisible ya está disponible y enlaza a la pantalla autenticada; no incluye el destinatario en el asunto, preheader o cuerpo. Registrar Vi a quién me tocó y Regalo listo como estados propios. Nadie ve quién le regala.

Agus ve cantidad de participantes, cantidad que vio su asignación, cantidad de regalos listos y entregas pendientes. Ver el mapa completo requiere acceso reservado explícito. No enviar mapa o semilla al navegador del miembro ni por una suscripción en vivo.

### 11.3 Cambios después del sorteo

Una baja de RSVP no altera la asignación. El usuario coordina entrega. Una baja real del regalo se registra como incidencia. Agus puede mantener la obligación con entrega delegada o anular la versión y volver a sortear el padrón completo. Un nuevo sorteo requiere motivo, aviso a todos y confirmación de que los destinatarios anteriores dejan de ser válidos. Nunca rehacerlo al recargar ni cambiar un solo enlace de la cadena en silencio.

El administrador puede realizar una reasignación extraordinaria de varias asignaciones en una nueva versión atómica, siempre que se mantengan todos los invariantes. Debe indicar qué miembros fueron afectados, notificarles y preservar la versión anterior sólo en el archivo reservado. La UI ordinaria ofrece primero mantener o volver a sortear.

En la noche, cada uno marca Entregado y Recibido en sus obligaciones correspondientes. Después de la entrega completa, el dueño del regalo puede revelar a su destinatario quién lo regaló mediante una acción personal. No publicar el mapa completo por defecto ni por archivar el evento.

## 12 Premios anuales

### 12.1 Categorías iniciales

| Código | Nombre | Descripción inicial editable | Candidatos |
| --- | --- | --- | --- |
| revelacion_vao | Revelación VAO | La sorpresa del Viaje Anual Obligatorio | Miembros marcados como participantes VAO |
| mvp_vao | MVP VAO | El más valioso del Viaje Anual Obligatorio | Participantes VAO |
| rey_noche_vao | Rey de la noche VAO | El protagonista de las noches del VAO | Participantes VAO |
| the_rat | The Rat | El que más cuidó el bolsillo este año | Miembros participantes de la edición |
| pollera | Pollera | El que más se ganó este título durante el año | Miembros participantes de la edición |
| cerrucho | Cerrucho | El que más hizo honor al nombre del grupo | Miembros participantes de la edición |
| promesa | Promesa del año siguiente | El que promete sorprendernos el año que viene | Miembros participantes de la edición |
| amigo_oro | Amigo de Oro | El que siempre estuvo cuando hizo falta | Miembros participantes de la edición |
| presidente | Presidente del año siguiente | El elegido para representar y movilizar a la banda | Miembros participantes de la edición |

Se corrige el error de escritura Revalación a Revelación. Los textos humorísticos son propuestas iniciales de producto, editables antes de abrir la elección; no describen conductas de personas concretas. No añadir otras categorías de premios automáticamente. Para promesa y presidente mostrar 2027 en la edición 2026.

Agus marca quién fue al VAO. No inferirlo de fotografías. Las tres categorías VAO quedan bloqueadas para apertura hasta guardar esa lista. Si fue nadie, pueden desactivarse con motivo antes de abrir. Los electores de todas las categorías son los miembros activos habilitados en la edición, independientemente de asistencia o participación en el VAO. El candidato puede no asistir a la cena.

### 12.2 Boleta y primera ronda

Una selección por categoría: una persona o Nadie lo merece. La opción Nadie es un candidato especial explícito, no un voto blanco. El usuario puede votar por sí mismo; mostrar esa regla desde el principio. No permitir texto libre para candidatos ni multiplicar el peso del administrador.

Se permite guardar categoría por categoría y volver a cambiar hasta el cierre. Una categoría sin respuesta permanece pendiente y no suma a Nadie. Mostrar X de 9 completadas, Confirmar mis votos y resumen personal. La confirmación sólo señala que revisó la boleta; cada selección guardada válidamente antes del cierre ya cuenta. No invalidar una boleta por no completar otras categorías.

No mostrar ranking, porcentajes, ganadores provisionales, lista de quién votó a quién ni participación nominada por categoría. El grupo puede ver cuántos completaron toda la boleta. Cada persona ve sus propias selecciones. Agus puede ver pendientes generales para recordar, sin entrar al recuento.

### 12.3 Regla exacta de ballotage

Al cerrar la primera ronda, el servidor cuenta la última selección válida de cada elector por categoría. Si no hay votos, esa categoría queda SIN VOTOS. No hay ganador ni se transforma en Nadie. No existe quórum mínimo para premios por defecto: se resuelve con los votos emitidos y se informa participación al revelar.

Considerar las opciones que recibieron al menos un voto, incluido Nadie. Si sólo una opción recibió votos, gana directamente. Si existen dos o más, ordenar los recuentos y comparar líder con segundo. Una diferencia de tres votos o más resuelve la primera ronda. Una diferencia de cero, uno o dos abre ballotage.

El ballotage incluye todas las opciones con al menos un voto cuya distancia del líder sea menor a tres. Esto incluye dos, tres o más finalistas si cumplen. Opciones con cero votos quedan afuera: no son candidaturas votadas. Esta es la definición adoptada para los casos que el pedido no fijó; debe mostrarse antes de abrir la votación. No elegir por orden alfabético a quién excluir.

Nadie participa del ballotage si está dentro del margen. Si gana, el premio queda DESIERTO. Los votos de primera ronda no se arrastran. La segunda ronda usa el mismo snapshot de electores; quien no votó en la primera puede votar en la segunda. Si un elector perdió acceso, no se le restituye automáticamente por estar en el snapshot.

| Primera ronda | Resolución |
| --- | --- |
| A 10, B 7, C 1 | A gana; la diferencia es 3 |
| A 10, B 8, C 1 | Ballotage A y B |
| A 8, B 7, C 6, D 3 | Ballotage A, B y C |
| A 8, B 7, C 6, D 6 | Ballotage A, B, C y D |
| Nadie 8, A 7, B 3 | Ballotage Nadie y A |
| Nadie 12, A 5 | DESIERTO directo |
| A 1 y todos los demás 0 | A gana directo, con participación de un voto |
| Todos 0 | SIN VOTOS |

En ballotage gana el mayor recuento sin requisito de margen. Empate en el primer puesto produce EMPATE entre todas las opciones empatadas; no hay tercera ronda, sorteo ni voto de calidad. Si Nadie empata con una persona, el estado también es EMPATE y se informa quiénes empataron. No declarar desierto salvo que Nadie sea único ganador. Sin votos en ballotage produce SIN VOTOS y no revive el resultado anterior.

### 12.4 Secreto y apertura de segunda ronda

Cerrar primera ronda no revela resultados. Se publican sólo categorías con ballotage y sus finalistas en orden aleatorio fijo por usuario, sin recuentos ni orden de liderazgo. Los finalistas son necesariamente visibles para poder votar; eso da una pista, pero nunca comunica quién ganó. Las categorías resueltas siguen mostrando Resultado guardado para la ceremonia.

El sistema prepara el ballotage al cerrar y Agus lo abre para todas las categorías pendientes en una única acción. Duración sugerida de 48 horas, editable antes de abrir. Ningún cierre ni mensaje automático publica un ganador. No agregar un botón de exportación de resultados en la vista habitual del administrador.

Congelar categorías, candidatos, reglas y electores al abrir primera ronda. Modificarlos después exige anular la elección de las categorías afectadas y abrir una nueva versión con explicación; no mezclar boletas que tuvieron opciones distintas. Dejar una categoría cerrada si los cambios afectan a otra. Archivar resultados y versiones anuladas en el área reservada.

## 13 Ceremonia

La ceremonia tiene dos pantallas: control privado de Agus y proyección visible para miembros. El administrador abre el control en su teléfono o computadora y el proyector usa una cuenta autorizada de miembro que sólo recibe contenido revelado. La pantalla pública nunca comparte el escritorio de control. No necesita un enlace abierto de acceso público.

Estados de proyección: Bienvenida, Categoría, Nominados, Sobre cerrado, Resultado y Cierre. Agus elige el orden, muestra el título y los nominados y toca Revelar. Los nominados se pueden publicar sólo cuando él lo decide; no son un ranking. Si el premio se resolvió directo, los nominados de ceremonia son todas las opciones con al menos un voto, incluido Nadie, ordenadas alfabéticamente. Si tuvo ballotage, son sus finalistas. Nada se envía antes de autorizar esa pantalla.

Revelar exige que la categoría esté resuelta y que la ceremonia esté iniciada por Agus. No se revela al tocar Siguiente ni por una cuenta regresiva. Una animación breve abre el sobre, opcionalmente reproduce audio después de una interacción voluntaria y muestra ganador, EMPATE, DESIERTO o SIN VOTOS. El resultado se persiste antes de la animación; refrescar o reconectar no produce una segunda revelación.

Después de revelar, el resultado aparece en la sección Premios de los miembros y en el archivo. Los votos agregados se pueden ver con un botón Ver votación sólo para esa categoría ya revelada. Nunca publicar boletas personales. Para empate entre dos o más personas, mostrar sus nombres con el mismo tamaño, sin destacar al primero. Si interviene Nadie, mostrarlo literalmente.

Controles de Agus: iniciar, pausar, categoría anterior, siguiente, mostrar nominados, revelar y repetir animación de un resultado ya público. Pausar detiene la presentación, no revierte la revelación. Un error no autoriza a volver a ocultar un dato ya visto: registrar corrección y mostrar Resultado corregido con motivo si fuera necesario.

El modo proyección usa fondo oscuro, tipografía grande, logo del grupo, dorado, fotos del grupo en el lobby y avatares verificados si existen. Debe funcionar a 1920 por 1080 y 1280 por 720, sin barra inferior ni sidebar. En móvil se ofrece seguir la misma ceremonia. No es obligatorio tener fotos individuales para otorgar premios.

## 14 Agenda y salida

Antes de fijar fecha, mostrar secuencia borrador: llegada, regalos, comida, ceremonia y salida, sin horarios oficiales. Al confirmar, Agus asigna horas y responsables. Una sugerencia de edición usa offsets relativos a la llegada: 0, más 45 minutos, más 75 minutos, más 150 minutos y más 240 minutos. Son ayudas para construir agenda, no una programación confirmada. No iniciar tareas automáticamente por esos offsets.

La salida tiene propuestas con nombre, zona, enlace, costo estimado de entrada, reserva, dress code y responsable. Votación de aprobación múltiple sólo entre quienes marquen Me sumo a salir. La confirmación de salida no cambia asistencia a cena. Mostrar Me vuelvo después de comer y Me quedo hasta los premios como opciones personales de plan.

Transporte contiene Necesito traslado, Ofrezco lugar, origen de referencia no exacto, hora, cantidad de asientos y tramo cena o salida. Miembros ofrecen y solicitan; Agus asigna. Una asignación no puede superar asientos. Mostrar compañeros del traslado sólo a involucrados y Agus. No geolocalizar ni comprar viajes. Incluir alternativa taxi o remis como modalidad, sin integrar un proveedor.

El calendario descargable ICS incluye exclusivamente la cena confirmada y el plan publicado; usar zona America/Argentina/Buenos_Aires y UID estable. Las actualizaciones incrementan SEQUENCE; no crear eventos duplicados al descargar de nuevo. No incluir datos de premios o regalos.

## 15 Tareas y compras

Plantillas iniciales en borrador: confirmar lugar, comprar comida, comprar bebidas, comprar hielo, llevar vasos, llevar parlante, preparar premios, proyectar ceremonia, coordinar salida y limpieza. Campos: descripción, cantidad, unidad, plazo, responsable o voluntarios, estado, costo estimado y vínculo a decisión o lista de compras.

Agus crea y edita tareas. Los miembros pueden ofrecerse, marcar progreso propio y subir comprobante. Una tarea de cupo uno sólo acepta un voluntario mediante operación atómica. En tareas con cantidad, la suma de aportes no excede la necesidad salvo que Agus lo habilite. Retirarse antes del bloqueo devuelve el cupo; después requiere liberar con administración. No permitir a un miembro asignar trabajo a otro.

Separar Lista personal de llevar de Tareas comunes. Lista personal inicial: regalo si participa, medio de pago, lo que se comprometió a llevar y documentación si el lugar de salida la requiere. Ninguno de estos checks se interpreta como gasto ni modifica el sorteo.

## 16 Gastos y cuentas

Usar ARS, mostrar fechas y guardar importes como centavos enteros. El regalo individual no forma parte de la cuenta común. No sumar presupuesto estimado a gasto real. Cada gasto registra concepto, pagador, fecha, importe, rubro, comprobante opcional, participantes que comparten el costo y estado Propuesto o Aprobado.

Los miembros proponen sólo gastos que pagaron y ven su saldo; Agus aprueba, rechaza y corrige con historial. Toda modificación de un gasto aprobado genera nueva revisión. Por defecto: comida y gastos comunes entre asistentes definitivos, alcohol entre asistentes que declararon consumo y salida entre quienes la confirmaron. Cada gasto guarda su lista explícita de beneficiarios; cambiar un RSVP no reescribe gastos pasados. Si faltan datos para crear esa lista, el gasto queda pendiente de asignación y no entra al saldo.

División equitativa predeterminada. Repartir los centavos sobrantes por orden estable de identificadores dentro del gasto para que la suma cierre exactamente. Agus puede introducir importes personalizados cuya suma debe coincidir con el total. Devolver dinero se registra como gasto negativo o devolución vinculada con regla idéntica; no borrar el gasto original.

Mostrar pagos hechos por cada persona, costo asignado y saldo neto. Saldo positivo significa que debe recibir dinero. Una lista de transferencias sugeridas concilia deudores y acreedores, sin afirmar que es el mínimo matemático de transferencias. Registrar transferencias efectuadas como propuestas y confirmarlas por Agus o por el receptor. No ejecutar pagos. Datos bancarios o alias de transferencia son opcionales y se muestran sólo a los involucrados y Agus.

Una persona que no tomó alcohol no comparte un gasto de alcohol salvo inclusión expresa revisada por Agus. Las cantidades declaradas no se usan para cobrar por consumo real; el reparto predeterminado es igualitario entre quienes integran el gasto.

## 17 Galería

Galería privada con filtros por edición o álbum, fotos, videos, memes y subido por mí. Carga múltiple desde cámara o archivos, hasta 20 por lote, progreso por elemento, cancelar y reintentar. No exigir instalar app. Límites iniciales: imagen de hasta 20 MB, video de hasta 200 MB y cinco minutos; cuota inicial de 5 GB por edición, editable por Agus.

Formatos: JPEG, PNG, WebP y HEIC para imágenes; MP4, MOV y WebM para video. Procesar HEIC a JPEG o WebP. Convertir MOV o formatos no reproducibles a MP4 H264 y AAC; generar póster y una versión de reproducción de hasta 1080p. Nunca bloquear el servidor web esperando la transcodificación. Un archivo queda Procesando y luego Listo o Error con reintento.

Grilla masonry de una a cuatro columnas según ancho, paginación por cursor de 24 elementos, miniaturas responsivas y lazy loading. Lightbox con flechas, swipe, cierre accesible, contador, autor, caption y álbum. Videos con controles, sin autoplay con audio. Reacciones simples y única reacción de cada tipo por miembro. Comentarios no forman parte de la primera versión para no abrir otro canal de coordinación.

Cada archivo tiene título opcional, edición o álbum, tipo, autor, fecha de carga, fecha de captura si está disponible y permiso para destacarlo. No hacer reconocimiento facial. El uploader puede cambiar caption, retirar su archivo y autorizar destaque. Agus modera, retira, restaura y elige portada. Los originales se conservan privados; thumbnails también. Quitar GPS de derivados; no extraer ni mostrar GPS del original. No publicar URLs permanentes.

Una retirada oculta el elemento de inmediato en los nuevos pedidos y conserva recuperación durante 30 días. Agus puede restaurar. Las URLs temporales ya emitidas caducan en hasta cinco minutos; no prometer borrado instantáneo de bytes ya descargados. Un miembro suspendido deja de obtener archivos nuevos.

Los diez recursos visuales adjuntos se cargan como recuerdos, no como evidencia de quién ganó o viajó. El encabezado de WhatsApp queda como fuente del padrón y no como foto en la galería. La imagen duplicada de noche puede conservarse en archivos pero no repetir ambos encuadres en el hero.

## 18 Notificaciones y participación

Centro interno de notificaciones con invitación, nueva consulta, fecha confirmada, cambios de plan, regalo disponible, cierre próximo, ballotage, tarea asignada y archivo procesado. Correo sólo para invitación, acceso y comunicaciones importantes habilitadas por el miembro. Códigos de acceso no se pueden desactivar si se quiere usar la aplicación.

Al abrir una consulta, recordar a pendientes 48 horas y 12 horas antes del cierre. Si la consulta dura menos de 48 horas, omitir el primero. Máximo un correo de resumen por miembro y día, excepto códigos y cambios críticos de fecha o sorteo. Una respuesta guardada cancela recordatorios futuros de ese pendiente. Un enlace siempre lleva al panel autenticado; no lleva datos reservados ni tokens de sesión.

No enviar recordatorios cuando aún no existe cierre. Los envíos se hacen mediante cola idempotente y se registra entrega o error. El administrador ve fallos y puede reenviar. Botón Copiar para WhatsApp produce texto que Agus decide compartir. No usar IA ni perfiles personales para decidir quién presionar.

## 19 Panel de administración

Pestañas: Edición, Miembros, Decisiones, Comida, Bebidas y compras, Regalos, Premios, Ceremonia, Tareas, Gastos, Galería, Envíos y Auditoría. Todo dato organizativo debe poder editarse aquí, sin cambiar código. Ajustes importantes incluyen plazos, padrón, categorías antes de apertura, restricciones VAO, recetas, presentaciones de compra, stock, costos, portada, reglas visibles y permiso de acceso a cada edición.

Abrir una consulta exige al menos dos opciones y un elector; premios exige al menos una persona candidata más Nadie. Guardar borrador no notifica. Publicar muestra una vista previa de qué verán los miembros. Cerrar es transaccional y confirma cantidad de respuestas; si ya cerró, devolver el resultado del mismo cierre. Para premios ese resumen no incluye ganadores salvo acceso reservado.

Acciones extraordinarias: cerrar con quórum logístico insuficiente, modificar fecha confirmada, anular y reabrir elección, reasignar sorteo, importar resultados históricos y corregir gasto. Todas requieren motivo y conservan versión anterior. Al borrar contenido organizativo se usa archivo o retirada recuperable, no pérdida de historial.

En cada módulo, mostrar Vista miembro para revisar permisos. Esta simulación no debe cambiar la identidad autenticada ni permitir votar como otra persona. El registro de auditoría contiene actor, acción, entidad, versión y fecha, sin secretos dentro de campos de consulta visibles al grupo.

## 20 Ediciones y archivo

Estados de edición: Borrador, Organizando, Confirmada, En curso, Cerrada y Archivada. Los módulos tienen estados propios; el estado general no abre ni cierra votaciones por sí solo. Pasar a En curso es una acción de Agus. Pasar a Archivada exige que no haya votaciones abiertas y que se hayan resuelto incidencias o registrado su pendiente explícitamente.

Crear el año siguiente copia miembros y plantillas de categorías, tareas y recetas. No copia votos, destinatarios, RSVP, costos aprobados, resultados, plazos, fecha ni lugar confirmado. El archivo muestra años anteriores, premios ya revelados, cena y recuerdos autorizados. Los ganadores importados de otro año llevan Procedencia manual. Los premios no revelados nunca se publican por archivar.

No crear campeones ni historias ficticias en el seed. La aplicación debe verse terminada con estados vacíos útiles: Todavía no cargamos premios de otros años y Este álbum espera sus primeras fotos.

La falta de fecha, correos, padrón VAO, precios o lugar no es una duda de desarrollo. Son datos operativos que el producto debe permitir completar. La entrega no puede inventarlos para mostrar funcionamiento.

## 21 Defaults cerrados para el desarrollo

| Tema | Decisión |
| --- | --- |
| Propietario | agustin@abndigital.com.ar |
| Grupo | La Banda del cerrucho |
| Edición inicial | Cena de fin de año 2026, en borrador |
| Zona horaria | America/Argentina/Buenos_Aires |
| Moneda | ARS con centavos enteros |
| Fecha y lugar | Sin definir |
| Correos faltantes | Registros borrador, sin acceso hasta completar |
| Voto propio en premios | Permitido y visible en las reglas |
| Nadie en premios | Alternativa efectiva y elegible en ballotage |
| Margen de ballotage | Menor a 3, equivalente a 0, 1 o 2 votos |
| Finalistas | Todos los votados dentro del margen, sin cap arbitrario |
| Premio con una sola alternativa votada | Gana esa alternativa |
| Premio sin votos | SIN VOTOS, nunca ganador inventado |
| Ballotage empatado | EMPATE, sin tercera ronda |
| Quórum logístico | 70 por ciento, con override justificado |
| Quórum premios | No exigido, mostrar participación al revelar |
| Presupuesto de regalo | Consulta en borrador; ARS 100000 es una opción |
| Tolerancia del regalo | Más o menos 10 por ciento al confirmar |
| Sorteo | Desde 3 participantes, sin autoasignación, reciprocidad permitida |
| Bebidas | Seis opciones solicitadas, porciones y reserva del 10 por ciento |
| Acceso público | Sólo marca genérica y login |
| Secreto frente a Agus | Oculto por defecto y acceso reservado auditado |
| Tecnología | Next.js, Supabase y Vercel |
| Idioma y año siguiente | es-AR y edición actual más uno |
