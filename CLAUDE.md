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
