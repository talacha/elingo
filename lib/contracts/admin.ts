import { z } from "zod";
import type { UserRole } from "@/lib/db/schema";

/** Contratos de /admin (M7). Fuente de verdad: tasks.md, sección 6.13. */

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  sessionCount: number;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
}

/** Único subconjunto de env vars que un admin puede sobrescribir en caliente (tasks.md 6.13). */
export const AI_CONFIG_KEYS = ["AI_PROVIDER", "ANTHROPIC_MODEL", "OPENROUTER_MODEL"] as const;
export type AiConfigKey = (typeof AI_CONFIG_KEYS)[number];

export const updateAiConfigSchema = z.object({
  key: z.enum(AI_CONFIG_KEYS),
  value: z.string().min(1).max(200),
});
export type UpdateAiConfigRequest = z.infer<typeof updateAiConfigSchema>;

export interface AdminAiConfigResponse {
  /** Overrides activos; una clave ausente significa "usa la env var". */
  overrides: Partial<Record<AiConfigKey, string>>;
}
