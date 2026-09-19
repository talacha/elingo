# ELI — guía para agentes (Claude Code)

ELI es un tutor socrático por IA para K-12 (kínder a 12.º; por defecto 6.º), con tareas en español o en inglés y sin asignaturas fijas. Web Next.js 16 (App Router, TypeScript estricto, Tailwind 4, pnpm); IA vía OpenRouter con modelos gratuitos por defecto (chat, visión y voz), con Anthropic (`claude-fable-5-1`) y un mock como alternativas; Neon + Drizzle (también guarda la configuración y los flags por cuenta); Upstash (rate limit, caché de configuración y QStash); Supabase Auth; Vercel bajo `eli.ngo`. Documentos y UI en español; código, ramas e IDs de tarea en inglés.

## Empieza siempre por

1. `north_star.md`: qué construimos y qué significa terminado. Sus **Reglas de producto** son decisiones del propietario: sin asignaturas, nivel K-12 en el prompt, tareas en español o inglés, solo la respuesta final, la voz contesta con voz si la petición fue hablada, funciones activables por cuenta.
2. `roadmap.md`: hitos y carriles paralelos.
3. `tasks.md`: protocolo, contratos y tablero. **Es la fuente de verdad del trabajo.**

## El loop (una tarea por invocación)

> Pick the single highest-leverage next step toward the goal and execute it, then update tasks.md.

En concreto: elige una tarea `todo` desbloqueada (tu rol primero → mayor "Desbloquea" → hito más temprano → ID más bajo), crea y publica la rama `agent/T-0xx-<slug>` (es el lock), impleméntala con tests, `pnpm check` en verde, actualiza tu fila en `tasks.md`, abre PR y `gh pr merge --auto --squash --delete-branch`, espera al merge, informa y para. Los siete pasos exactos están en la sección 1 de `tasks.md`.

## Comandos

`pnpm install` · `pnpm dev` · `pnpm check` (lint + typecheck + test + build; obligatorio antes de cada PR) · `pnpm test` · `pnpm smoke` · `pnpm db:generate` / `pnpm db:migrate` · `pnpm e2e`

## Propiedad de archivos

- `frontend`: `app/(app)/**`, `components/**`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`
- `backend`: `app/api/**`, `lib/ai/**`, `scripts/**`
- `data-ops`: `lib/db/**`, `lib/ratelimit/**`, `lib/queue/**`, `lib/supabase/**`, `drizzle/**`, `.github/**`, `vercel.json`, `proxy.ts`, `drizzle.config.ts`
- compartidos (cambios mínimos y aditivos): `package.json`, `.env.example`, `lib/env.ts`, `lib/contracts/**`, `tasks.md`, `README.md`

Una tarea puede listar archivos fuera de tu rol; entonces puedes tocarlos. En `tasks.md` solo editas tu fila de estado y, si descubres trabajo nuevo, una fila en la Bandeja.

## Autonomía

- **Sin pedir permiso**: `pnpm`, `git` (ramas y push de tu rama), `gh` (PRs y los ajustes de repo que exige el protocolo), `vercel` (`link`, `env`, `deploy`, `git connect`, `integration add` si los términos ya están aceptados), `upstash`, `npx neonctl` y `npx supabase` cuando exista el token.
- **Nunca**: crear cuentas, aceptar términos legales, pagar, borrar recursos de producción, forzar push a `main`, subir secretos, desactivar checks, cambiar el modelo de producción fuera de T-045 (un humano lo cambia desde `/admin/config`).
- Si algo requiere al humano, anótalo en la columna Resultado y sigue con lo que sí puedes hacer usando los fallbacks locales.

## Convenciones

- Commits y PRs: `T-0xx: <qué>`; el ID es obligatorio.
- El repo debe funcionar sin ninguna clave (`AI_PROVIDER=mock`); cada servicio externo tiene fallback local.
- zod en toda entrada HTTP; sin `any` sin justificar; sin datos personales en logs.
- Al cambiar variables de entorno, actualiza `lib/env.ts`, `.env.example` y la sección 6.6 de `tasks.md` en el mismo PR.
- Al cambiar un contrato, actualiza `lib/contracts/**` y la sección 6 de `tasks.md` en el mismo PR.
- Todo parámetro ajustable en caliente se define **una sola vez** en `lib/config/registry.ts` (los secretos y conexiones quedan en variables de entorno); no lo repitas en otro sitio.
- El prompt de sistema se cambia primero en `north_star.md` y después en `lib/ai/prompt.ts` (un test los compara byte a byte). No nombres asignaturas ni en el prompt, ni en la UI, ni en la API.

## Flujo de una petición de chat

Mensaje de la alumna (escrito, hablado o con foto) → cookie anónima, flags `voice_mode`/`image_mode` (global y de la cuenta) y rate limit (Upstash; en memoria si no hay Redis) → configuración efectiva (Postgres vía caché Redis) y nivel K-12 del perfil → ventana deslizante + prompt de sistema de `north_star.md` con el nivel (`buildSystemPrompt(grado)`; no lo parafrasees) + mensaje de estilo (solo la respuesta final, en el idioma de la alumna) → proveedor de IA (OpenRouter por defecto; Anthropic o mock según env/`/admin`) con modelo de respaldo si falla, tarda más de 20 s, termina sin texto o devuelve su razonamiento → respuesta en streaming al cliente (si la petición fue hablada, se lee sola) → `after()` encola el historial completo hacia Neon (QStash; inline si no hay token).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
