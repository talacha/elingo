"use client";

import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { AdminConfigResponse, FlagKey } from "@/lib/contracts/admin";
import { NOT_FOUND, NotFoundCard, readError, useAdminConfig } from "./shared";

/** /admin/features: feature flags globales (kill switch para todas las cuentas). */
export function FeaturesSection() {
  const { config, setConfig, loading, error } = useAdminConfig();
  const [flagError, setFlagError] = useState("");

  if (error === NOT_FOUND) return <NotFoundCard />;

  const handleGlobalFlag = async (flag: FlagKey, enabled: boolean) => {
    setFlagError("");
    try {
      const res = await fetch("/api/admin/flags", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ flag, enabled }),
      });
      if (!res.ok) {
        setFlagError(await readError(res, "No se pudo cambiar el flag."));
        return;
      }
      setConfig((await res.json()) as AdminConfigResponse);
    } catch {
      setFlagError("No se pudo cambiar el flag.");
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold mb-2">Funciones (feature flags)</h2>
      <p className="text-sm text-ink-soft mb-4">
        Apagar una función aquí la apaga para todas las cuentas. Cada cuenta puede además apagarla
        por su lado (desde /parents o en la tabla de <Link href="/admin/users" className="underline">usuarios</Link>).
      </p>
      {loading ? (
        <p className="text-ink-soft">Cargando...</p>
      ) : error || !config ? (
        <p className="text-red-600" role="alert">
          {error || "Error al cargar la configuración."}
        </p>
      ) : (
        <ul className="space-y-3">
          {config.flags.map((flag) => (
            <li key={flag.key}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={flag.enabled}
                  onChange={(e) => void handleGlobalFlag(flag.key, e.target.checked)}
                />
                <span>
                  <span className="font-medium">{flag.label}</span>
                  <span className="block text-sm text-ink-soft">
                    {flag.description} Controla: {flag.ui}.
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {flagError && (
        <p className="text-red-600 text-sm mt-3" role="alert">
          {flagError}
        </p>
      )}
    </Card>
  );
}
