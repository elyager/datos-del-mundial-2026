# Datos del Mundial 2026

Este proyecto busca generar y organizar contenido relacionado con la Copa del Mundo 2026, combinando informacion cultural de los paises participantes con datos utiles sobre el torneo.

La idea principal es ofrecer mensajes y datos breves que ayuden a conocer mejor a cada seleccion, su pais, sus costumbres, historia, gastronomia, idioma, simbolos y otros elementos culturales relevantes. Ademas, el proyecto contempla incluir informacion relacionada con los partidos del Mundial, como fechas, horarios, encuentros programados y contexto general de cada jornada.

El objetivo es crear una fuente de contenido que pueda servir para informar, entretener y acompanar la conversacion alrededor del Mundial, conectando el calendario deportivo con datos culturales de los paises que compiten.

## Alcance inicial

- Generar datos culturales sobre los paises participantes.
- Crear mensajes relacionados con partidos, horarios y jornadas del Mundial.
- Asociar informacion cultural con selecciones, enfrentamientos o momentos relevantes del torneo.
- Mantener el contenido claro, breve y facil de reutilizar en diferentes canales.

## Posibles usos

- Publicaciones para redes sociales.
- Mensajes automaticos antes o durante los partidos.
- Contenido informativo sobre paises y selecciones.
- Material de apoyo para experiencias, bots o aplicaciones relacionadas con el Mundial 2026.

## Datos

Los archivos en `data/worldcup-2026/` se generan con:

```sh
node scripts/generate-worldcup-static.mjs
```

El archivo `data/worldcup-2026/notification-data.json` es el bundle publico para n8n.

El archivo `data/worldcup-2026/people.json` es la fuente canonica para participantes de tarjetas. Cada entrada usa una llave normalizada, como `nikito` o `noe`, e incluye `name` e `imageUrl`. Las instrucciones visuales personalizadas se guardan exclusivamente en la tabla de n8n `worldcup_custom_image_instructions`.

## Static assets

Las imagenes publicas del repositorio viven en `assets/images/`.

Las camisetas locales de selecciones viven en `assets/images/jerseys/`.

Las imagenes locales de estadios viven en `assets/images/stadiums/`.

URLs publicas para campos de imagen en n8n como `person1Url` o `person2Url`:

```text
https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/yager.jpeg
https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/nere.jpeg
```

## Workflow de tarjetas con Replicate

El archivo local `workflows/World Cup 2026 match alerts v1.0.8-riverflow-v2.5-pro-replicate.json` contiene el workflow importable en n8n para generar alertas de partidos, enviar mensajes y crear una tarjeta cuadrada de enfrentamiento con Replicate.

El script `scripts/n8n-match-card-parser.js` se puede pegar en un nodo `Code` de n8n antes de `Validate card input` para convertir un texto de 3 lineas en el formato estructurado requerido. El texto debe llegar en `$json.text`, por ejemplo:

```text
Brasil 🇧🇷 vs 🇲🇦 Marruecos
Nikito vs Noe
MetLife Stadium, New York/New Jersey (East Rutherford), Estados Unidos 🇺🇸
```

Requisitos:

- Crear una credencial de n8n tipo `HTTP Header Auth` llamada `Replicate Bearer Token`.
  - `Name`: `Authorization`
  - `Value`: `Bearer r8_tu_api_key`
- Importar `workflows/World Cup 2026 match alerts v1.0.8-riverflow-v2.5-pro-replicate.json` en n8n.
- Seleccionar la credencial `Replicate Bearer Token` en los nodos HTTP de Replicate si n8n no la enlaza automaticamente al importar.
- Para una prueba rapida desde n8n, ejecutar el nodo `Manual test trigger`; este usa el nodo `Mock image card input` como entrada de ejemplo.
- Enviar un `POST` al webhook de tarjetas configurado en n8n con los campos estructurados de la tarjeta.

## Subir workflows con la API de n8n

El script `scripts/n8n-workflow-upload.mjs` permite crear workflows nuevos o actualizar un workflow existente por ID usando la API publica de n8n. Usa `X-N8N-API-KEY`, no `Authorization: Bearer`; las credenciales internas del workflow, como `Replicate Bearer Token`, se mantienen como referencias de n8n y no se crean ni modifican con este script.

