import { z } from "zod";
import type { UserRole } from "@/lib/db/schema";

/** Contratos de /admin (M7). Fuente de verdad: tasks.md, sección 6.13. */

export const PROVIDER_NAMES = ["anthropic", "openrouter", "mock"] as const;

/** Feature flags que existen (definición completa en lib/config/registry.ts). */
export const FLAG_KEYS = ["voice_mode", "image_mode"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export interface AdminUserSummary {
  id: string;
  displayName: string | null;
  role: UserRole;
  createdAt: string;
  sessionCount: number;
  /** Flags que esta cuenta ha apagado/encendido apartándose del global; ausente = sigue al global. */
  flagOverrides: Partial<Record<FlagKey, boolean>>;
}

export interface AdminUsersResponse {
  users: AdminUserSummary[];
}

/** Un parámetro de configuración tal como lo pinta /admin. */
export interface AdminConfigParam {
  key: string;
  label: string;
  description: string;
  category: "ia" | "modelos" | "voz" | "limites";
  kind: "provider" | "model" | "int" | "string";
  options?: string[];
  capability?: "text" | "image" | "audio";
  /** false = solo lectura (se fija con variable de entorno y redeploy). */
  editable: boolean;
  /** Valor efectivo ahora mismo. */
  value: string;
  /** `db` = guardado en Postgres desde /admin; `env` = variable de entorno o valor por defecto. */
  source: "db" | "env";
}

export interface AdminFlag {
  key: FlagKey;
  label: string;
  description: string;
  /** Parte de la interfaz que gobierna. */
  ui: string;
  /** Valor global (apagado = apagado para todas las cuentas). */
  enabled: boolean;
}

export interface AdminConfigResponse {
  /** Proveedor y modelo que atienden el chat ahora mismo. */
  provider: string;
  activeModel: string;
  params: AdminConfigParam[];
  flags: AdminFlag[];
}

/** Las claves se validan contra el registro en la ruta (dan mensajes útiles, no un enum opaco). */
export const updateConfigSchema = z.object({
  key: z.string().min(1).max(64),
  value: z.string(),
});
export type UpdateConfigRequest = z.infer<typeof updateConfigSchema>;

export const clearConfigSchema = z.object({ key: z.string().min(1).max(64) });

export const updateGlobalFlagSchema = z.object({
  flag: z.enum(FLAG_KEYS),
  enabled: z.boolean(),
});

export const updateAccountFlagSchema = z.object({
  userId: z.string().uuid(),
  flag: z.enum(FLAG_KEYS),
  /** null = quitar el override de la cuenta (vuelve a seguir al global). */
  enabled: z.boolean().nullable(),
});
