import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "parent", "super-admin"]),
});

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
    const parsed = updateRoleSchema.safeParse(body);

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
    await repo.setUserRole(parsed.data.userId, parsed.data.role);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[admin/users/role] PUT error:", error);
    return NextResponse.json(
      { error: "not_found" },
      { status: 500 }
    );
  }
}
