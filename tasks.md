# tasks.md — Tablero vivo de ELI

> Cola de trabajo y estado del proyecto. Lo leen y actualizan agentes autónomos. Cambia solo lo que te toca: **tu fila** en la tabla de estado (sección 7) y, si descubres trabajo nuevo, **una fila en la Bandeja** (sección 9). El resto del archivo es estable.

## 0. Instrucción para cada agente

> **Pick the single highest-leverage next step toward the goal and execute it, then update tasks.md.**

En la práctica: elige la única tarea que más acerque al objetivo de `north_star.md`, ejecútala completa, deja `tasks.md` actualizado, informa y para. **Una tarea por invocación.**

## 1. Protocolo (7 pasos)

### Paso 1 — Contexto
- Lee `north_star.md`, `roadmap.md` y este archivo entero.
- `git fetch origin --prune` y `git log --oneline -5 origin/main`.

### Paso 2 — Elegir la tarea
Candidatas: filas de la sección 7 con estado `todo` cuyas dependencias estén todas `done` (o no tengan). Las tareas `HU` son del humano: nunca las tomes. Orden de prioridad:
1. Tareas de **tu rol**. Solo tomas una de otro rol si ninguna de tu rol está desbloqueada (así los tres carriles avanzan en paralelo y no compiten por la misma tarea).
2. Mayor valor en la columna **Desbloquea** (número de tareas que dependen de ella directa o transitivamente; recalcúlalo si la tabla cambió).
3. Hito más temprano (M0 < M1 < M2 < M3 < M4).
4. ID más bajo.

Si no hay candidatas: informa "sin tareas desbloqueadas para <rol>", lista qué las bloquea y para.

### Paso 3 — Bloquear la tarea (lock)
- Comprueba que nadie la tiene: `git ls-remote --heads origin 'agent/T-0xx-*'` debe devolver vacío y `gh pr list --state open --search "T-0xx"` no debe listar nada. Si está tomada, vuelve al paso 2.
- Crea la rama desde `origin/main` y publícala **ya** (la rama publicada es el lock):
  ```bash
  git switch -c agent/T-0xx-<slug> origin/main && git push -u origin HEAD
  ```
- Marca tu fila como `in-progress` y escribe en **Resultado** `in-progress · <rol> · <fecha>`. Commit `T-0xx: in progress` y push.
- **No abras el PR todavía.** Si quieres CI o un preview antes del paso 6, ábrelo como borrador: `gh pr create --draft --title "T-0xx: <título> (en curso)"`. Un PR normal abierto a medias puede fusionarse desde GitHub antes de que termines y borra tu rama de lock.

### Paso 4 — Ejecutar
- Toca solo los archivos de tu rol (sección 3) y los que liste la tarea. En archivos compartidos, cambios mínimos y aditivos.
- Implementa con tests. Sin secretos en el repo. Todo servicio externo debe funcionar con su fallback local (sección 6.6).
- `pnpm check` en verde antes de seguir.

### Paso 5 — Actualizar tasks.md
- Tu fila: estado `done` y **Resultado** en una línea (qué se hizo, número de PR, URL de preview si aplica).
- Trabajo descubierto fuera del alcance: añade una fila en la **Bandeja** con ID `N-<tu tarea>-<n>` (por ejemplo `N-T011-1`), nunca un número correlativo: dos agentes eligen el mismo a la vez. Nunca amplíes el alcance en silencio.
- Si no puedes terminar: estado `blocked` y el motivo en **Resultado**.

### Paso 6 — Integrar
```bash
git fetch origin && git rebase origin/main   # .gitattributes: tasks.md merge=union resuelve los apéndices
node scripts/tasks-check.mjs --fix           # union duplica filas adyacentes: conserva la versión más avanzada de cada ID
git diff --quiet tasks.md || git commit -am "T-0xx: dedupe tasks.md"
pnpm check                                   # obligatorio si el rebase trajo cambios de código; tests/tasks.test.ts falla si quedan IDs repetidos
git push --force-with-lease
gh pr create --title "T-0xx: <título corto>" --body "Cierra T-0xx. <qué se hizo>. Verificación: <comando>."   # si lo abriste como borrador: gh pr ready && gh pr edit --title "T-0xx: <título corto>"
gh pr merge --auto --squash --delete-branch || gh pr merge --squash --delete-branch
```
La segunda orden solo se usa si auto-merge no está disponible todavía (antes de T-002).
**Excepción única**: `T-001` (bootstrap, aún no hay CI) se integra con `git push origin HEAD:main` desde su rama.

### Paso 7 — Esperar e informar
- `gh pr checks --watch`. Si falla, corrige y push. Si aparece conflicto, repite el paso 6.
- Tope 15 minutos: si no fusiona, marca `blocked` (commit en tu rama) e informa.
- Informe final en ≤ 10 líneas: tarea, PR, estado del merge, qué queda desbloqueado, riesgos. Después **para**. No empieces otra tarea.

## 2. Estados y roles

| Estado | Significado |
|---|---|
| `todo` | Lista para tomar cuando sus dependencias estén `done` |
| `in-progress` | Tomada; existe la rama `agent/T-0xx-*` en `origin` |
| `done` | Fusionada en `main` y verificada |
| `blocked` | No se puede terminar; el motivo está en Resultado |
| `new` | Descubierta por un agente; el humano la promueve a `todo` |

| Rol | Nombre del sub-agente | Ámbito |
|---|---|---|
| FE | `frontend` | UI/UX, componentes, diseño, accesibilidad |
| BE | `backend` | Route Handlers, integración de IA, ventana deslizante, guardas de coste, scripts |
| DO | `data-ops` | Neon, Drizzle, Upstash, QStash, Supabase, CI, Vercel |
| HU | humano | Cuentas, claves, términos, dominio, lanzamiento |

## 3. Propiedad de archivos

