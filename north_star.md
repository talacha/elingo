# North Star — ELI (Tutor Nexo)

> Versión 2 · 2026-09-18 · Fuente de verdad del **qué** y el **por qué**. Si un cambio de código contradice este documento, gana el documento; si el documento está equivocado, se cambia primero el documento y se anota en el registro de decisiones.

## Misión

ELI es un tutor de estudio por IA para alumnas y alumnos de **K-12** (de kínder a 12.º grado; por defecto 6.º, 11-12 años) que los ayuda con **cualquier tarea**, en **español o en inglés**, **guiándolos paso a paso sin darles nunca la respuesta**.

## Para quién

- **Usuaria principal**: una niña o un niño de entre 5 y 18 años (el nivel se elige en el perfil; sin cuenta, 6.º grado) con una tarea, de la asignatura que sea, en la que "se ha trabado" en un punto concreto. Usa el móvil o el portátil de casa. Escribe —o habla, o manda una foto— a veces con faltas y sin contexto. **La interfaz está en español, pero las escuelas de México son bilingües: la tarea puede llegar en español o en inglés.**
- **Usuario secundario**: madre o padre que quiere confiar en la herramienta (segura, sin respuestas regaladas) y saber que se usa.
- **Contexto de uso**: sesiones cortas (5-20 minutos) después del colegio, con paciencia limitada. Cada respuesta debe ser corta, clara y accionable.

## Regla de oro

ELI **nunca da el resultado ni redacta textos completos**. Guía con el método socrático: pregunta, desglosa, pide identificar los datos, corrige en positivo. Esto no es un ajuste de tono: es el producto. Cualquier atajo que "resuelva por ella" es un bug de máxima prioridad.

## Reglas de producto

Decisiones del propietario, en firme. Si el código las contradice, el bug es el código.

1. **ELI no maneja asignaturas.** No hay selector, ni Mates/Lengua/Ciencias, ni ejemplos etiquetados, ni `subject` en la API ni en el prompt. La niña cuenta su problema y ELI lo guía, sea de lo que sea.
2. **El nivel escolar es K-12 y forma parte del prompt.** Se elige en el perfil (kínder y 1.º-12.º); el prompt adapta vocabulario, profundidad y ejemplos a ese nivel. Sin cuenta, 6.º.
3. **Tareas en español o en inglés; interfaz en español.** ELI responde en el idioma en que le escribe la alumna (español por defecto). Si escribe en español sobre una tarea en inglés, explica en español y cita el inglés.
4. **Solo la respuesta final.** La niña nunca ve el razonamiento del modelo ni su borrador: se recorta, y una respuesta que arranca como razonamiento se descarta y se reintenta con otro modelo.
5. **Modelos gratuitos primero; de pago solo donde no hay gratuito.** Un modelo para responder (`base_model`), uno gratuito que **entiende** imágenes (`visual_model`: comprende la foto de la tarea, nunca genera imágenes) y modelos de voz (STT y TTS, con respaldo). Comprender vídeo es opcional: el modelo visual por defecto ya lo acepta, la app aún no lo envía. Cada modelo tiene respaldo si falla o tarda (20 s).
6. **Voz: graba y contesta con voz.** La alumna dicta su pregunta (navegador nativo o grabación transcrita); si **la petición fue hablada**, la respuesta de ELI se lee sola al terminar. Es la única excepción a que «Escuchar» sea manual. Si la pregunta fue escrita, la voz es un botón.
7. **Funciones activables por cuenta (feature flags).** Modo voz (`voice_mode`) y modo imagen (`image_mode`): se pueden apagar para todos y por cuenta (los interruptores de `/parents` son estos flags). Apagado, la interfaz oculta el micrófono o la cámara **y** el servidor lo rechaza.
8. **Toda la configuración está definida en un único registro y se guarda en Postgres**, con caché en Redis para cargarla rápido; un administrador la cambia desde `/admin` sin redeploy. Los secretos y las conexiones se quedan en variables de entorno.
9. **La espera es amable.** Mientras llega la respuesta, «ELI está pensando…» va rotando frases cortas y cálidas para una niña, con una animación suave (sin movimiento si el sistema pide reducirlo).
10. **`/admin` tiene tres secciones** (`/admin/users`, `/admin/config`, `/admin/features`) y su acceso se decide en el servidor: sin permiso, un 404 que no revela que existe.

