import { NextResponse } from "next/server";
import { getAdminEmail } from "@/lib/auth/adminGuard";
import { getRepo } from "@/lib/db";
import type { AdminUsersResponse } from "@/lib/contracts/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await getAdminEmail())) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const users = await getRepo().listAllUsers();
    const response: AdminUsersResponse = { users };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[admin/users] GET error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
