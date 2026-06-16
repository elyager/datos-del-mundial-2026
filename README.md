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
  "team2ShirtUrl": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/jerseys/MAR.webp",
  "person1ImageInstruction": "Optional visual instruction for Nikito",
  "person2ImageInstruction": "Optional visual instruction for Noe"
}
```

El workflow valida que los campos requeridos existan, que las cuatro URLs usen `http` o `https`, y que los nombres conocidos de participantes usen su imagen correspondiente antes de llamar a `sourceful/riverflow-v2.5-pro` via `https://api.replicate.com/v1/models/sourceful/riverflow-v2.5-pro/predictions`. Los campos `person1ImageInstruction` y `person2ImageInstruction` son opcionales. Los mensajes de texto se expanden a los dos numeros configurados antes del nodo WhatsApp, mientras que la tarjeta generada se envia una sola vez al destinatario de imagen configurado.

El workflow espera hasta 60 segundos en la llamada inicial a Replicate y, si la prediccion sigue en proceso, consulta el estado cada 20 segundos hasta 30 veces. Cuando Replicate devuelve la URL final, el nodo `Download Replicate image` descarga la imagen a binario de n8n en la propiedad `data`. Para subirlo a WhatsApp, usar `data` como binary/input data field.
