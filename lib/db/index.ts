import { getEnv } from "@/lib/env";
import { MemoryRepo } from "./memory";
import { NeonRepo } from "./neon";
import type { Repo } from "./repo";

export * from "./repo";
export { MemoryRepo } from "./memory";
export { NeonRepo } from "./neon";

let repo: Repo | null = null;

/** NeonRepo con DATABASE_URL, MemoryRepo sin ella. Una instancia por proceso. */
export function getRepo(): Repo {
  if (!repo) {
    const url = getEnv().DATABASE_URL;
    repo = url ? new NeonRepo(url) : new MemoryRepo();
  }
  return repo;
}

/** Solo para tests: descarta la instancia para releer el entorno. */
export function resetRepo(): void {
  repo = null;
}
