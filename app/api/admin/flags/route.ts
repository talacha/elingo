import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/adminGuard";
import { buildAdminConfigResponse } from "@/lib/config/adminView";
import { setGlobalFlag } from "@/lib/config/flags";
import { updateGlobalFlagSchema } from "@/lib/contracts/admin";

export const runtime = "nodejs";

/** Enciende/apaga un feature flag para TODAS las cuentas (kill switch global). */
export async function PUT(req: NextRequest) {
  try {
    const email = await getAdminEmail();
    if (!email) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const parsed = updateGlobalFlagSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Parámetros inválidos" },
        { status: 400 },
      );
    }

    await setGlobalFlag(parsed.data.flag, parsed.data.enabled, email);
    return NextResponse.json(await buildAdminConfigResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/flags] PUT error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
