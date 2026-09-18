import { describe, expect, it } from "vitest";
import { isAdminEmail } from "@/lib/auth/admin";
import { getEnv } from "@/lib/env";

const withAdminEmails = (value: string | undefined) => ({ ...getEnv(), ADMIN_EMAILS: value });

describe("isAdminEmail", () => {
  it("vacío por defecto: nadie es admin", () => {
    expect(isAdminEmail("a@b.com", withAdminEmails(undefined))).toBe(false);
    expect(isAdminEmail(null, withAdminEmails(undefined))).toBe(false);
    expect(isAdminEmail(undefined, withAdminEmails(undefined))).toBe(false);
  });

  it("acepta un correo en la lista, insensible a mayúsculas y espacios", () => {
    const env = withAdminEmails("Admin@Eli.ngo, otro@eli.ngo");
    expect(isAdminEmail("admin@eli.ngo", env)).toBe(true);
    expect(isAdminEmail("  OTRO@ELI.NGO  ", env)).toBe(true);
    expect(isAdminEmail("nadie@eli.ngo", env)).toBe(false);
  });

  it("nunca confunde un rol de la base de datos con ser admin (solo mira ADMIN_EMAILS)", () => {
    // isAdminEmail no recibe ni consulta ningún "role" de usuario, solo el email frente a la env var.
    expect(isAdminEmail("student@eli.ngo", withAdminEmails(""))).toBe(false);
  });
});
