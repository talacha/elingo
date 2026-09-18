import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Cliente de Supabase con `service_role` (bypassa RLS, puede listar usuarios y disparar
 * restablecimientos de contraseña). Solo para código de servidor con privilegios de admin
 * (scripts/make-admin.mjs, app/(app)/admin/**) -- nunca lo importes desde código de cliente.
 * Devuelve null si falta la URL de Supabase o SUPABASE_SERVICE_ROLE_KEY, igual que el resto
 * de clientes de Supabase de este proyecto (degradación elegante sin credenciales).
 */
export function createSupabaseAdminClient() {
  const env = getEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