| Rol | Archivos |
|---|---|
| FE | `app/(app)/**`, `components/**`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx` |
| BE | `app/api/**`, `lib/ai/**`, `scripts/**` |
| DO | `lib/db/**`, `lib/ratelimit/**`, `lib/queue/**`, `lib/supabase/**`, `drizzle/**`, `.github/**`, `vercel.json`, `middleware.ts`, `drizzle.config.ts` |
| Compartidos (cambios mínimos y aditivos) | `package.json`, `pnpm-lock.yaml`, `.env.example`, `lib/env.ts`, `lib/contracts/**`, `tasks.md`, `README.md` |

Una tarea puede listar archivos fuera de tu rol: en ese caso puedes tocarlos.

## 4. Límites de autonomía

**Sin pedir permiso**: `pnpm` (instalar, añadir dependencias, tests, build), `git` (ramas, commits, push de tu rama), `gh` (PRs, checks, y los ajustes de repositorio que exige el protocolo: auto-merge, borrado de ramas, ruleset de `main`), `vercel` (`link`, `env`, `deploy`, `git connect`, `integration add` solo si los términos ya están aceptados), `upstash` (`start-redis`, y `redis create` si hay login), `npx neonctl` con `NEON_API_KEY`, `npx supabase` con `SUPABASE_ACCESS_TOKEN`.

**Nunca**: crear cuentas; aceptar términos legales (`vercel integration accept-terms`, marketplaces); introducir datos de pago o comprar dominios; borrar bases de datos, proyectos o recursos de producción; `git push --force` a `main`; subir secretos al repo; desactivar o saltarse checks de CI; cambiar el modelo de producción fuera de T-045.

Si algo requiere al humano, escríbelo en **Resultado** y sigue con lo que sí puedes hacer usando los fallbacks locales.

## 5. Comandos

| Comando | Qué hace | Desde |
|---|---|---|
| `pnpm install` | Instala dependencias | T-001 |
| `pnpm dev` | Servidor de desarrollo en `http://localhost:3000` | T-001 |
| `pnpm check` | `lint` + `typecheck` + `test` + `build`. Obligatorio antes de cada PR | T-001 |
| `pnpm test` | vitest | T-001 |
| `pnpm smoke` | Arranca la app con `AI_PROVIDER=mock`, hace un POST real a `/api/chat` y comprueba el stream y la "trampa" | T-018 |
| `pnpm db:generate` / `pnpm db:migrate` | Genera SQL desde el esquema Drizzle / aplica migraciones a `DATABASE_URL` | T-020 |
| `pnpm e2e` | Playwright contra la app con mock | T-044 |

## 6. Contratos

Los tipos viven en `lib/contracts/*.ts` (creados en T-001). Cambiar un contrato exige actualizar este archivo en el mismo PR.

### 6.1 `POST /api/chat`

```ts
// lib/contracts/chat.ts
export type Subject = "mates" | "lengua" | "ciencias";

export interface ChatMessage {
  id: string;                 // uuid generado por el cliente
  role: "user" | "assistant";
  content: string;            // texto plano/markdown ligero
  createdAt?: string;         // ISO 8601
}

export interface ChatRequest {
  sessionId: string;          // uuid de la conversación, generado por el cliente
  subject?: Subject;
  messages: ChatMessage[];    // historial completo de la conversación, el último es del usuario
}

export type ChatErrorCode = "invalid_request" | "rate_limited" | "budget_exhausted" | "unauthorized" | "upstream_error";

export interface ChatError {
  error: ChatErrorCode;
  message: string;            // amable, en español, apto para mostrar a la niña
  retryAfter?: number;        // segundos (solo rate_limited)
  issues?: unknown;           // detalle de zod (solo invalid_request)
}
```

- Respuesta `200`: `Content-Type: text/plain; charset=utf-8`, cuerpo = texto de ELI en streaming (chunks de texto, sin envoltorio JSON). Cabeceras: `x-session-id`, `x-provider` (`anthropic` | `openrouter` | `mock`), `x-model`.
- Si el modelo rehúsa (`refusal`), el propio stream contiene el mensaje amable fijo `REFUSAL_MESSAGE`; el cliente no necesita tratarlo.
- Errores: `400 invalid_request`, `401 unauthorized` (solo con `AUTH_REQUIRED=true`), `429 rate_limited` (+ cabecera `Retry-After`), `503 budget_exhausted`, `500 upstream_error`. Cuerpo JSON `ChatError`.
- El servidor pone la cookie `eli_anon` (uuid, httpOnly, 1 año) si no existe; es la clave de rate limit y el `anon_id` de las sesiones anónimas.
- El servidor aplica la ventana deslizante (`AI_WINDOW_PAIRS`) antes de llamar al modelo; el historial completo se persiste de forma asíncrona (T-023).

### 6.2 Servicio de IA

```ts
// lib/contracts/ai.ts
export interface TutorTurn { role: "user" | "assistant"; content: string }

export interface TutorReplyInput {
  sessionId: string;
  subject?: Subject;
  messages: TutorTurn[];      // ya recortado por slidingWindow; solo texto, nunca bloques de thinking
  signal?: AbortSignal;
}

export interface TutorUsage { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
export type StopReason = "end_turn" | "max_tokens" | "refusal" | "error";

export interface TutorReplyResult {
  stream: ReadableStream<string>;                                  // deltas de texto
  done: Promise<{ usage: TutorUsage; model: string; stopReason: StopReason; latencyMs: number; ttfbMs: number }>;
}

export interface TutorProvider {
  readonly name: "anthropic" | "openrouter" | "mock";
  readonly model: string;
  reply(input: TutorReplyInput): Promise<TutorReplyResult>;
}

// lib/ai/service.ts
export declare function streamTutorReply(input: TutorReplyInput): Promise<TutorReplyResult>;
// lib/ai/window.ts — conserva los últimos `pairs` pares completos (user, assistant); el resultado empieza siempre por "user"
export declare function slidingWindow<T extends TutorTurn>(messages: T[], pairs?: number): T[];
// lib/ai/prompt.ts
export declare const ELI_SYSTEM_PROMPT: string;   // literal de north_star.md
export declare const REFUSAL_MESSAGE: string;     // "Eso no puedo ayudarte a resolverlo aquí, pero si quieres seguimos con tus deberes."
```

Proveedor Anthropic (SDK oficial `@anthropic-ai/sdk`, cliente `new Anthropic()` que lee `ANTHROPIC_API_KEY`):

```ts
const stream = client.messages.stream({
  model: env.ANTHROPIC_MODEL,                       // claude-fable-5-1
  max_tokens: env.AI_MAX_OUTPUT_TOKENS,
  system: [{ type: "text", text: ELI_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
  output_config: { effort: env.ANTHROPIC_EFFORT },  // low por defecto: latencia baja para un chat infantil
  messages,                                         // sin temperature ni thinking: Fable 5.1 los rechaza
});
stream.on("text", (delta) => controller.enqueue(delta));
const final = await stream.finalMessage();          // final.usage, final.stop_reason
```

- `stop_reason === "refusal"` → emitir `REFUSAL_MESSAGE` en el stream y `stopReason: "refusal"`.
- Errores tipados del SDK (`Anthropic.RateLimitError`, `Anthropic.APIError`) → `upstream_error` con mensaje amable.
- Opcional (`ANTHROPIC_FALLBACK_MODEL`): `client.beta.messages.stream({ betas: ["server-side-fallback-2026-06-01"], fallbacks: [{ model }], ... })`.
- El prompt de sistema (~200 tokens) está por debajo del mínimo cacheable; `cache_control` se deja puesto y se comprueba con `usage.cache_read_input_tokens`.
- Selección de proveedor: `AI_PROVIDER` explícito; si no, `anthropic` cuando hay `ANTHROPIC_API_KEY`, `openrouter` cuando solo hay `OPENROUTER_API_KEY`, y `mock` en cualquier otro caso.
- `MockProvider`: determinista, socrático, con negritas y viñetas, emite ~6 chunks con `MOCK_DELAY_MS` (0 en tests); si el último mensaje pide la solución ("dame la respuesta", "cuál es el resultado", "solución"), responde redirigiendo. Nunca contiene un resultado numérico final.

### 6.3 Rate limit y cola

```ts
// lib/contracts/ratelimit.ts
export interface RateLimitResult { ok: boolean; remaining: number; resetAt: number /* epoch ms */ }
export declare function checkRateLimit(key: string): Promise<RateLimitResult>;   // clave: userId ?? anonId ?? ip

