import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/adminGuard";
import { buildAdminConfigResponse } from "@/lib/config/adminView";
import { getParamDef } from "@/lib/config/registry";
import { deleteConfigRow, setConfigRow } from "@/lib/config/store";
import { validateParamValue } from "@/lib/config/validate";
import { clearConfigSchema, updateConfigSchema } from "@/lib/contracts/admin";

export const runtime = "nodejs";

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });
const internalError = () => NextResponse.json({ error: "internal_error" }, { status: 500 });
const invalid = (message: string) =>
  NextResponse.json({ error: "invalid_request", message }, { status: 400 });

export async function GET() {
  try {
    if (!(await getAdminEmail())) return notFound();
    return NextResponse.json(await buildAdminConfigResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/config] GET error:", error);
    return internalError();
  }
}

/** Guarda un parámetro en Postgres (invalida la caché de Redis; el siguiente /api/chat ya lo usa). */
export async function PUT(req: NextRequest) {
  try {
    const email = await getAdminEmail();
    if (!email) return notFound();

    const parsed = updateConfigSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return invalid("Parámetros inválidos");

    const checked = await validateParamValue(parsed.data.key, parsed.data.value);
    if (!checked.ok) return invalid(checked.message);

    await setConfigRow(parsed.data.key, checked.value, email);
    return NextResponse.json(await buildAdminConfigResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/config] PUT error:", error);
    return internalError();
  }
}

/** Quita el valor guardado: el parámetro vuelve a la variable de entorno. */
export async function DELETE(req: NextRequest) {
  try {
    if (!(await getAdminEmail())) return notFound();

    const parsed = clearConfigSchema.safeParse(await req.json().catch(() => null));
    const def = parsed.success ? getParamDef(parsed.data.key) : undefined;
    if (!parsed.success || !def?.editable) return invalid("Parámetro desconocido o no editable");

    await deleteConfigRow(def.key);
    return NextResponse.json(await buildAdminConfigResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/config] DELETE error:", error);
    return internalError();
  }
}
