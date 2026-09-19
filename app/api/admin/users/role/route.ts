import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminEmail } from "@/lib/auth/adminGuard";
import { getRepo } from "@/lib/db";

export const runtime = "nodejs";

const updateRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["student", "parent", "super-admin"]),
});

export async function PUT(req: NextRequest) {
  try {
    if (!(await getAdminEmail())) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const parsed = updateRoleSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Parámetros inválidos" },
        { status: 400 },
      );
    }

    await getRepo().setUserRole(parsed.data.userId, parsed.data.role);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[admin/users/role] PUT error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
