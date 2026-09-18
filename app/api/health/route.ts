import { NextResponse } from "next/server";
import { getEnv, resolveProvider } from "@/lib/env";
import { getProvider } from "@/lib/ai/providers";
import { getRepo } from "@/lib/db";
import { hasRedisCredentials } from "@/lib/ratelimit";

export const runtime = "nodejs";

/** Health check endpoint. Retorna el estado de configuración de la app. */
export async function GET() {
  try {
    const env = getEnv();
    const repo = getRepo();
    const provider = resolveProvider(env);
    const providerInstance = getProvider(env);

    // Read package.json version
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const packageJson = require("../../../package.json");

    return NextResponse.json(
      {
        ok: true,
        provider,
        model: providerInstance.model,
        db: repo.kind,
        redis: hasRedisCredentials(env),
        version: packageJson.version ?? "unknown",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[health] Error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to check health",
      },
      { status: 500 }
    );
  }
}