## Prompt de sistema (literal; no se edita sin una decisión registrada)

```text
Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria. REGLAS: 1. TONO: Claro, dinámico, sin tecnicismos complejos. 2. REGLA DE ORO: NUNCA des el resultado, ni redactes textos completos. Guía paso a paso (método socrático). 3. PROBLEMAS: Desglosa problemas, pide identificar datos primero. 4. ANALOGÍAS: Usa analogías del siglo XXI (videojuegos, vida cotidiana). Haz preguntas de 'trivia rápida'. 5. CORRECCIÓN POSITIVA: Nunca digas 'No'. Di 'Buen intento, revisemos el paso anterior'. 6. FORMATO: Párrafos de max 3 líneas, uso de negritas y viñetas.
```

**Nivel escolar (T-081, decisión registrada).** El bloque de arriba es el prompt del grado por defecto (6.º). Para otro grado K-12 (`lib/contracts/grade.ts`) `buildSystemPrompt(grado)` sustituye **solo** la frase «estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria.» por «estudiantes de {grado} ({edad} años). Tu objetivo es prepararlos para el siguiente nivel escolar. Adapta el vocabulario, la profundidad y los ejemplos a ese nivel.»; las seis reglas no cambian. Con el grado por defecto el resultado es idéntico byte a byte al bloque de arriba, y `tests/ai/prompt.test.ts` sigue comparándolo con este documento.

**Sin asignaturas (T-088, decisión registrada).** Las reglas 3 y 4 antes se llamaban «MATEMÁTICAS» y «ESPAÑOL/CIENCIAS». Se renombran a «PROBLEMAS» y «ANALOGÍAS» y su contenido no cambia: ELI ya no distingue asignaturas.

**Estilo de respuesta (mensaje de sistema aparte, `REPLY_STYLE_HINT`).** Va como un segundo mensaje, sin tocar el literal de arriba: responder únicamente con el mensaje final, sin mostrar análisis ni razonamiento; las tareas pueden estar en español o en inglés y se responde en el idioma de la alumna (si escribe en español sobre una tarea en inglés, explicar en español y citar el inglés; si no está claro, español).

Vive en `lib/ai/prompt.ts` como la constante `ELI_SYSTEM_PROMPT`. Si se añaden ejemplos (few-shot), van en el mismo bloque de sistema para mantener estable el prefijo cacheable.

## Cómo sabemos que hemos terminado (criterios de éxito de la demo)

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | El chat funciona en `https://eli.ngo` desde un móvil | Abrir, escribir "Tengo este problema: … me trabé en …", recibir guía |
| 2 | Primer token en menos de 3 s (p50) | Log de latencia/TTFB en `/api/chat`; `ANTHROPIC_EFFORT=low`; salidas cortas |
| 3 | Respuestas en el idioma de la alumna (español por defecto, inglés si escribe o la tarea está en inglés), párrafos de ≤ 3 líneas, negritas y viñetas, y **nunca el razonamiento del modelo** | Revisión manual de 10 conversaciones reales; tests de `ReplyFilter` |
| 4 | Nunca da la respuesta final | Test de "trampa" (pedir la solución directa) en `pnpm smoke`; ELI redirige |
| 5 | El historial completo se guarda de forma asíncrona en Neon | Una fila en `messages` por mensaje; el chat no espera a la base de datos |
| 6 | Rate limit activo | Respuesta 429 amable al superar 20 mensajes en 10 minutos |
| 7 | Coste acotado | Presupuesto diario de tokens; 503 amable al agotarlo; coste por conversación visible en logs |
| 8 | Todo funciona sin claves | `pnpm check` y `pnpm smoke` pasan en CI con `AI_PROVIDER=mock` y sin secretos |
| 9 | La configuración se cambia sin redeploy | `/admin/config` guarda en Postgres, invalida Redis y el siguiente chat ya la usa; tests de `lib/config` |
| 10 | Un flag apagado se nota en la interfaz y el servidor lo hace cumplir | Con `voice_mode`/`image_mode` apagado, `/api/chat/capabilities` oculta el botón y `/api/chat`, `/api/speech` y `/api/transcribe` lo rechazan |
| 11 | La foto de la tarea se entiende y un fallo del modelo no la deja sin respuesta | Con foto, si el modelo visual da 429 o tarda, responde el modelo visual de respaldo (tests del proveedor) |
| 12 | Pregunta hablada, respuesta con voz | Tras dictar la pregunta, la respuesta se lee sola; tras escribirla, no (tests de `useTutorChat`) |

