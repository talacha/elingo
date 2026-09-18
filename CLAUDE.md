# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Greenfield. The repository currently contains only `PLAN.md` (in Spanish), which is the product and architecture spec. There is no `package.json`, no source code, and therefore no build, lint, dev, or test commands yet.

When Phase 1 of `PLAN.md` scaffolds the app, replace this section with the real commands (dev server, build, lint, tests, running a single test, DB migrations). Do not guess them.

## What ELI is

"ELI" (Tutor Nexo) is an AI study tutor for Spanish-speaking 6th-grade students (11–12 years old) preparing for secondary school. It is a web app to be deployed on Vercel at `https://eli.ngo`. `PLAN.md` is the source of truth for scope, stack, and the tutor's system prompt.

Product language is Spanish: the tutor system prompt, UI copy, and `PLAN.md` are all Spanish, and the existing commit message is too.

## Intended architecture (from PLAN.md)

- **App**: Next.js App Router (Node.js) deployed on Vercel. `vercel.json` targets the `eli.ngo` domain.
- **Storage is split by concern**:
  - Neon (PostgreSQL) is the transactional database: tables `users`, `chat_sessions`, `messages`, managed with SQL migration scripts.
  - Supabase provides auth (students and parents) and file storage only. It is not the primary database.
  - Upstash Redis provides rate limiting on chat requests and a queue for background work.
- **AI core** (`ai.service.ts` or `.js`): every LLM call goes through OpenRouter so the underlying model is a config value and can be swapped. An AI config module injects the ELI system prompt from `PLAN.md` verbatim (Socratic method, never gives final answers or writes full texts, positive correction, short paragraphs with bold and bullets). Do not paraphrase or "improve" that prompt without the owner's sign-off.
- **Token strategy** (cost and latency): use prompt caching where the API supports it; send only a sliding window of recent messages (about 6 Q&A pairs) to the LLM; persist the full conversation asynchronously to Neon through the Upstash queue, not in the request path.
- **UI**: a single kid-friendly chat screen (bubbles, readable typography, warm colors) whose input is designed around "Tengo este problema: [problema], me trabé en X".
- **Config**: `.env.example` must list the variables for Supabase, Neon, Upstash, and OpenRouter.

Request flow to keep in mind when touching any layer: incoming chat message → Upstash rate limit → build windowed payload with system prompt → OpenRouter → reply to client → enqueue message for async write to Neon.

## Open point to confirm

`PLAN.md` names the model as "ChatGPT Fable 5.1". Fable 5.1 is an Anthropic Claude model, not a ChatGPT model, so confirm the exact OpenRouter model slug with the project owner before wiring it. Because the model is abstracted behind OpenRouter, this only affects one config value.

## Build phases

`PLAN.md` defines four sequential phases: (1) project scaffold, `vercel.json`, `.env.example`; (2) data layer: Supabase auth client, Neon connection and migrations, Upstash rate limiting and queue; (3) AI service with OpenRouter and sliding window; (4) chat UI. Check which phase is complete before starting work.

`PLAN.md` also asks that terminal commands needing authorization (such as `npm install`) be requested from the user rather than run unprompted; otherwise proceed by creating files.
# ELI — guía para agentes (Claude Code)

ELI es un tutor socrático por IA para 6º de primaria. Web Next.js 16 (App Router, TypeScript estricto, Tailwind 4, pnpm); IA vía Anthropic API con el SDK oficial (`claude-fable-5-1`), con OpenRouter y un mock como alternativas; Neon + Drizzle; Upstash (rate limit y QStash); Supabase Auth; Vercel bajo `eli.ngo`. Documentos y UI en español; código, ramas e IDs de tarea en inglés.

## Empieza siempre por

1. `north_star.md`: qué construimos y qué significa terminado.
2. `roadmap.md`: hitos y carriles paralelos.
3. `tasks.md`: protocolo, contratos y tablero. **Es la fuente de verdad del trabajo.**

## El loop (una tarea por invocación)

> Pick the single highest-leverage next step toward the goal and execute it, then update tasks.md.

En concreto: elige una tarea `todo` desbloqueada (mayor "Desbloquea" → hito más temprano → tu rol → ID más bajo), crea y publica la rama `agent/T-0xx-<slug>` (es el lock), impleméntala con tests, `pnpm check` en verde, actualiza tu fila en `tasks.md`, abre PR y `gh pr merge --auto --squash --delete-branch`, espera al merge, informa y para. Los siete pasos exactos están en la sección 1 de `tasks.md`.

## Comandos

`pnpm install` · `pnpm dev` · `pnpm check` (lint + typecheck + test + build; obligatorio antes de cada PR) · `pnpm test` · `pnpm smoke` · `pnpm db:generate` / `pnpm db:migrate` · `pnpm e2e`

## Propiedad de archivos

- `frontend`: `app/(app)/**`, `components/**`, `app/globals.css`, `app/page.tsx`, `app/layout.tsx`
- `backend`: `app/api/**`, `lib/ai/**`, `scripts/**`
- `data-ops`: `lib/db/**`, `lib/ratelimit/**`, `lib/queue/**`, `lib/supabase/**`, `drizzle/**`, `.github/**`, `vercel.json`, `middleware.ts`, `drizzle.config.ts`
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
