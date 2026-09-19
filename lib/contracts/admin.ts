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

export const PROVIDER_NAMES = ["anthropic", "openrouter", "mock"] as const;

export const updateAiConfigSchema = z
  .object({
    key: z.enum(AI_CONFIG_KEYS),
    value: z.string().trim().min(1).max(200),
  })
  .refine((v) => v.key !== "AI_PROVIDER" || (PROVIDER_NAMES as readonly string[]).includes(v.value), {
    message: `AI_PROVIDER debe ser uno de: ${PROVIDER_NAMES.join(", ")}`,
    path: ["value"],
  });
export type UpdateAiConfigRequest = z.infer<typeof updateAiConfigSchema>;

/** Configuración de IA que realmente está en uso (env vars + overrides), no solo los overrides. */
export interface AdminEffectiveAiConfig {
  provider: (typeof PROVIDER_NAMES)[number];
  /** Modelo que atiende el chat ahora mismo con el proveedor activo. */
  activeModel: string;
  /** Valor efectivo de cada clave editable. */
  values: Record<AiConfigKey, string>;
}

export interface AdminAiConfigResponse {
  /** Overrides activos; una clave ausente significa "usa la env var". */
  overrides: Partial<Record<AiConfigKey, string>>;
  effective: AdminEffectiveAiConfig;
}