Variables locales esperadas en `.env` o en el entorno del proceso:

```sh
N8N_API_KEY=tu_api_key_de_n8n
N8N_BASE_URL=https://tu-instancia.app.n8n.cloud
```

`N8N_BASE_URL` puede ser la URL de la instancia o la raiz de la API, por ejemplo `https://tu-instancia.app.n8n.cloud/api/v1`. Si el API key tiene scopes, necesita `workflow:create`, `workflow:update` y `workflow:activate` para crear, actualizar y sincronizar el estado activo del workflow.

Crear un workflow nuevo:

```sh
node scripts/n8n-workflow-upload.mjs create --file "workflows/World Cup 2026 match alerts v1.0.8-riverflow-v2.5-pro-replicate.json"
```

Actualizar un workflow existente por ID:

```sh
node scripts/n8n-workflow-upload.mjs update --id PokqZb2u3y17O1fW --file "workflows/World Cup 2026 match alerts v1.0.8-riverflow-v2.5-pro-replicate.json"
```

Validar sin subir cambios:

```sh
node scripts/n8n-workflow-upload.mjs update --id PokqZb2u3y17O1fW --file "workflows/World Cup 2026 match alerts v1.0.8-riverflow-v2.5-pro-replicate.json" --dry-run
```

Opciones utiles:

- `--base-url <url>` sobrescribe `N8N_BASE_URL`.
- `--api-key-env <name>` lee la API key desde otra variable.
- `--dry-run` imprime las llamadas planeadas y el resumen del payload sin llamar a n8n.

El script elimina campos administrados por n8n como `id`, `versionId`, `meta`, `tags` y timestamps antes de enviar el workflow. Tambien filtra `settings` para enviar solo propiedades aceptadas por la API publica de n8n. Despues de crear o actualizar, sincroniza el estado con el valor local de `"active"`; si el archivo esta activo, n8n puede publicar webhooks inmediatamente.

Ejemplo de cuerpo:

```json
{
  "team1": "Brasil",
  "team2": "Marruecos",
  "person1Name": "Nikito",
  "person2Name": "Noe",
  "venue": "MetLife Stadium",
  "location": "New York/New Jersey",
  "person1Url": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/nikito.png",
  "person2Url": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/noe.png",
  "team1ShirtUrl": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/jerseys/BRA.webp",
  "team2ShirtUrl": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/jerseys/MAR.webp"
}
```

El workflow valida los campos y las cuatro URLs de referencia antes de llamar a `openai/gpt-image-2` en Replicate. Los mensajes se expanden por partido y destinatario, y cada tarjeta conserva esa misma correlacion durante toda la rama de imagen.

El workflow espera hasta 60 segundos en la llamada inicial a Replicate y, si la prediccion sigue en proceso, consulta el estado cada 20 segundos hasta 30 veces. Cuando Replicate devuelve la URL final, el nodo `Download Replicate image` descarga la imagen a binario de n8n en la propiedad `data`. Para subirlo a WhatsApp, usar `data` como binary/input data field.

## Workflow con ventana de respuesta de WhatsApp

El workflow local `workflows/World Cup 2026 match alerts v1.0.9-24h-reply-window-template.json` corresponde al workflow n8n `8MM47MpTtqYqanmt`.

Usa dos tablas:

- `worldcup_whatsapp_contact_state` (`ySSXtg9FkL3rsrJB`) conserva el mensaje entrante mas reciente por `wa_id`.
- `worldcup_whatsapp_match_alert_state` (`jYxndE3gFhKPqwU3`) conserva estado por `match_id + recipient_wa_id`, incluyendo resultados del template, texto e imagen.

Los telefonos mexicanos se guardan y comparan con el `wa_id` canonico que devuelve Meta. El workflow normaliza el identificador recibido, lo propaga como `phone_number` y `recipientWaId`, y deriva `recipientPhoneNumber` en el formato aceptado por el endpoint de WhatsApp.

Comportamiento:

- La ventana de 24 horas se abre solo con mensajes entrantes.
- Con ventana abierta, el texto se envia primero y completa la alerta cuando WhatsApp lo acepta.
- Con ventana cerrada, se guarda una alerta pendiente y se envia `world_cup_reply_to_continue|es_MX` una sola vez por partido.
- Una respuesta reanuda solamente el partido pendiente mas reciente. Los anteriores se marcan como reemplazados.
- Ningun partido pendiente se reenvia despues de 90 minutos de su hora de inicio.
- La imagen se procesa despues del texto. Dos partidos simultaneos conservan dos textos y dos imagenes independientes.
- El envio inicial de imagen se guarda como `accepted` cuando Meta devuelve el `wamid`. El trigger de WhatsApp recibe despues los estados `sent`, `delivered`, `read` o `failed` y actualiza `image_status` usando ese mismo `wamid`. `delivered` confirma que la imagen llego al dispositivo del destinatario; `read` confirma apertura cuando los recibos de lectura estan disponibles.
- Las imagenes usan `openai/gpt-image-2`: espera inicial de 60 segundos y consultas cada 20 segundos, hasta 30 veces.

`Manual test settings` usa `2026-06-24T18:50:00.000Z`, que selecciona M011 y M012 simultaneamente. Por defecto descarga una imagen estatica y no escribe estado persistente. Cambiar `useStaticTestImage` a `false` para probar Replicate. La prueba manual todavia envia mensajes reales de WhatsApp.

Antes de activar, verificar credenciales, IDs de tablas, aprobacion del template y que no exista otro workflow de alertas activo.

## Instrucciones visuales publicas

La interfaz publica vive en `docs/` y se publica con GitHub Pages desde la rama `main`:

```text
https://elyager.github.io/datos-del-mundial-2026/
```

La pagina permite:

1. Elegir una persona usando los nombres e imagenes de `people.json`.
2. Elegir `Todas las selecciones` o una seleccion asignada que conserve partidos pendientes.
3. Agregar una instruccion visual de hasta 500 caracteres.

El navegador envia las instrucciones al workflow independiente de n8n `World Cup 2026 public custom instructions API` (`TEXPHGaOxUgUhNzk`):

```text
POST https://workflows.loboyosa.com/webhook/worldcup-custom-instructions
GET  https://workflows.loboyosa.com/webhook/worldcup-custom-instructions
```

El `POST` acepta:

```json
{
  "personKey": "nikito",
  "teamCode": "*",
  "instruction": "Agrega una bandera de Brasil en la mano derecha.",
  "website": ""
}
```

`teamCode: "*"` aplica a todas las selecciones asignadas a la persona. El campo `website` es un honeypot y debe permanecer vacio.

Las filas se guardan en la tabla de n8n `worldcup_custom_image_instructions` (`GxRHepJNUSLkccE2`) con `person_key`, `team_code`, `instruction`, `active`, `created_at` y `source_hash`. Para retirar una instruccion sin borrar el historial, cambiar su campo `active` a `false`.

El endpoint limita cada origen a cinco instrucciones por hora usando un hash SHA-256; no guarda la IP original. El `GET` devuelve solo filas activas y nunca expone `source_hash`.

El workflow de alertas v1.0.9 consulta este endpoint antes de construir la tarjeta. Para cada persona agrega primero las instrucciones con `team_code="*"` y despues las de la seleccion actual, conservando el orden de creacion. Si el endpoint no responde, la alerta continua sin instrucciones publicas.

`people.json` y `notification-data.json.people` no guardan instrucciones personalizadas. La tabla de n8n es la unica fuente persistente.

## Resumen diario de partidos

El archivo `workflows/World Cup 2026 daily match summary v1.0.0.json` contiene un workflow independiente que todos los dias a las 8:00 AM (`America/Mexico_City`) arma un solo mensaje con los partidos de la fecha y sus horarios para Sonora 🥩 y Guadalajara/Michoacan 🍓.

- Importar el JSON en n8n y confirmar la credencial `WhatsApp account` y la tabla `worldcup_whatsapp_contact_state`.
- Para probar otra jornada, editar `testDate` en el nodo `Manual test date` con formato `YYYY-MM-DD` y ejecutar `Manual test trigger`.
- El workflow no envia nada en fechas sin partidos. Si un destinatario esta fuera de la ventana de respuesta de 24 horas, envia `world_cup_reply_to_continue|es_MX` en lugar del resumen.
- Activar este workflow solo despues de validar manualmente los destinatarios y el template. El workflow v1.0.9 debe conservar su trigger de mensajes entrantes para actualizar la tabla de estado.