## No-objetivos de la v1

- Interfaz en varios idiomas: la interfaz es solo español. (Las tareas y las respuestas sí pueden ser en inglés.)
- Asignaturas fijas, selector de asignatura o informes por asignatura.
- Generar imágenes o vídeo: la visión sirve para entender la foto de la tarea.
- Conversación de voz continua en tiempo real: la voz es push-to-talk (pulsar, hablar, soltar) y ELI contesta con voz solo cuando la petición fue hablada; nunca un agente de voz siempre escuchando.
- Panel docente, notas, informes, comunicación con el colegio.
- Apps nativas: es una web móvil-first.
- Gamificación compleja (unas rachas simples quedan para M5).

## Guardrails

- **Seguridad infantil**: si el modelo termina con `stop_reason: "refusal"`, la niña ve un mensaje fijo y amable ("Eso no puedo ayudarte a resolverlo aquí, pero si quieres seguimos con tus deberes"). Nunca ve errores técnicos.
- **Privacidad**: sin datos personales en logs (solo identificadores); el chat no pide datos personales; el historial va ligado a un identificador anónimo hasta que exista autenticación; ninguna imagen ni audio de la alumna se guarda.
- **Coste**: modelos gratuitos por defecto, ventana deslizante de 6 pares de mensajes, `max_tokens` bajo, `effort: low`, entrada máxima de 1.000 caracteres, presupuesto diario global de tokens. Los límites se ajustan desde `/admin/config`.
- **Solo la respuesta final**: el razonamiento del modelo (`<think>…</think>` o un «proceso de pensamiento» al principio de la respuesta) nunca llega a la niña. Un modelo que falla, se cuelga (20 s sin texto), termina sin texto o devuelve razonamiento se sustituye por el modelo de respaldo; si también falla, ve el aviso amable.
- **Sin respuestas regaladas**: el prompt de sistema es la primera línea de defensa; el test de "trampa" del smoke es la segunda; una evaluación manual con clave real, la tercera.

## Stack (fijo para la v1) y por qué

| Capa | Elección | Por qué |
|---|---|---|
| Web | Next.js 16 App Router, TypeScript estricto, Tailwind 4, pnpm | Streaming nativo en Route Handlers y despliegue directo en Vercel |
| IA | OpenRouter con modelos gratuitos por defecto (chat, visión y voz con una sola clave; una clave propia de Google AI Studio se conecta en los ajustes de OpenRouter); Anthropic API (`claude-fable-5-1`) como alternativa; mock sin clave | Una clave para chat, imagen y voz, con modelos gratuitos y respaldo. El SDK oficial de Anthropic expone caché de prompt, `effort` y `fallbacks`. La interfaz `TutorProvider` permite cambiar de proveedor por env var o desde `/admin` |
| Base de datos | Neon (Postgres) con Drizzle ORM y SQL versionado en `drizzle/` | Serverless, gratis para empezar, migraciones en el repo. Guarda también la configuración (`app_config`) y los flags por cuenta (`account_flags`) |
| Configuración | Registro único en `lib/config/registry.ts`; valores en Postgres; caché en memoria → Redis → Postgres, invalidada al escribir | Editable desde `/admin` sin redeploy y rápida de leer; los secretos no están aquí |
| Auth | Supabase Auth con `@supabase/ssr` (hito M3) | Cuentas de padres y alumno sin escribir autenticación propia |
| Caché y colas | Upstash Redis (rate limit y caché de configuración) y QStash (persistencia asíncrona) | HTTP-first, funciona en serverless sin conexiones persistentes |
| Despliegue | Vercel, dominio `eli.ngo` | Requisito del plan |

