import { NextRequest, NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import { updateAiConfigSchema, type AdminAiConfigResponse } from "@/lib/contracts/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user?.email || !isAdminEmail(data.user.email)) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }

    const repo = getRepo();
    const overrides = await repo.getAiConfig();

    const response: AdminAiConfigResponse = { overrides };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[admin/config] GET error:", error);
    return NextResponse.json(
      { error: "not_found" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user?.email || !isAdminEmail(data.user.email)) {
      return NextResponse.json(
        { error: "not_found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = updateAiConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "invalid_request",
          message: "Parámetros inválidos",
        },
        { status: 400 }
      );
    }

    const repo = getRepo();
    await repo.setAiConfig(parsed.data.key, parsed.data.value, data.user.email);

    const overrides = await repo.getAiConfig();
    const response: AdminAiConfigResponse = { overrides };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[admin/config] PUT error:", error);
    return NextResponse.json(
      { error: "not_found" },
      { status: 500 }
    );
  }
}
