"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AdminConfigParam, AdminConfigResponse } from "@/lib/contracts/admin";
import { NOT_FOUND, NotFoundCard, inputClass, readError, useAdminConfig } from "./shared";

const CATEGORY_TITLES: Record<AdminConfigParam["category"], string> = {
  ia: "Proveedor",
  modelos: "Modelos",
  voz: "Voz",
  limites: "Límites",
};
const CATEGORY_ORDER: AdminConfigParam["category"][] = ["ia", "modelos", "voz", "limites"];

/** /admin/config: proveedor, modelos, voz y límites; se guardan en Postgres y se aplican sin redeploy. */
export function ConfigSection() {
  const { config, setConfig, loading, error } = useAdminConfig();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (error === NOT_FOUND) return <NotFoundCard />;

  const handleEdit = (param: AdminConfigParam) => {
    setEditingKey(param.key);
    setEditingValue(param.value);
    setSaveError("");
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditingValue("");
    setSaveError("");
  };

  /** PUT (guardar) o DELETE (volver a la variable de entorno) de un parámetro. */
  const send = async (method: "PUT" | "DELETE", key: string, value?: string) => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/admin/config", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(method === "PUT" ? { key, value } : { key }),
      });
      if (!res.ok) {
        setSaveError(await readError(res, "Error al guardar."));
        return;
      }
      setConfig((await res.json()) as AdminConfigResponse);
      setEditingKey(null);
      setEditingValue("");
    } catch {
      setSaveError("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="text-2xl font-semibold mb-2">Configuración de IA</h2>
      <p className="text-sm text-ink-soft mb-4">
        Se guarda en la base de datos y se aplica sin volver a desplegar (con caché en Redis); no
        sustituye una revisión humana del cambio. Sin valor guardado manda la variable de entorno.
      </p>

      {loading ? (
        <p className="text-ink-soft">Cargando configuración...</p>
      ) : error || !config ? (
        <p className="text-red-600" role="alert">
          {error || "Error al cargar la configuración."}
        </p>
      ) : (
        <div className="space-y-6">
          <p className="text-sm rounded bg-surface-2 px-3 py-2" data-testid="active-model">
            Activo ahora: <strong>{config.provider}</strong> · <strong>{config.activeModel}</strong>
          </p>

          {CATEGORY_ORDER.map((category) => {
            const params = config.params.filter((p) => p.category === category);
            if (params.length === 0) return null;
            return (
              <section key={category} aria-label={CATEGORY_TITLES[category]}>
                <h3 className="text-lg font-semibold mb-2">{CATEGORY_TITLES[category]}</h3>
                <div className="space-y-4">
                  {params.map((param) => {
                    const isEditing = editingKey === param.key;
                    return (
                      <div key={param.key} className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-64">
                          <label htmlFor={`cfg-${param.key}`} className="block text-sm font-medium">
                            {param.label} <code className="text-xs text-ink-soft">{param.key}</code>
                          </label>
                          <p className="text-xs text-ink-soft mb-1">{param.description}</p>
                          {isEditing && param.kind === "provider" ? (
                            <select
                              id={`cfg-${param.key}`}
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className={inputClass}
                              disabled={saving}
                            >
                              {param.options?.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          ) : isEditing ? (
                            <input
                              id={`cfg-${param.key}`}
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              className={inputClass}
                              disabled={saving}
                            />
                          ) : (
                            <p id={`cfg-${param.key}`} className="text-ink">
                              {param.value || "(sin valor)"}{" "}
                              <span className="text-xs text-ink-soft">
                                {!param.editable
                                  ? "(solo lectura: variable de entorno)"
                                  : param.source === "db"
                                    ? "(guardado desde /admin)"
                                    : "(variable de entorno o valor por defecto)"}
                              </span>
                            </p>
                          )}
                        </div>
                        {param.editable && (
                          <div className="flex gap-2">
                            {isEditing ? (
                              <>
                                <Button
                                  onClick={() => void send("PUT", param.key, editingValue)}
                                  disabled={saving}
                                  variant="primary"
                                  size="md"
                                >
                                  {saving ? "Guardando..." : "Guardar"}
                                </Button>
                                <Button onClick={handleCancel} disabled={saving} variant="secondary" size="md">
                                  Cancelar
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button onClick={() => handleEdit(param)} variant="secondary" size="md">
                                  Editar
                                </Button>
                                {param.source === "db" && (
                                  <Button
                                    onClick={() => void send("DELETE", param.key)}
                                    disabled={saving}
                                    variant="ghost"
                                    size="md"
                                  >
                                    Restablecer
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {saveError && (
            <p className="text-red-600 text-sm" role="alert">
              {saveError}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
