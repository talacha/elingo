import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import type { AdminUsersResponse } from "@/lib/contracts/admin";

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
    const users = await repo.listAllUsers();

    const response: AdminUsersResponse = { users };
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[admin/users] GET error:", error);
    return NextResponse.json(
      { error: "not_found" },
      { status: 500 }
    );
  }
}
