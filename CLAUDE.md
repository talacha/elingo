# ELI — guía para agentes (Claude Code)

ELI es un tutor socrático por IA para 6º de primaria. Web Next.js 16 (App Router, TypeScript estricto, Tailwind 4, pnpm); IA vía Anthropic API con el SDK oficial (`claude-fable-5-1`), con OpenRouter y un mock como alternativas; Neon + Drizzle; Upstash (rate limit y QStash); Supabase Auth; Vercel bajo `eli.ngo`. Documentos y UI en español; código, ramas e IDs de tarea en inglés.

## Empieza siempre por

1. `north_star.md`: qué construimos y qué significa terminado.
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
- **Nunca**: crear cuentas, aceptar términos legales, pagar, borrar recursos de producción, forzar push a `main`, subir secretos, desactivar checks, cambiar el modelo de producción fuera de T-045.
- Si algo requiere al humano, anótalo en la columna Resultado y sigue con lo que sí puedes hacer usando los fallbacks locales.

## Convenciones

- Commits y PRs: `T-0xx: <qué>`; el ID es obligatorio.
- El repo debe funcionar sin ninguna clave (`AI_PROVIDER=mock`); cada servicio externo tiene fallback local.
- zod en toda entrada HTTP; sin `any` sin justificar; sin datos personales en logs.
- Al cambiar variables de entorno, actualiza `lib/env.ts`, `.env.example` y la sección 6.6 de `tasks.md` en el mismo PR.
- Al cambiar un contrato, actualiza `lib/contracts/**` y la sección 6 de `tasks.md` en el mismo PR.

## Flujo de una petición de chat

Mensaje de la alumna → cookie anónima y rate limit (Upstash; en memoria si no hay Redis) → ventana deslizante + prompt de sistema literal de `north_star.md` (no lo parafrasees) → proveedor de IA (Anthropic por defecto; OpenRouter o mock según env) → respuesta en streaming al cliente → `after()` encola el historial completo hacia Neon (QStash; inline si no hay token).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
