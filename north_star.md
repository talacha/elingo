# North Star — ELI (Tutor Nexo)

> Versión 1 · 2026-09-17 · Fuente de verdad del **qué** y el **por qué**. Si un cambio de código contradice este documento, gana el documento; si el documento está equivocado, se cambia primero el documento y se anota en el registro de decisiones.

## Misión

ELI es un tutor de estudio por IA para alumnas y alumnos de 6º de primaria (11-12 años) que los prepara para secundaria **guiándolos paso a paso sin darles nunca la respuesta**.

## Para quién

- **Usuaria principal**: una niña de 11-12 años con deberes de Matemáticas, Lengua o Ciencias que "se ha trabado" en un punto concreto. Usa el móvil o el portátil de casa. Escribe en español, a veces con faltas y sin contexto.
- **Usuario secundario**: madre o padre que quiere confiar en la herramienta (segura, sin respuestas regaladas) y saber que se usa.
- **Contexto de uso**: sesiones cortas (5-20 minutos) después del colegio, con paciencia limitada. Cada respuesta debe ser corta, clara y accionable.

## Regla de oro

ELI **nunca da el resultado ni redacta textos completos**. Guía con el método socrático: pregunta, desglosa, pide identificar los datos, corrige en positivo. Esto no es un ajuste de tono: es el producto. Cualquier atajo que "resuelva por ella" es un bug de máxima prioridad.

## Prompt de sistema (literal; no se edita sin una decisión registrada)

```text
Eres 'ELI' (Tutor Nexo), un mentor de estudio inteligente, divertido y empático para estudiantes de 6º de primaria (11-12 años). Tu objetivo es prepararlos para la secundaria. REGLAS: 1. TONO: Claro, dinámico, sin tecnicismos complejos. 2. REGLA DE ORO: NUNCA des el resultado, ni redactes textos completos. Guía paso a paso (método socrático). 3. MATEMÁTICAS: Desglosa problemas, pide identificar datos primero. 4. ESPAÑOL/CIENCIAS: Usa analogías del siglo XXI (videojuegos, vida cotidiana). Haz preguntas de 'trivia rápida'. 5. CORRECCIÓN POSITIVA: Nunca digas 'No'. Di 'Buen intento, revisemos el paso anterior'. 6. FORMATO: Párrafos de max 3 líneas, uso de negritas y viñetas.
```

Vive en `lib/ai/prompt.ts` como la constante `ELI_SYSTEM_PROMPT`. Si se añaden ejemplos (few-shot), van en el mismo bloque de sistema para mantener estable el prefijo cacheable.

## Cómo sabemos que hemos terminado (criterios de éxito de la demo)

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | El chat funciona en `https://eli.ngo` desde un móvil | Abrir, escribir "Tengo este problema: … me trabé en …", recibir guía |
| 2 | Primer token en menos de 3 s (p50) | Log de latencia/TTFB en `/api/chat`; `ANTHROPIC_EFFORT=low`; salidas cortas |
| 3 | Respuestas en español, párrafos de ≤ 3 líneas, negritas y viñetas | Revisión manual de 10 conversaciones reales |
| 4 | Nunca da la respuesta final | Test de "trampa" (pedir la solución directa) en `pnpm smoke`; ELI redirige |
| 5 | El historial completo se guarda de forma asíncrona en Neon | Una fila en `messages` por mensaje; el chat no espera a la base de datos |
| 6 | Rate limit activo | Respuesta 429 amable al superar 20 mensajes en 10 minutos |
| 7 | Coste acotado | Presupuesto diario de tokens; 503 amable al agotarlo; coste por conversación visible en logs |
| 8 | Todo funciona sin claves | `pnpm check` y `pnpm smoke` pasan en CI con `AI_PROVIDER=mock` y sin secretos |

## No-objetivos de la v1

- Varios idiomas: solo español.
- Subir fotos o imágenes de los deberes (queda para M5).
- Panel docente, notas, informes, comunicación con el colegio.
- Apps nativas: es una web móvil-first.
- Gamificación compleja (unas rachas simples quedan para M5).

## Guardrails

- **Seguridad infantil**: si el modelo termina con `stop_reason: "refusal"`, la niña ve un mensaje fijo y amable ("Eso no puedo ayudarte a resolverlo aquí, pero si quieres seguimos con tus deberes"). Nunca ve errores técnicos.
- **Privacidad**: sin datos personales en logs (solo identificadores); el chat no pide datos personales; el historial va ligado a un identificador anónimo hasta que exista autenticación.
- **Coste**: ventana deslizante de 6 pares de mensajes, `max_tokens` bajo, `effort: low`, entrada máxima de 1.000 caracteres, presupuesto diario global de tokens.
- **Sin respuestas regaladas**: el prompt de sistema es la primera línea de defensa; el test de "trampa" del smoke es la segunda; una evaluación manual con clave real, la tercera.

## Stack (fijo para la v1) y por qué

| Capa | Elección | Por qué |
|---|---|---|
| Web | Next.js 16 App Router, TypeScript estricto, Tailwind 4, pnpm | Streaming nativo en Route Handlers y despliegue directo en Vercel |
| IA | Anthropic API con el SDK oficial (`@anthropic-ai/sdk`), modelo `claude-fable-5-1`; OpenRouter como segundo proveedor; mock sin clave | Fable 5.1 es el modelo pedido en `PLAN.md` ("ChatGPT Fable 5.1" era este modelo). El SDK oficial expone caché de prompt, `effort` y `fallbacks`. La interfaz `TutorProvider` permite cambiar de proveedor por env var |
| Base de datos | Neon (Postgres) con Drizzle ORM y SQL versionado en `drizzle/` | Serverless, gratis para empezar, migraciones en el repo |
| Auth | Supabase Auth con `@supabase/ssr` (hito M3) | Cuentas de padres y alumno sin escribir autenticación propia |
| Caché y colas | Upstash Redis (rate limit) y QStash (persistencia asíncrona) | HTTP-first, funciona en serverless sin conexiones persistentes |
| Despliegue | Vercel, dominio `eli.ngo` | Requisito del plan |

## Barra de calidad

- `pnpm check` (lint + typecheck + test + build) en verde es condición para fusionar; CI lo exige en `main`.
- Cada módulo con lógica tiene tests (vitest). El flujo de chat tiene un smoke test con el mock y, más adelante, un e2e con Playwright.
- TypeScript estricto, sin `any` sin justificar; zod en todas las entradas HTTP.
- Sin secretos en el repo; `.env.example` siempre al día.
- UI en español, accesible (contraste AA, uso con teclado), móvil primero.

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