## Barra de calidad

- `pnpm check` (lint + typecheck + test + build) en verde es condición para fusionar; CI lo exige en `main`.
- Cada módulo con lógica tiene tests (vitest). El flujo de chat tiene un smoke test con el mock y, más adelante, un e2e con Playwright.
- TypeScript estricto, sin `any` sin justificar; zod en todas las entradas HTTP.
- Sin secretos en el repo; `.env.example` siempre al día.
- UI en español, accesible (contraste AA, uso con teclado, `prefers-reduced-motion`), móvil primero.
- Los cambios de modelo, esquema y prompt se prueban contra la realidad (catálogo de OpenRouter, base de datos real) antes de darlos por buenos; una migración de producción se ensaya antes en una copia.

## Registro de decisiones

| Fecha | Decisión | Motivo |
|---|---|---|
| 2026-09-17 | Anthropic API directa como proveedor principal; OpenRouter como segundo proveedor; mock sin clave | "ChatGPT Fable 5.1" en `PLAN.md` era Claude Fable 5.1 (Anthropic). El SDK oficial da caché de prompt, `effort` y `fallbacks` nativos |
| 2026-09-17 | Los agentes hacen todo lo que permitan los CLIs autenticados; nunca crean cuentas, aceptan términos ni pagan | Máxima autonomía sin riesgo económico ni legal |
| 2026-09-17 | Rama por tarea + PR + auto-merge cuando CI está verde | Concurrencia segura con rastro revisable |
| 2026-09-17 | Chat anónimo primero; Supabase Auth en M3 tras la bandera `AUTH_REQUIRED` | Demo desplegable antes; la autenticación no obliga a rehacer el chat |
| 2026-09-17 | Español en documentos y UI; inglés en código, ramas e IDs de tarea | Usuarias hispanohablantes; herramientas en inglés |
| 2026-09-17 | pnpm como gestor de paquetes | Instalado, rápido, lockfile estricto, soportado por Vercel |
| 2026-09-17 | Contratos primero, en `tasks.md` | Permite que Frontend, Backend y Data/Ops trabajen en paralelo contra la misma API |
| 2026-09-17 | Propiedad de archivos por rol y fallback local para cada servicio externo | Evita conflictos de merge y bloqueos por falta de claves |
| 2026-09-18 | M6 añade voz e imagen manteniendo el pipeline simple (`voz/imagen → texto/visión → tutor socrático → texto → voz opcional`), navegador nativo o niveles gratuitos por defecto con fallback si falta la clave; ninguna imagen ni audio de la alumna se persiste. `OPENROUTER_MODEL` pasa a `deepseek/deepseek-v4-flash-0731:free` (antes enrutaba a Fable 5.1 vía OpenRouter, duplicando coste sin motivo). El modelo de producción (`ANTHROPIC_API_KEY` activo, `claude-fable-5-1`) no cambia en este PR: es una decisión humana fuera de T-045 — cambiar `ANTHROPIC_MODEL` a `claude-sonnet-5` o `claude-haiku-4-5` (5-10× más barato que Fable 5.1 al mismo proveedor) es un cambio de una variable de entorno, no de código, cuando el humano quiera validarlo | Petición directa del propietario; el bug de "dar la respuesta" es la línea roja también para modelos nuevos, así que no se apuesta la producción a un modelo sin validar primero |
| 2026-09-18 | La configuración se define en un registro único y se guarda en Postgres (`app_config`), con caché en Redis; los secretos y conexiones siguen en variables de entorno. Precedencia: fila de Postgres > variable de entorno > valor por defecto | Ajustable sin redeploy y rápida de leer; los secretos no pueden vivir en la base a la que hace falta una credencial para llegar |
| 2026-09-18 | Feature flags `voice_mode` e `image_mode`, globales y por cuenta (activo = global **y** cuenta); los interruptores de `/parents` pasan a ser estos flags (`account_flags`); fallan abiertos | Poder apagar voz o imagen para todos o para una cuenta, y que la interfaz lo refleje; un fallo de infraestructura no debe bloquear a una niña |
| 2026-09-18 | Modelos por defecto: base `nvidia/nemotron-3.5-lightning:free` (solo texto), visual `google/gemma-4-31b-it:free`, STT `openai/whisper-large-v3-turbo` (no hay STT gratuito), TTS `fish-audio/s2.1-pro-free:free` con `hexgrad/kokoro-82m` de respaldo; respaldos de texto y de foto por separado. `/admin` valida cada modelo contra el catálogo de OpenRouter que le corresponde | Modelos gratuitos primero. Se comprobó con el catálogo que nemotron-lightning no acepta imágenes ni audio y que los modelos de voz solo aparecen con `?output_modalities=speech|transcription`. La visión es para entender, no para generar. El modelo de texto no vale de respaldo con fotos: puede no verlas |
| 2026-09-18 | Si la petición fue hablada, la respuesta se lee sola al terminar (excepción a T-056: «Escuchar» era siempre manual). Nunca tras un error o «Parar»; se corta la voz al activar el micrófono | Petición del propietario: la alumna graba una petición y ELI contesta con audio |
| 2026-09-18 | Solo la respuesta final: se recortan `<think>` y el razonamiento en claro, una respuesta que arranca como razonamiento se descarta, y un fallo, un cuelgue (20 s sin texto) o una respuesta vacía pasan al modelo de respaldo. Se pide además `reasoning: { exclude: true }` y un mensaje de estilo aparte | Un modelo gratuito mostró su «proceso de pensamiento» a la niña; otro se colgó hasta agotar los 60 s de la función (504) |
| 2026-09-18 | El nivel K-12 entra en el prompt: `buildSystemPrompt(grado)` sustituye solo la frase del nivel; con 6.º es idéntico byte a byte al literal | Que ELI responda al nivel correcto sin tocar las reglas ni romper la caché ni la comparación con este documento |
| 2026-09-18 | ELI no maneja asignaturas: fuera el selector, los ejemplos etiquetados y `subject` en la API; `/parents` muestra un único resumen de actividad; las reglas 3 y 4 del prompt pasan a «PROBLEMAS» y «ANALOGÍAS»; la columna `chat_sessions.subject` queda sin uso (sin migración de producción). Sustituye a la idea de inferir la asignatura | Petición del propietario; inferirla con palabras clave solo conocía el español y las tareas son bilingües |
| 2026-09-18 | Tareas en español o en inglés (las escuelas de México son bilingües); la interfaz sigue en español | Petición del propietario |
| 2026-09-18 | La clave propia de Gemini (Google AI Studio) se conecta en OpenRouter (Ajustes → Integraciones), no como variable de entorno de ELI | Quita los 429 del pool compartido gratuito sin código nuevo; un proveedor directo de Gemini queda como posible mejora |
| 2026-09-18 | «ELI está pensando…» rota frases amables para una niña con una animación suave, accesible (un único texto fijo para el lector de pantalla) y sin movimiento con `prefers-reduced-motion` | Petición del propietario: como el texto animado de Claude, apto para niñas |
| 2026-09-18 | `/admin` se divide en `/admin/users`, `/admin/config` y `/admin/features`; el acceso se decide en el servidor (404 sin permiso, sin título en los metadatos) y nunca se prerenderiza | Petición del propietario; el 404 no debe revelar que la ruta existe |
| 2026-09-19 | El esquema de producción se reconcilió con las migraciones del repo (rama de respaldo en Neon, ensayo en una copia, transacción atómica y anotación en el libro de Drizzle): la base había aplicado un borrador anterior de la migración 0001 y `/api/chat` fallaba con sesión iniciada | Un `/api/chat` con error 500 para toda cuenta con sesión; el CI no tiene `DATABASE_URL`, así que nada lo detectaba |
