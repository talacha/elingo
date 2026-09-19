import { NextRequest, NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/adminGuard";
import { getRepo } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { describeEffectiveAiConfig } from "@/lib/ai/config";
import { resetAiConfigOverridesCache } from "@/lib/ai/providers";
import { updateAiConfigSchema, type AdminAiConfigResponse, type AiConfigKey } from "@/lib/contracts/admin";

export const runtime = "nodejs";

const notFound = () => NextResponse.json({ error: "not_found" }, { status: 404 });

async function buildResponse(): Promise<AdminAiConfigResponse> {
  const overrides = (await getRepo().getAiConfig()) as Partial<Record<AiConfigKey, string>>;
  return { overrides, effective: describeEffectiveAiConfig(getEnv(), overrides) };
}

export async function GET() {
  try {
    if (!(await getAdminEmail())) return notFound();
    return NextResponse.json(await buildResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/config] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const email = await getAdminEmail();
    if (!email) return notFound();

    const parsed = updateAiConfigSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: parsed.error.issues[0]?.message ?? "Parámetros inválidos",
        },
        { status: 400 },
      );
    }

    await getRepo().setAiConfig(parsed.data.key, parsed.data.value, email);
    // Que el siguiente /api/chat de este proceso ya use el cambio, sin esperar al TTL de 30 s.
    resetAiConfigOverridesCache();

    return NextResponse.json(await buildResponse(), { status: 200 });
  } catch (error) {
    console.error("[admin/config] PUT error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
