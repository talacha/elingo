import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRepo } from "@/lib/db";
import { parseGrade } from "@/lib/contracts/grade";

export const runtime = "nodejs";

const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(200),
  // Acepta "K", "1"…"12" y los valores antiguos ("6º", "1º ESO"); se guarda siempre el canónico.
  grade: z
    .string()
    .max(100)
    .transform((value, ctx) => {
      const grade = parseGrade(value);
      if (!grade) ctx.addIssue({ code: "custom", message: "Grado no válido (K-12)" });
      return grade ?? "6";
    }),
});

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "unauthorized", message: "Autenticación no disponible" },
        { status: 401 }
      );
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_request", message: "Datos inválidos" },
        { status: 400 }
      );
    }

    const repo = getRepo();
    const result = await repo.upsertUserFromSupabase({
      supabaseUserId: data.user.id,
      displayName: parsed.data.displayName,
      grade: parsed.data.grade,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[perfil] PATCH error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al guardar el perfil" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json(
        { error: "unauthorized", message: "Autenticación no disponible" },
        { status: 401 }
      );
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user?.id) {
      return NextResponse.json(
        { error: "unauthorized", message: "No autenticado" },
        { status: 401 }
      );
    }

    const repo = getRepo();
    const user = await repo.getUser(data.user.id);

    if (!user) {
      return NextResponse.json(
        { error: "not_found", message: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json(user, { status: 200 });
  } catch (error) {
    console.error("[perfil] GET error:", error);
    return NextResponse.json(
      { error: "upstream_error", message: "Error al obtener el perfil" },
      { status: 500 }
    );
  }
}
