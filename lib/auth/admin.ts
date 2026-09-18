import { getEnv, type Env } from "@/lib/env";

/**
 * true si `email` está en `ADMIN_EMAILS` (vacío por defecto → nadie entra en /admin).
 * Nunca se basa en un rol guardado en la base de datos: eso permitiría que alguien se
 * autoconcediera el acceso vía la propia app (tasks.md 6.13).
 */
export function isAdminEmail(email: string | null | undefined, env: Env = getEnv()): boolean {
  if (!email || !env.ADMIN_EMAILS) return false;
  const allowlist = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
