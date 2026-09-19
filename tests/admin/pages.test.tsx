import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import AdminLayout, { metadata as layoutMetadata } from "@/app/(app)/admin/layout";
import * as usersPageModule from "@/app/(app)/admin/users/page";
import * as configPageModule from "@/app/(app)/admin/config/page";
import * as featuresPageModule from "@/app/(app)/admin/features/page";
import AdminIndexPage from "@/app/(app)/admin/page";
import AdminUsersPage from "@/app/(app)/admin/users/page";
import AdminConfigPage from "@/app/(app)/admin/config/page";
import AdminFeaturesPage from "@/app/(app)/admin/features/page";
import { ADMIN_SECTIONS } from "@/components/admin/AdminNav";
import { ConfigSection } from "@/components/admin/ConfigSection";
import { FeaturesSection } from "@/components/admin/FeaturesSection";
import { UsersSection } from "@/components/admin/UsersSection";

vi.mock("@/lib/auth/adminGuard", () => ({ getAdminEmail: vi.fn() }));
// `connection()` solo existe dentro de una petición real de Next.js.
vi.mock("next/server", async () => ({
  ...(await vi.importActual<typeof import("next/server")>("next/server")),
  connection: vi.fn().mockResolvedValue(undefined),
}));

import { connection } from "next/server";
import { getAdminEmail } from "@/lib/auth/adminGuard";

/** El error interno con el que Next.js corta el render en `notFound()` / `redirect()`. */
function digestOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? "");
  }
  return "";
}

async function digestOfAsync(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error) {
    return String((error as { digest?: string }).digest ?? "");
  }
  return "";
}

describe("/admin: tres secciones, cada una en su ruta", () => {
  it("define las tres rutas: usuarios, configuración y funciones", () => {
    expect(ADMIN_SECTIONS.map((s) => s.href)).toEqual(["/admin/users", "/admin/config", "/admin/features"]);
    expect(ADMIN_SECTIONS.map((s) => s.label)).toEqual(["Usuarios", "Configuración", "Funciones"]);
    expect(new Set(ADMIN_SECTIONS.map((s) => s.segment)).size).toBe(3);
  });

  it("/admin redirige a la primera sección", () => {
    expect(digestOf(() => AdminIndexPage())).toContain("NEXT_REDIRECT");
    expect(digestOf(() => AdminIndexPage())).toContain("/admin/users");
  });

  it("cada ruta muestra solo su sección", () => {
    expect((AdminUsersPage() as ReactElement).type).toBe(UsersSection);
    expect((AdminConfigPage() as ReactElement).type).toBe(ConfigSection);
    expect((AdminFeaturesPage() as ReactElement).type).toBe(FeaturesSection);
  });
});

describe("/admin: los metadatos no revelan que la ruta existe", () => {
  it("el layout no exporta título ni descripción (se resuelven aunque responda 404) y pide no indexar", () => {
    expect(layoutMetadata.title).toBeUndefined();
    expect(layoutMetadata.description).toBeUndefined();
    expect(layoutMetadata.robots).toMatchObject({ index: false });
  });

  it("las páginas tampoco exportan metadatos propios", () => {
    for (const mod of [usersPageModule, configPageModule, featuresPageModule]) {
      expect(Object.keys(mod)).not.toContain("metadata");
      expect(Object.keys(mod)).not.toContain("generateMetadata");
    }
  });
});

describe("/admin: el acceso se decide en el servidor (layout)", () => {
  beforeEach(() => {
    vi.mocked(getAdminEmail).mockReset();
    vi.mocked(connection).mockClear();
  });

  it("nunca se prerenderiza: espera a la petición antes de decidir el acceso", async () => {
    vi.mocked(getAdminEmail).mockResolvedValue("admin@example.com");
    await AdminLayout({ children: null });
    expect(connection).toHaveBeenCalledTimes(1);
    expect(vi.mocked(connection).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getAdminEmail).mock.invocationCallOrder[0],
    );
  });

  it("sin admin autenticado responde 404 y no envía la interfaz", async () => {
    vi.mocked(getAdminEmail).mockResolvedValue(null);
    const digest = await digestOfAsync(() => AdminLayout({ children: null }));
    expect(digest).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("con un admin autenticado devuelve el marco con el título y la navegación", async () => {
    vi.mocked(getAdminEmail).mockResolvedValue("admin@example.com");
    const element = (await AdminLayout({ children: "contenido" })) as ReactElement<{ children: unknown[] }>;
    expect(element).toBeTruthy();
    expect(JSON.stringify(element, (_k, v) => (typeof v === "function" ? v.name : v))).toContain("Administración");
    expect(JSON.stringify(element, (_k, v) => (typeof v === "function" ? v.name : v))).toContain("AdminNav");
  });
});
