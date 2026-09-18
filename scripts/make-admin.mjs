#!/usr/bin/env node
/**
 * Otorga el rol 'admin' a una cuenta existente, por email. No hay forma de auto-otorgarse admin
 * desde la app (a propósito): este script lo corre a mano un humano con las claves reales.
 *
 * Uso:
 *   DATABASE_URL=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/make-admin.mjs --email=alguien@ejemplo.com
 *
 * La persona debe haberse registrado antes en /registro; este script no crea cuentas.
 */
import { neon } from "@neondatabase/serverless";
import { createClient } from "@supabase/supabase-js";

const email = process.argv.find((a) => a.startsWith("--email="))?.slice("--email=".length);

if (!email) {
  console.error("Falta --email=alguien@ejemplo.com");
  process.exit(1);
}

const { DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
const missing = [
  !DATABASE_URL && "DATABASE_URL",
  !NEXT_PUBLIC_SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
  !SUPABASE_SERVICE_ROLE_KEY && "SUPABASE_SERVICE_ROLE_KEY",
].filter(Boolean);
if (missing.length > 0) {
  console.error(`Faltan variables de entorno: ${missing.join(", ")}`);
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// La API de admin de Supabase no tiene un "getUserByEmail" directo: hay que paginar listUsers.
let supabaseUserId = null;
for (let page = 1; !supabaseUserId; page += 1) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
  if (error) {
    console.error("Error listando usuarios de Supabase:", error.message);
    process.exit(1);
  }
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (match) {
    supabaseUserId = match.id;
    break;
  }
  if (data.users.length < 200) break; // última página, no se encontró
}

if (!supabaseUserId) {
  console.error(`No se encontró ninguna cuenta de Supabase con el correo ${email}.`);
  console.error("La persona debe registrarse primero en /registro.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const rows = await sql`
  insert into users (supabase_user_id, role)
  values (${supabaseUserId}, 'admin')
  on conflict (supabase_user_id) do update set role = 'admin'
  returning id, role, display_name
`;

console.log(`✓ ${email} ahora es admin.`, rows[0]);
