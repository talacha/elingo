import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { AdminNav } from "@/components/admin/AdminNav";
import { getAdminEmail } from "@/lib/auth/adminGuard";

// Sin título ni descripción a propósito: los metadatos se resuelven aunque el layout responda 404, y
// «Administración» en el <title> revelaría a cualquiera que la ruta existe.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Marco común de /admin/users, /admin/config y /admin/features. El acceso se decide aquí, en el
 * servidor: sin sesión de Supabase con un email de `ADMIN_EMAILS` la ruta responde 404 (igual que
 * /api/admin/*, para no revelar que existe) y ni siquiera se envía la interfaz.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // El acceso depende de la petición: que nunca se prerenderice (p. ej. un build sin las variables de
  // Supabase dejaría un 404 estático para todo el mundo).
  await connection();
  if (!(await getAdminEmail())) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <header className="space-y-4">
        <h1 className="m-0 font-display text-3xl font-bold">Administración</h1>
        <AdminNav />
      </header>
      {children}
    </div>
  );
}