// lib/contracts/queue.ts
export interface PersistJob {
  sessionId: string;
  userId?: string;
  anonId?: string;
  subject?: Subject;
  messages: Array<ChatMessage & { tokensIn?: number; tokensOut?: number; model?: string }>;  // historial completo
}
export declare function enqueuePersist(job: PersistJob): Promise<void>;   // idempotente por message.id
```

Fallbacks: sin `UPSTASH_REDIS_REST_URL`, rate limit en memoria del proceso; sin `QSTASH_TOKEN`, `enqueuePersist` ejecuta la persistencia inline (`await persistJob(job)`).

### 6.4 Sesiones

```ts
// lib/contracts/sessions.ts
export interface SessionSummary { id: string; title: string | null; subject: Subject | null; updatedAt: string }
export interface SessionsListResponse { sessions: SessionSummary[] }                  // GET /api/sessions
export interface SessionDetailResponse { session: SessionSummary; messages: ChatMessage[] }  // GET /api/sessions/:id (404 si no es tuya)
```

Ámbito: `anon_id` de la cookie `eli_anon`, o `userId` cuando hay sesión de Supabase (T-032).

### 6.5 Esquema de base de datos (Neon, Drizzle)

```sql
create table users (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id text unique,
  display_name text,
  grade text not null default '6º',
  role text not null default 'student' check (role in ('student', 'parent')),
  created_at timestamptz not null default now()
);

