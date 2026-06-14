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

## Static assets

Las imagenes publicas del repositorio viven en `assets/images/`.

Las camisetas locales de selecciones viven en `assets/images/jerseys/`.

URLs publicas para campos de imagen en n8n como `person1Url` o `person2Url`:

```text
https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/yager.jpeg
https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/nere.jpeg
```

## Workflow de tarjetas con OpenRouter

El archivo `n8n-openrouter-image-card-workflow.json` contiene un workflow importable en n8n para generar una tarjeta cuadrada de enfrentamiento con OpenRouter.

Requisitos:

- Crear una credencial de n8n tipo `HTTP Header Auth` llamada `OpenRouter Bearer Token`.
  - `Name`: `Authorization`
  - `Value`: `Bearer sk-or-tu-api-key`
- Importar `n8n-openrouter-image-card-workflow.json` en n8n.
- Seleccionar la credencial `OpenRouter Bearer Token` en el nodo HTTP de OpenRouter si n8n no la enlaza automaticamente al importar.
- Para una prueba rapida desde n8n, ejecutar el nodo `Manual test trigger`; este usa el nodo `Mock image card input` como entrada de ejemplo.
- Enviar un `POST` al webhook `openrouter-image-card` con los campos estructurados de la tarjeta.

Ejemplo de cuerpo:

```json
{
  "team1": "Brasil",
  "team2": "Marruecos",
  "person1Name": "Nikito",
  "person2Name": "Noe",
  "venue": "MetLife Stadium",
  "location": "New York/New Jersey",
  "person1Url": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/yager.jpeg",
  "person2Url": "https://raw.githubusercontent.com/elyager/datos-del-mundial-2026/main/assets/images/people/nere.jpeg",
  "team1ShirtUrl": "https://store.fifa.com/cdn/shop/files/image_02047e33-3b4e-41f2-869b-ac361dd4b283.jpg",
  "team2ShirtUrl": "https://store.fifa.com/cdn/shop/files/image_54f59fd1-10b1-4430-b581-a46bbd87255c.jpg",
  "templateUrl": "https://picsum.photos/seed/world-cup-card-template/1024/1024"
}
```

El workflow valida que los campos requeridos existan y que las cinco URLs usen `http` o `https` antes de llamar a `openai/gpt-5.4-image-2` via `https://openrouter.ai/api/v1/chat/completions`.

El nodo `Extract generated image` convierte la respuesta `data:image/png;base64,...` a binario de n8n en la propiedad `data`. Para subirlo a WhatsApp, agregar un nodo WhatsApp de media upload despues de `Extract generated image` y usar `data` como binary/input data field.
