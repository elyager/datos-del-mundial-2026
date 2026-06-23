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

El archivo `data/worldcup-2026/people.json` es la fuente canonica para participantes de tarjetas. Cada entrada usa una llave normalizada, como `nikito` o `noe`, e incluye `name`, `imageUrl` y opcionalmente `imageInstruction`. Usa `imageInstruction` para instrucciones visuales reutilizables de esa persona; el workflow las agrega al prompt, pero no las renderiza como texto visible.

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

El workflow valida que los campos requeridos existan, que las cuatro URLs usen `http` o `https`, y que los nombres conocidos de participantes usen su imagen correspondiente antes de llamar a `sourceful/riverflow-v2.5-pro` via `https://api.replicate.com/v1/models/sourceful/riverflow-v2.5-pro/predictions`. Los campos `person1ImageInstruction` y `person2ImageInstruction` son opcionales; si no llegan en el webhook, el workflow los toma de `people.json` cuando el participante tiene `imageInstruction`. Los mensajes de texto se expanden a los destinatarios configurados antes del nodo WhatsApp, mientras que la tarjeta generada se envia una sola vez al destinatario marcado con `sendGeneratedImage`.

El workflow espera hasta 60 segundos en la llamada inicial a Replicate y, si la prediccion sigue en proceso, consulta el estado cada 20 segundos hasta 30 veces. Cuando Replicate devuelve la URL final, el nodo `Download Replicate image` descarga la imagen a binario de n8n en la propiedad `data`. Para subirlo a WhatsApp, usar `data` como binary/input data field.

## Workflow con ventana de respuesta de WhatsApp

El workflow local `workflows/World Cup 2026 match alerts v1.0.9-24h-reply-window-template.json` agrega control de ventana de respuesta de 24 horas y fue subido a n8n como `8MM47MpTtqYqanmt` con el nombre `World Cup 2026 match alerts - 24h reply window template`.

Este workflow usa la tabla de n8n `worldcup_whatsapp_contact_state` (`ySSXtg9FkL3rsrJB`) para guardar `phone_number`, `last_inbound_at`, `last_inbound_message_id` y `updated_at`.

Los telefonos mexicanos se guardan y comparan con el `wa_id` canonico que devuelve Meta. Por ejemplo, `526441253654` se normaliza a `5216441253654` y se propaga como `phone_number` y `recipientWaId`. El campo de envio `recipientPhoneNumber` se deriva como `526441253654`, porque el endpoint de WhatsApp acepta ese formato y responde con el `wa_id` canonico `5216441253654`.

Comportamiento:

- El trigger `WhatsApp inbound messages` registra cada mensaje entrante y actualiza `last_inbound_at`.
- Si `last_inbound_at` tiene menos de 24 horas, `Send match alert` envia el mensaje normal.
- Si no existe registro o ya pasaron 24 horas, `Send reply-to-continue template` envia el template aprobado para pedir que la persona responda y continue.
- `Allow generated image recipient` evita mandar la imagen generada al destinatario fijo cuando ese destinatario esta fuera de la ventana de 24 horas. La salida falsa conserva `last_inbound_at` y `templateReason` para mostrar el motivo sin marcar la ejecucion como fallida.

Antes de activar este workflow, confirmar que el nodo `Route alert recipients by reply window` usa el template aprobado correcto en `TEMPLATE_NAME` y `TEMPLATE_LANGUAGE`. El valor inicial es `world_cup_reply_to_continue|es_MX`. Mantener desactivado el workflow anterior o este workflow para evitar alertas duplicadas.

Para probar manualmente sin generar una imagen con Replicate, el nodo `Manual test time` incluye `useStaticTestImage: true` y `staticTestImageUrl`. `Select image source` envia esa URL por `Download static test image` y omite completamente los nodos de Replicate. Las ejecuciones programadas no pasan por `Manual test time`, por lo que siguen generando la imagen normalmente. Cambiar `useStaticTestImage` a `false` para probar Replicate desde el trigger manual.

## Resumen diario de partidos

El archivo `workflows/World Cup 2026 daily match summary v1.0.0.json` contiene un workflow independiente que todos los dias a las 8:00 AM (`America/Mexico_City`) arma un solo mensaje con los partidos de la fecha y sus horarios para Sonora 🥩 y Guadalajara/Michoacan 🍓.

- Importar el JSON en n8n y confirmar la credencial `WhatsApp account` y la tabla `worldcup_whatsapp_contact_state`.
- Para probar otra jornada, editar `testDate` en el nodo `Manual test date` con formato `YYYY-MM-DD` y ejecutar `Manual test trigger`.
- El workflow no envia nada en fechas sin partidos. Si un destinatario esta fuera de la ventana de respuesta de 24 horas, envia `world_cup_reply_to_continue|es_MX` en lugar del resumen.
- Activar este workflow solo despues de validar manualmente los destinatarios y el template. El workflow v1.0.9 debe conservar su trigger de mensajes entrantes para actualizar la tabla de estado.
