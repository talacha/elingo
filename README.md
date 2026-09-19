# ELI — Tutor Nexo

Tutor de estudio por IA para **K-12** (de kínder a 12.º grado) que guía paso a paso **sin dar nunca la respuesta**, con tareas en español o en inglés y sin asignaturas fijas. Next.js 16, OpenRouter (modelos gratuitos por defecto; Anthropic y un mock como alternativas), Neon, Upstash y Supabase, desplegado en Vercel.

Los modelos, los límites y las funciones de voz e imagen se configuran desde `/admin` (guardados en Postgres, con caché en Redis) sin volver a desplegar; los secretos siguen en variables de entorno. Las reglas de producto están en [north_star.md](north_star.md).

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
