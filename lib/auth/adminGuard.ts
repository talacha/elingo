import { isAdminEmail } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Email del admin autenticado, o `null` si no hay sesión de Supabase o el email no está en
 * `ADMIN_EMAILS`. Las rutas de /api/admin responden 404 ante `null` para no revelar que existen.
 */
export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  return email && isAdminEmail(email) ? email : null;
}