create table chat_sessions (
  id uuid primary key,
  user_id uuid references users(id) on delete set null,
  anon_id text,
  subject text check (subject in ('mates', 'lengua', 'ciencias')),
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table messages (
  id uuid primary key,
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  tokens_in integer,
  tokens_out integer,
  model text,
  created_at timestamptz not null default now()
);
create index messages_session_created_idx on messages (session_id, created_at);
```

Repositorio (`lib/db/repo.ts`): `upsertSession`, `insertMessages` (idempotente, `on conflict do nothing`), `listSessions({ anonId | userId })`, `getSession(id, scope)`, `upsertUserFromSupabase`. Implementaciones: `NeonRepo` con `DATABASE_URL` y `MemoryRepo` sin ella. `getRepo()` elige.

### 6.6 Variables de entorno (todas con fallback)

| Variable | Valor por defecto / fallback | Quién la usa |
|---|---|---|
| `AI_PROVIDER` | auto (`anthropic` si hay clave, si no `mock`) | T-011 |
| `ANTHROPIC_API_KEY` | vacío → mock | T-011 |
| `ANTHROPIC_MODEL` | `claude-fable-5-1` | T-011 |
| `ANTHROPIC_EFFORT` | `low` (`low` \| `medium` \| `high`) | T-011 |
| `ANTHROPIC_FALLBACK_MODEL` | vacío → sin fallbacks | T-011 |
| `OPENROUTER_API_KEY` | vacío | T-019 |
| `OPENROUTER_MODEL` | `anthropic/claude-fable-5.1` | T-019 |
| `AI_MAX_OUTPUT_TOKENS` | `1024` | T-011, T-017 |
| `AI_WINDOW_PAIRS` | `6` | T-010 |
| `AI_MAX_INPUT_CHARS` | `1000` | T-017 |
| `MOCK_DELAY_MS` | `30` (0 en tests) | T-011 |
| `DATABASE_URL` | vacío → `MemoryRepo` | T-020 |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | vacío → rate limit en memoria | T-021, T-042 |
| `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW` | `20`, `10 m` | T-021 |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | vacío → persistencia inline | T-022 |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | vacío → modo anónimo | T-030 |
| `SUPABASE_SERVICE_ROLE_KEY` | vacío (solo servidor) | T-032 |
| `AUTH_REQUIRED` | `false` | T-030, T-032 |
| `DAILY_TOKEN_BUDGET` | `2000000` | T-042 |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | T-022, T-041 |

`lib/env.ts` valida todo con zod y aplica los valores por defecto. `.env.example` lista cada variable con un comentario.

## 7. Tabla de estado

Solo se editan las columnas **Estado** y **Resultado** de tu fila. **Desbloquea** = número de tareas que dependen de esta directa o transitivamente (orientativo).

| ID | Hito | Rol | Estado | Depende de | Desbloquea | Resultado |
|---|---|---|---|---|---|---|
| T-000 | M0 | HU | todo | — | 0 | |
| T-001 | M0 | BE | done | — | 26 | 2026-09-17 · backend (orquestador) · scaffold Next 16 + tooling + `lib/env`, `lib/contracts`, stubs con fallback, landing estática en `public/landing.html` con rewrite de `/`; `pnpm check` verde; push directo a `main` |
| T-002 | M0 | DO | done | T-001 | 15 | 2026-09-17 · data-ops · PR #3 (auto-merge): workflow `ci` con job `check` (Node 24, pnpm de `packageManager`, `pnpm install --frozen-lockfile`, `pnpm check`, concurrency por rama), `.github/pull_request_template.md`, repo con `allow_auto_merge` y `delete_branch_on_merge`, ruleset `main-protection` (PR obligatorio, check `check` no estricto, sin borrado ni force-push de `main`; sin bypass para admins: si CI se rompe, editar el ruleset en la UI) |
| T-010 | M1 | BE | done | T-001 | 9 | 2026-09-17 · backend · PR #4 (auto-merge): `lib/ai/prompt.ts` (`ELI_SYSTEM_PROMPT` literal de `north_star.md` + `REFUSAL_MESSAGE`; test contra copia literal y contra el documento) y `lib/ai/window.ts` (`slidingWindow`: últimos N pares completos + pregunta pendiente, empieza siempre por `user`, trata `pairs = 0` y listas cortas, no muta la entrada); sin cambios de contrato ni de env; `pnpm check` verde |
| T-011 | M1 | BE | done | T-010 | 8 | 2026-09-17 · backend · PR #12 (auto-merge): añade `@anthropic-ai/sdk`; `lib/ai/providers/anthropic.ts` (`messages.stream` con el system literal cacheado y `output_config.effort`, sin temperature ni thinking; con `ANTHROPIC_FALLBACK_MODEL` usa `beta.messages.stream` + `fallbacks`; mapea end_turn/max_tokens/refusal; errores tipados del SDK → `stopReason: "error"` con `UPSTREAM_ERROR_MESSAGE` en el stream y uso parcial; la asignatura va como bloque de sistema aparte, tras el cacheado), `providers/mock.ts` (determinista, socrático, 6 chunks, `MOCK_DELAY_MS`, trampa → redirección, sin dígitos), `providers/stream.ts` (helper `{ stream, done }` con latencyMs/ttfbMs; `done` nunca rechaza), `providers/index.ts` (`getProvider` según `resolveProvider`; openrouter cae al mock con aviso hasta T-019), `lib/ai/service.ts` (`streamTutorReply`: descarta blancos, `slidingWindow`, `TutorInputError` si el último turno no es de la alumna, opción `{ provider }` para tests); 46 tests en `tests/ai/{mock,service,anthropic}.test.ts` con cliente falso (refusal, max_tokens, RateLimitError, fallback, abort); sin `.env.local` no hubo llamada real (ttfb y `cache_read_input_tokens` pendientes de T-000); `pnpm check` verde |
| T-012 | M1 | BE | done | T-011 | 6 | 2026-09-17 · backend · PR #18: `app/api/chat/route.ts` (`POST /api/chat`, runtime nodejs, valida `ChatRequest` con zod, cookie `eli_anon`, `checkRateLimit`, `streamTutorReply`, respuesta `text/plain` en streaming con cabeceras de 6.1, errores `ChatError`, `enqueuePersist` tras `done`); tests en `tests/api/chat.test.ts`; `pnpm check` verde |
| T-013 | M1 | FE | done | T-001 | 6 | 2026-09-17 · frontend · PR #8 (auto-merge): tokens `@theme` de Tailwind 4 en `app/globals.css` (paleta cálida de la landing con tema claro/oscuro, radios grandes, escala tipográfica fluida, contraste AA), Fredoka y Andika vía `next/font/google`, `lang="es"` y metadatos en `app/layout.tsx`, landing en `app/page.tsx` con el contenido de `public/landing.html` y botón «Empezar» → `/chat` (404 hasta T-014), `components/ui` (Button, Card, cn) y `components/landing` (mascota, logo, ejemplo de chat); eliminados el rewrite de `next.config.ts` y el archivo estático; test SSR `tests/ui/landing.test.tsx`; revisado a 375 px y 1280 px sin scroll horizontal; `pnpm check` verde |
| T-014 | M1 | FE | done | T-013 | 5 | 2026-09-17 · frontend · PR #15 (auto-merge): `/chat` con `components/chat` (ChatView, MessageList con autoscroll, MessageBubble, TypingIndicator «ELI está pensando…», ChatInput con Enter/Shift+Enter y «Parar») y `useTutorChat` (motor `createTutorChat` sin React + hook con `useSyncExternalStore`): POST `/api/chat` según 6.1, stream leído con `getReader`/`TextDecoder`, estados `idle \| streaming \| error`, errores 429/503/500/400 y de red con mensajes amables (prioridad al del servidor), `AbortController`, `sessionId` en `localStorage`, «Reintentar»; 24 tests con `fetch` simulado; revisado a 375 px contra un mock local de `/api/chat`; sin dependencias nuevas; `pnpm check` verde |
| T-015 | M1 | FE | done | T-014 | 2 | 2026-09-18 · frontend · componentes SubjectChips (3 chips para Mates/Lengua/Ciencias), Markdown (parser seguro con negritas/viñetas/saltos), EmptyState (bienvenida + 9 ejemplos); integración en ChatView/ChatInput con selector de asignatura y templates personalizados; aria-live="polite" en MessageList; focus management en input; uso de 100dvh en ChatView; 10 tests; implementado en rama de milestone `milestone/m1`, pendiente de PR |
| T-016 | M1 | DO | done | T-002 | 3 | 2026-09-17 · orquestador · proyecto `elingo/elingo` (team `elingo`) creado a mano y conectado a GitHub (producción https://elingo-elingo.vercel.app, previews por PR verdes desde #3); `AI_PROVIDER=mock` en preview y development (producción sin fijar: `resolveProvider` elige por claves; T-045 lo fija); Neon del Marketplace con prefijo `eli_` y `DATABASE_URL` copiada (T-020); Vercel Authentication sigue activa para producción: la app está tras login de Vercel hasta que el humano la pase a Standard Protection |
| T-017 | M1 | BE | todo | T-012 | 2 | |
| T-018 | M1 | BE | todo | T-012, T-014 | 1 | |
| T-019 | M1 | BE | todo | T-011 | 0 | |
| T-020 | M2 | DO | done | T-002 | 5 | 2026-09-17 · data-ops · PR #10: esquema 6.5 en Drizzle (`lib/db/schema.ts`); `drizzle/0000_init.sql` generado con drizzle-kit y aplicado a Neon (`neon-bole-compass`, recurso del Marketplace ya provisionado en el team `elingo`; una sola base para production/preview/development); `NeonRepo` (driver HTTP) y `MemoryRepo` con la misma batería de tests (`tests/db/repo.test.ts`; la parte Neon solo corre con `DATABASE_URL`, 20/20 en verde); `getRepo()` en `lib/db/index.ts`; scripts `db:generate`/`db:migrate`; `DATABASE_URL` dada de alta en Vercel (production, preview, development) como copia de `eli_DATABASE_URL`; en local `vercel env pull .env.local` |
| T-021 | M2 | DO | done | T-002 | 3 | 2026-09-17 · data-ops · PR #16: `lib/ratelimit/upstash.ts` (`UpstashRateLimiter`, `Ratelimit.slidingWindow`, `Redis.fromEnv`, prefijo `eli:rl:`, timeout 2s), `lib/ratelimit/index.ts` (selector Upstash/memoria, degrada a memoria si Redis falla), variables `KV_REST_API_URL`/`KV_REST_API_TOKEN` (nombres del Marketplace de Vercel) en `lib/env.ts` y `.env.example`; `tests/ratelimit.test.ts`; `pnpm check` verde |
| T-022 | M2 | DO | todo | T-020 | 1 | |
| T-023 | M2 | BE | todo | T-012, T-021, T-022 | 0 | |
| T-024 | M2 | FE | todo | T-015, T-025 | 0 | |
| T-025 | M2 | BE | todo | T-020 | 1 | |
| T-030 | M3 | DO | todo | T-002 | 2 | |
| T-031 | M3 | FE | todo | T-030 | 0 | |
| T-032 | M3 | BE | todo | T-030, T-020 | 0 | |
| T-040 | M4 | HU | todo | T-016 | 0 | |
| T-041 | M4 | DO | todo | T-016 | 1 | |
| T-042 | M4 | BE | todo | T-017, T-021 | 1 | |
| T-043 | M4 | FE | todo | T-015 | 0 | |
| T-044 | M4 | BE | todo | T-018, T-002 | 0 | |
| T-045 | M4 | HU | todo | T-041, T-042 | 0 | |

## 8. Detalle de tareas

### T-000 · HU · Claves y cuentas
- **Qué**: obtener `ANTHROPIC_API_KEY` (la organización debe tener retención de datos de 30 días: Fable 5.1 no funciona con retención cero); opcional `OPENROUTER_API_KEY`. Para Neon y Upstash, o bien `vercel integration accept-terms neon` y `vercel integration accept-terms upstash` (interactivo, una vez; después los agentes provisionan con `vercel integration add`), o bien crear los recursos a mano y copiar `DATABASE_URL` y `UPSTASH_*`. Para M3, `SUPABASE_ACCESS_TOKEN` (o crear el proyecto y copiar las claves). Pegar todo en `.env.local` y, cuando exista el proyecto de Vercel (T-016), en `vercel env`.
- **No bloquea**: M0 y M1 funcionan con `AI_PROVIDER=mock` y los fallbacks locales.

### T-001 · BE · Scaffold y tooling (bootstrap)
- **Archivos**: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.prettierrc`, `vitest.config.ts`, `postcss.config.mjs`, `app/layout.tsx`, `app/page.tsx` (placeholder "Hola, soy ELI"), `app/globals.css`, `lib/env.ts`, `lib/contracts/{chat,ai,ratelimit,queue,sessions}.ts`, `lib/ratelimit/index.ts` (stub en memoria), `lib/queue/index.ts` (stub inline no-op), `.env.example`, `vercel.json`, `.gitignore` (incluye `.vercel`, `.env*.local`), `README.md`, `tests/contracts.test.ts`.
- **Definición de hecho**: `pnpm install && pnpm check` en verde desde limpio; `pnpm dev` sirve `/`; scripts `dev`, `build`, `start`, `lint` (`eslint .`; Next 16 ya no trae `next lint`), `typecheck` (`tsc --noEmit`), `test` (`vitest run`), `check`; `engines.node >= 24` y sin APIs exclusivas de Node 26; `.env.example` con todas las variables de la sección 6.6 comentadas; `lib/env.ts` con zod y valores por defecto; `lib/contracts/*` compila y exporta exactamente los tipos de la sección 6; `vercel.json` mínimo válido (`{ "framework": "nextjs" }`); README con cómo arrancar.
- **Verificación**: `pnpm check`.
- **Notas**: `create-next-app` rehúsa directorios con archivos ajenos; scaffoldea en `./tmp-scaffold` (`pnpm dlx create-next-app@latest tmp-scaffold --ts --app --tailwind --eslint --no-src-dir --import-alias "@/*" --use-pnpm --yes`), mueve el contenido a la raíz y borra el temporal. Integra con `git push origin HEAD:main` (única excepción del protocolo) y avisa al orquestador de que haga `git pull`. El repo ya sirve una landing estática (`index.html` + `vercel.json` con `framework: null`): al scaffoldear, sustituye `vercel.json` por `{ \"framework\": \"nextjs\" }`, mueve `index.html` a `public/landing.html` y añade en `next.config.ts` un rewrite `beforeFiles` de `/` a `/landing.html`, de modo que la portada siga viva hasta T-013.

### T-002 · DO · CI y reglas de merge
- **Archivos**: `.github/workflows/ci.yml`, `.github/pull_request_template.md`.
- **Definición de hecho**: workflow `ci` con un job cuyo id y `name` son `check` (checkout, pnpm vía `pnpm/action-setup`, Node 24, `pnpm install --frozen-lockfile`, `pnpm check`), disparado por `pull_request` y `push` a `main`, con `concurrency` que cancela ejecuciones anteriores de la misma rama. Ajustes de repositorio aplicados por CLI: `gh api -X PATCH repos/talacha/elingo -F allow_auto_merge=true -F delete_branch_on_merge=true`. Ruleset `main-protection` sobre la rama por defecto con reglas `pull_request` (0 aprobaciones requeridas), `required_status_checks` con el contexto `check` y `strict_required_status_checks_policy: false` (para no obligar a re-sincronizar cada PR concurrente), `deletion` y `non_fast_forward`. **Orden**: primero los ajustes y el ruleset, después el PR con el workflow, para que ese mismo PR se fusione por auto-merge.
- **Verificación**: `gh api repos/talacha/elingo/rulesets --jq '.[].name'` muestra `main-protection`; el PR de esta tarea se fusiona solo cuando `check` está en verde.
- **Notas**: el contexto del check es el `name` del job. `pnpm check` no necesita secretos (mock).

### T-010 · BE · Prompt ELI y ventana deslizante
- **Archivos**: `lib/ai/prompt.ts`, `lib/ai/window.ts`, `tests/ai/window.test.ts`, `tests/ai/prompt.test.ts`.
- **Definición de hecho**: `ELI_SYSTEM_PROMPT` idéntico al literal de `north_star.md` (test que lo compara con una copia literal); `REFUSAL_MESSAGE`; `slidingWindow(messages, pairs = env.AI_WINDOW_PAIRS)` conserva los últimos N pares completos, descarta desde el más antiguo, devuelve siempre una lista que empieza por `user`, y trata `pairs = 0` y listas cortas.
- **Verificación**: `pnpm test -- window prompt`.

### T-011 · BE · Proveedores Anthropic y mock, servicio de IA
- **Archivos**: `lib/ai/providers/anthropic.ts`, `lib/ai/providers/mock.ts`, `lib/ai/providers/index.ts` (selección por env), `lib/ai/service.ts`, `tests/ai/service.test.ts`, `tests/ai/mock.test.ts`; añade `@anthropic-ai/sdk` a `package.json`.
- **Definición de hecho**: implementa el contrato 6.2 tal cual; `streamTutorReply` aplica `slidingWindow`, elige proveedor y devuelve `{ stream, done }`; el proveedor Anthropic usa `client.messages.stream` con `system` cacheado, `output_config.effort`, sin `temperature` ni `thinking`; mapea `refusal`, `max_tokens` y errores tipados del SDK; `done` incluye `usage`, `model`, `stopReason`, `latencyMs`, `ttfbMs`. `MockProvider` según 6.2 (incluida la "trampa"). Tests con el mock y con un proveedor falso que simula `refusal`.
- **Verificación**: `pnpm test -- ai`.
- **Notas**: si `ANTHROPIC_API_KEY` existe en `.env.local`, haz una llamada real corta y anota en Resultado el `ttfbMs` y `cache_read_input_tokens` observados.

### T-012 · BE · `POST /api/chat` en streaming
- **Archivos**: `app/api/chat/route.ts`, `lib/ai/http.ts` (helpers de respuesta y errores), `tests/api/chat.test.ts`.
- **Definición de hecho**: `export const runtime = "nodejs"` y `export const maxDuration = 60`; valida el cuerpo con zod contra `ChatRequest`; pone la cookie `eli_anon` si falta; llama a `checkRateLimit` (stub) y a `streamTutorReply`; responde `text/plain` en streaming con las cabeceras de 6.1; errores JSON `ChatError` con mensajes amables; llama a `enqueuePersist` (stub) cuando `done` resuelve, sin bloquear la respuesta (`after()` de `next/server`).
- **Verificación**: `pnpm test -- api/chat` (Request/Response de Node con el mock) y `curl -N -X POST localhost:3000/api/chat -H 'content-type: application/json' -d '{"sessionId":"<uuid>","messages":[{"id":"<uuid>","role":"user","content":"Tengo este problema: 3/4 + 1/2, me trabé en el denominador"}]}'`.

### T-013 · FE · Diseño base y landing
- **Archivos**: `app/globals.css` (tokens con `@theme` de Tailwind 4: fondo crema cálido, primario coral, acento turquesa, tinta oscura; radios grandes; escala tipográfica legible), `app/layout.tsx` (fuente legible vía `next/font/google`, por ejemplo Nunito; `lang="es"`; metadatos), `app/page.tsx` (landing: "Hola, soy ELI" + qué hace + botón "Empezar" → `/chat`), `components/ui/*` (Button, Card).
- **Definición de hecho**: móvil primero, contraste AA, sin scroll horizontal, `pnpm check` verde. Nada de librerías de componentes pesadas. Sustituye el puente de `public/landing.html` (rewrite de `/`) por `app/page.tsx`, reutilizando su contenido, colores y tipografías, y elimina el rewrite y el archivo estático.
- **Verificación**: `pnpm dev` y revisión en 375 px y 1280 px.

### T-014 · FE · UI de chat con streaming
- **Archivos**: `app/(app)/chat/page.tsx`, `components/chat/{ChatView,MessageList,MessageBubble,TypingIndicator,ChatInput}.tsx`, `components/chat/useTutorChat.ts`, `tests/chat/useTutorChat.test.ts`.
- **Definición de hecho**: burbujas (usuario a la derecha, ELI a la izquierda con avatar), indicador "ELI está pensando…" desde el envío hasta el primer chunk, textarea con placeholder "Tengo este problema: … me trabé en …" (Enter envía, Shift+Enter salta de línea), botón parar. `useTutorChat` hace `fetch` a `/api/chat` con el contrato 6.1, lee `response.body` con `getReader()` y `TextDecoder`, acumula deltas en el último mensaje de ELI, gestiona `idle \| streaming \| error`, trata los errores JSON (429 con `retryAfter`, 503, 500) con mensajes amables y usa `AbortController`. `sessionId` en `localStorage` (T-024 lo evoluciona). Funciona contra el mock.
- **Verificación**: `pnpm dev` con `AI_PROVIDER=mock`; test del hook con `fetch` simulado que emite un stream.

### T-015 · FE · UX infantil
- **Archivos**: `components/chat/SubjectChips.tsx`, `components/chat/Markdown.tsx`, `components/chat/EmptyState.tsx`, ajustes en `components/chat/*`.
- **Definición de hecho**: chips "Mates", "Lengua", "Ciencias" que fijan `subject` y sugieren una plantilla en el input; render seguro de markdown ligero (negritas, viñetas, saltos de línea; sin HTML crudo; por ejemplo `react-markdown` sin plugins de HTML); estado vacío con bienvenida y 3 ejemplos; estados de error y carga; `aria-live="polite"` en el stream; foco correcto; input fijado abajo con `100dvh` en móvil.
- **Verificación**: `pnpm dev` en móvil (375 px) con teclado virtual; `pnpm check`.

### T-016 · DO · Proyecto en Vercel y entornos
- **Estado de partida**: el proyecto **ya existe**: `elingo/elingo` en el team `elingo` (CLI autenticado en ese scope; `vercel link --yes --scope elingo --project elingo`), conectado a `github.com/talacha/elingo` (cada push a `main` despliega producción y cada PR un preview). Producción: https://elingo-elingo.vercel.app. Hoy sirve la landing estática (`index.html` + `vercel.json` con `framework: null`). **No crees otro proyecto.**
- **Archivos**: ninguno versionado (`.vercel/` está ignorado); anota URLs en Resultado.
- **Definición de hecho**: `AI_PROVIDER=mock` en `preview` y `production` (`printf mock | vercel env add AI_PROVIDER preview`, ídem `production`) hasta que T-045 lo cambie; un PR de prueba genera un preview verde; la protección de despliegues (Vercel Authentication) queda en "Standard Protection" (producción pública, previews protegidos) o como decida el humano: anótalo, no lo cambies.
- **Verificación**: abrir la URL de producción y el preview del PR más reciente.
### T-017 · BE · Guardas de coste
- **Archivos**: `lib/ai/log.ts`, ajustes en `app/api/chat/route.ts` y `lib/ai/service.ts`, `tests/ai/log.test.ts`.
- **Definición de hecho**: rechazo `400` amable si el último mensaje supera `AI_MAX_INPUT_CHARS`; `max_tokens` desde `AI_MAX_OUTPUT_TOKENS`; una línea de log JSON por petición `{ event: "chat", sessionId, provider, model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens, latencyMs, ttfbMs, stopReason }` sin contenido de mensajes.
- **Verificación**: `pnpm test -- log` y una petición manual que muestre la línea de log.

### T-018 · BE · Smoke test del chat
- **Archivos**: `scripts/smoke-chat.ts`, script `smoke` en `package.json`.
- **Definición de hecho**: arranca `next dev` (o usa `BASE_URL` si se le pasa) con `AI_PROVIDER=mock`, espera a que responda, envía un problema real y comprueba que el stream devuelve texto con negritas/viñetas y sin resultado numérico final; envía "dame la respuesta" y comprueba que ELI redirige; cierra el servidor; sale con código ≠ 0 si algo falla.
- **Verificación**: `pnpm smoke`.

### T-019 · BE · Proveedor OpenRouter
- **Archivos**: `lib/ai/providers/openrouter.ts`, `tests/ai/openrouter.test.ts`, ajustes en `lib/ai/providers/index.ts`.
- **Definición de hecho**: `fetch` a `https://openrouter.ai/api/v1/chat/completions` con `stream: true`, parseo de SSE (`choices[0].delta.content`), `usage` del último chunk (`usage: { include: true }`), cabeceras `Authorization`, `HTTP-Referer` y `X-Title`; mismo contrato 6.2; test con `fetch` simulado; conmutación por `AI_PROVIDER=openrouter` y `OPENROUTER_MODEL`.
- **Verificación**: `pnpm test -- openrouter`.

### T-020 · DO · Neon y Drizzle
- **Archivos**: `lib/db/schema.ts`, `lib/db/client.ts`, `lib/db/repo.ts`, `lib/db/memory.ts`, `drizzle.config.ts`, `drizzle/0000_init.sql`, scripts `db:generate` y `db:migrate`, `tests/db/repo.test.ts`; añade `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`.
- **Definición de hecho**: esquema 6.5 en Drizzle; SQL generado con `drizzle-kit generate` y versionado; `getRepo()` devuelve `NeonRepo` con `DATABASE_URL` y `MemoryRepo` sin ella; tests del repositorio contra `MemoryRepo` (y contra Neon si hay `DATABASE_URL`). Provisión, por este orden: `vercel integration add neon` si `vercel integration installations` muestra Neon; si no, `npx neonctl projects create --name eli` con `NEON_API_KEY`; si no hay nada, anota "esperando DATABASE_URL (T-000)" en Resultado y termina igualmente (el código funciona en memoria).
- **Verificación**: `pnpm test -- db` y, con `DATABASE_URL`, `pnpm db:migrate`.

### T-021 · DO · Rate limit con Upstash
- **Archivos**: `lib/ratelimit/index.ts` (sustituye el stub), `lib/ratelimit/memory.ts`, `tests/ratelimit.test.ts`; añade `@upstash/redis`, `@upstash/ratelimit`.
- **Definición de hecho**: `Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW)` con `Redis.fromEnv()` cuando hay credenciales, prefijo `eli:rl:`; `MemoryRateLimiter` equivalente sin ellas; tests de la ventana en memoria. Para dev/CI, `upstash start-redis` da credenciales temporales (72 h) sin cuenta; para un recurso duradero, `upstash redis create` tras login humano o `vercel integration add upstash`. Anota la ruta elegida en Resultado.
- **Verificación**: `pnpm test -- ratelimit`.

### T-022 · DO · Cola de persistencia con QStash
- **Archivos**: `lib/queue/index.ts` (sustituye el stub), `lib/queue/persist.ts`, `app/api/jobs/persist/route.ts`, `tests/queue.test.ts`; añade `@upstash/qstash`.
- **Definición de hecho**: con `QSTASH_TOKEN`, `enqueuePersist` publica el `PersistJob` a `${NEXT_PUBLIC_APP_URL}/api/jobs/persist` con `deduplicationId` = id del último mensaje; el endpoint verifica la firma (`verifySignatureAppRouter`) y llama a `persistJob`, que hace `upsertSession` e `insertMessages` idempotente; sin token, `enqueuePersist` ejecuta `persistJob` inline. Tests con el repositorio en memoria.
- **Verificación**: `pnpm test -- queue`.

### T-023 · BE · Cablear rate limit y persistencia en `/api/chat`
- **Archivos**: `app/api/chat/route.ts`, `tests/api/chat.test.ts`.
- **Definición de hecho**: clave de rate limit `userId ?? anonId ?? ip`; `429` con `retryAfter` y cabecera `Retry-After`; al resolver `done`, `enqueuePersist` con el historial completo más la respuesta de ELI (con `tokensIn`, `tokensOut`, `model`) usando `after()` para no retrasar la respuesta; tests de ambos caminos.
- **Verificación**: `pnpm test -- api/chat`; enviar 21 mensajes en 10 minutos y recibir un 429 amable.

### T-024 · FE · Sesiones en el cliente
- **Archivos**: `components/chat/useTutorChat.ts`, `components/chat/SessionList.tsx`, `app/(app)/chat/page.tsx`, `app/(app)/chat/[id]/page.tsx`.
- **Definición de hecho**: botón "Nueva conversación" (nuevo `sessionId`); lista "Mis conversaciones" desde `GET /api/sessions`; abrir una carga sus mensajes desde `GET /api/sessions/:id`; al recargar se mantiene la conversación actual.
- **Verificación**: `pnpm dev` con `MemoryRepo` (persistencia inline): recargar y ver el historial.

### T-025 · BE · API de sesiones
- **Archivos**: `app/api/sessions/route.ts`, `app/api/sessions/[id]/route.ts`, `tests/api/sessions.test.ts`.
- **Definición de hecho**: contrato 6.4; ámbito por `anon_id` de la cookie (o `userId` tras T-032); 404 si la sesión no pertenece al solicitante; tests con `MemoryRepo`.
- **Verificación**: `pnpm test -- api/sessions`.

### T-030 · DO · Supabase Auth (infraestructura)
- **Archivos**: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`, campos nuevos en `lib/env.ts` y `.env.example`; añade `@supabase/supabase-js`, `@supabase/ssr`.
- **Definición de hecho**: clientes de navegador y servidor según `@supabase/ssr`; `middleware.ts` refresca la sesión; bandera `AUTH_REQUIRED` (por defecto `false`); sin variables de Supabase todo sigue en modo anónimo. Provisión: con `SUPABASE_ACCESS_TOKEN`, `npx supabase projects create eli` en la organización que muestre `npx supabase orgs list` y copiar las claves a `.env.local`; sin token, anota "esperando SUPABASE_* (T-000)" y termina.
- **Verificación**: `pnpm check`; con claves, `pnpm dev` y comprobar que `supabase.auth.getUser()` responde.

### T-031 · FE · Login, registro y perfil
- **Archivos**: `app/(app)/login/page.tsx`, `app/(app)/registro/page.tsx`, `app/(app)/perfil/page.tsx`, `components/auth/*`, botón de sesión en el layout de `(app)`.
- **Definición de hecho**: registro y login con email y contraseña (o enlace mágico) para madre/padre; perfil de alumno (nombre y curso, por defecto 6º); logout; formularios en español con errores amables; sin claves de Supabase muestra un aviso y no rompe.
- **Verificación**: `pnpm dev` con claves de Supabase.

### T-032 · BE · Protección de rutas y usuario en Neon
- **Archivos**: `app/api/chat/route.ts`, `app/api/sessions/**`, `middleware.ts`, `lib/db/repo.ts` (`upsertUserFromSupabase`), tests correspondientes.
- **Definición de hecho**: con `AUTH_REQUIRED=true`, `/chat` redirige a `/login` y `/api/*` devuelve `401 unauthorized`; con sesión de Supabase, `upsertUserFromSupabase` crea o encuentra la fila de `users` y las sesiones se guardan con `user_id`; con `AUTH_REQUIRED=false` nada cambia para anónimos.
- **Verificación**: tests con usuario simulado; `pnpm dev` con ambas banderas.

### T-040 · HU · Dominio `eli.ngo`
- **Qué**: confirmar la titularidad (`.ngo` exige validación de ONG en el registrador), apuntar DNS a Vercel y ejecutar `vercel domains add eli.ngo` en el proyecto `eli`. Mientras tanto la app vive en `*.vercel.app`.

### T-041 · DO · Configuración de producción
- **Archivos**: `vercel.json`, `next.config.ts` (cabeceras), `app/robots.ts`.
- **Definición de hecho**: variables de producción en Vercel (`vercel env add … production` a partir de `.env.local`, sin escribirlas en el repo); región de las funciones coherente con Neon; cabeceras de seguridad (CSP básica, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`); `robots.txt` que permite la portada y bloquea `/api`.
- **Verificación**: `vercel deploy --prod` y `curl -I https://<dominio>` muestra las cabeceras.

### T-042 · BE · Salud, errores y presupuesto diario
- **Archivos**: `app/api/health/route.ts`, `lib/http/errors.ts`, `lib/ai/budget.ts`, ajustes en `app/api/chat/route.ts`, tests.
- **Definición de hecho**: `GET /api/health` → `{ ok, provider, model, db: "neon" | "memory", redis: boolean, version }`; errores centralizados que siempre devuelven `ChatError` amable; contador diario de tokens en Redis (`eli:budget:YYYY-MM-DD`, en memoria sin Redis) que se incrementa con `usage` y bloquea con `503 budget_exhausted` al superar `DAILY_TOKEN_BUDGET`.
- **Verificación**: `pnpm test -- budget health`; `curl /api/health`.

### T-043 · FE · Pulido visual
- **Archivos**: `app/icon.png` o `app/icon.svg`, `app/opengraph-image.*`, ajustes en `components/**` y `app/globals.css`.
- **Definición de hecho**: favicon y Open Graph; revisión de contraste; microanimaciones sutiles (aparición de burbujas, indicador de escritura) que respetan `prefers-reduced-motion`; manifest opcional.
- **Verificación**: `pnpm check`; Lighthouse accesibilidad ≥ 90 en `/chat`.

### T-044 · BE · E2E con Playwright en CI
- **Archivos**: `e2e/chat.spec.ts`, `playwright.config.ts`, script `e2e`, job `e2e` en `.github/workflows/ci.yml`; añade `@playwright/test`.
- **Definición de hecho**: abre `/chat`, escribe un problema, envía, espera la burbuja de ELI con texto; caso "trampa"; `webServer` con `AI_PROVIDER=mock`; job `e2e` en CI (no requerido en el ruleset por ahora; anota en la Bandeja si conviene exigirlo).
- **Verificación**: `pnpm e2e` en local y en CI.

### T-045 · HU · Lanzamiento
- **Qué**: repasar los ocho criterios de éxito de `north_star.md` en `eli.ngo`; poner `AI_PROVIDER=anthropic` y `ANTHROPIC_MODEL=claude-fable-5-1` en producción; probar con una alumna real; revisar coste y logs al día siguiente y ajustar `DAILY_TOKEN_BUDGET` y `RATE_LIMIT_*`.

## 9. Bandeja (estado `new`)

El humano promueve una fila a `todo` moviéndola a la sección 7 con hito, rol y dependencias. Los agentes añaden filas aquí, nunca las promueven. ID de las filas nuevas: `N-<tarea de origen>-<n>` (por ejemplo `N-T011-1`); las filas históricas conservan `N-0xx`.

| ID | Propuesta | Origen |
|---|---|---|
| N-001 | Historial de conversaciones para padres (vista de solo lectura) | roadmap M5 |
| N-002 | Selector de asignatura persistente por sesión y sugerencias por tema | roadmap M5 |
| N-003 | Rachas simples ("3 días seguidos estudiando") | roadmap M5 |
| N-004 | Foto del problema: subida a Supabase Storage y lectura con visión | roadmap M5 |
| N-005 | Migrar sesiones anónimas al usuario al iniciar sesión | roadmap M5 |
| N-006 | Evals del prompt con clave real (10 problemas por asignatura, criterio "no da la respuesta") | roadmap M5 |
| N-007 | Ejemplos few-shot en el prompt de sistema para superar el mínimo cacheable y afinar el tono | roadmap M5 |
| N-008 | Exigir el job `e2e` en el ruleset de `main` cuando sea estable | T-044 |
| N-009 | Resuelto por el orquestador: `scripts/tasks-check.mjs --fix` en el paso 6 y `tests/tasks.test.ts` en CI. Origen: `merge=union` duplicaba filas adyacentes de la tabla de estado al rebasar T-010 sobre T-002 | T-010 |
| N-010 | La integración de Neon en Vercel instala sus variables con prefijo `eli_`; `DATABASE_URL` es hoy una copia manual de `eli_DATABASE_URL` y no seguiría una rotación de credenciales. Quitar el prefijo en la integración (o hacer que el código acepte `eli_DATABASE_URL`) | T-020 |
| N-011 | `StopReason` (contrato 6.2) no distingue una petición cancelada por la alumna (abort del cliente) de un fallo del proveedor: ambas llegan como `error`. Valorar añadir `"aborted"` cuando T-017 defina el log y T-042 el presupuesto, para no contar cancelaciones como errores | T-011 |
| N-012 | Resuelto (orquestador): IDs `N-<tarea>-<n>` y `tasks-check.mjs` conserva las filas con contenido distinto (renombra la posterior). Origen: `scripts/tasks-check.mjs --fix` trata las filas de la Bandeja como las de estado: si dos agentes proponen ideas distintas con el mismo `N-0xx` (T-011 y T-020 coincidieron en N-010) borra una en vez de renumerarla, y al rebasar T-011 descartó también la versión nueva de N-009 (hubo que restaurar ambas a mano). Propuesta: en la Bandeja renumerar la fila más reciente y no deduplicar por «versión más avanzada» | T-011 |
| N-T014-1 | Aviso de 429 con cuenta atrás: desactivar «Reintentar» hasta que pase `retryAfter` (hoy el botón está siempre activo) | T-014 |
| N-T014-2 | `next dev` (Next 16) añade un bloque `nextjs-agent-rules` a `CLAUDE.md` en cada arranque; decidir si se commitea una vez o se evita, para que los agentes no arrastren ese cambio | T-014 |
