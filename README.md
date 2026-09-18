# ELI — Tutor Nexo

Tutor de estudio por IA para 6º de primaria que guía paso a paso **sin dar nunca la respuesta**. Next.js 16, Anthropic API (Claude Fable 5.1), Neon, Upstash y Supabase, desplegado en Vercel.

## Arrancar

```bash
pnpm install
cp .env.example .env.local   # opcional: sin claves funciona con el proveedor mock
pnpm dev                     # http://localhost:3000
```

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm check` | lint + typecheck + test + build. Obligatorio antes de cada PR |
| `pnpm test` | tests con vitest |
| `pnpm lint` / `pnpm typecheck` | eslint / `next typegen && tsc --noEmit` |
| `pnpm format` | prettier |
| `pnpm db:generate` / `pnpm db:migrate` | genera el SQL de `lib/db/schema.ts` en `drizzle/` / lo aplica a `DATABASE_URL` |

## Documentación

- [north_star.md](north_star.md): qué construimos y qué significa terminado.
- [roadmap.md](roadmap.md): hitos y carriles paralelos.
- [tasks.md](tasks.md): protocolo de los agentes, contratos y tablero de tareas.
- [CLAUDE.md](CLAUDE.md): guía para Claude Code.
