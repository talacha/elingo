"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { AdminConfigResponse } from "@/lib/contracts/admin";

export const NOT_FOUND = "Página no encontrada.";

export const inputClass =
  "w-full px-3 py-2 border border-line rounded bg-surface focus:outline-none focus:ring-2 focus:ring-accent";

/** Mensaje de error de una respuesta de la API, o `fallback` si no trae ninguno. */
export async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : fallback;
}

export function NotFoundCard() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <p className="text-center text-ink-soft">{NOT_FOUND}</p>
    </Card>
  );
}

/**
 * Carga `GET /api/admin/config` (parámetros efectivos + flags globales). Lo usan las secciones de
 * configuración, funciones y usuarios (que necesita los flags para sus columnas).
 */
export function useAdminConfig() {
  const [config, setConfig] = useState<AdminConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/config");
        if (cancelled) return;
        if (res.status === 404) setError(NOT_FOUND);
        else if (res.ok) setConfig((await res.json()) as AdminConfigResponse);
        else setError("Error al cargar la configuración.");
      } catch {
        if (!cancelled) setError(NOT_FOUND);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { config, setConfig, loading, error };
}
