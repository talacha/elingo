"use client";

import { useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type {
  AdminConfigParam,
  AdminConfigResponse,
  AdminUsersResponse,
  FlagKey,
} from "@/lib/contracts/admin";

const NOT_FOUND = "Página no encontrada.";

const CATEGORY_TITLES: Record<AdminConfigParam["category"], string> = {
  ia: "Proveedor",
  modelos: "Modelos",
  voz: "Voz",
  limites: "Límites",
};
const CATEGORY_ORDER: AdminConfigParam["category"][] = ["ia", "modelos", "voz", "limites"];

const inputClass =
  "w-full px-3 py-2 border border-line rounded bg-surface focus:outline-none focus:ring-2 focus:ring-accent";

async function readError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => ({}));
  return typeof body.message === "string" ? body.message : fallback;
}

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUsersResponse["users"]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [config, setConfig] = useState<AdminConfigResponse | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [flagError, setFlagError] = useState("");

  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, configRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/config"),
        ]);

        if (usersRes.status === 404 || configRes.status === 404) {
          setUsersError(NOT_FOUND);
          setConfigError(NOT_FOUND);
          return;
        }

        if (usersRes.ok) {
          setUsers(((await usersRes.json()) as AdminUsersResponse).users);
        } else {
          setUsersError("Error al cargar los usuarios.");
        }

        if (configRes.ok) {
          setConfig((await configRes.json()) as AdminConfigResponse);
        } else {
          setConfigError("Error al cargar la configuración.");
        }
      } catch {
        setUsersError(NOT_FOUND);
        setConfigError(NOT_FOUND);
      } finally {
        setUsersLoading(false);
        setConfigLoading(false);
      }
    }

    loadData();
  }, []);

  const handleConfigEdit = (param: AdminConfigParam) => {
    setEditingKey(param.key);
    setEditingValue(param.value);
    setSaveError("");
  };

  const handleConfigCancel = () => {
    setEditingKey(null);
    setEditingValue("");
    setSaveError("");
  };

  /** PUT (guardar) o DELETE (volver a la variable de entorno) de un parámetro. */
  const sendConfig = useCallback(async (method: "PUT" | "DELETE", key: string, value?: string) => {
    setSavingConfig(true);
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
      setSavingConfig(false);
    }
  }, []);

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

  /** Marcada = la cuenta sigue al global (sin override); desmarcada = apagada solo para esa cuenta. */
  const handleAccountFlag = async (userId: string, flag: FlagKey, on: boolean) => {
    setFlagError("");
    try {
      const res = await fetch("/api/admin/users/flags", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, flag, enabled: on ? null : false }),
      });
      if (!res.ok) {
        setFlagError(await readError(res, "No se pudo cambiar el flag de la cuenta."));
        return;
      }
      setUsers((prev) =>
        prev.map((u) => {
          if (u.id !== userId) return u;
          const flagOverrides = { ...u.flagOverrides };
          if (on) delete flagOverrides[flag];
          else flagOverrides[flag] = false;
          return { ...u, flagOverrides };
        }),
      );
    } catch {
      setFlagError("No se pudo cambiar el flag de la cuenta.");
    }
  };

  const handleRoleEdit = (userId: string, currentRole: string) => {
    setEditingRoleUserId(userId);
    setEditingRole(currentRole);
    setRoleError("");
  };

  const handleRoleCancel = () => {
    setEditingRoleUserId(null);
    setEditingRole("");
  };

  const handleRoleSave = async () => {
    if (!editingRoleUserId) return;
    setSavingRole(true);
    setRoleError("");
    try {
      const res = await fetch("/api/admin/users/role", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: editingRoleUserId, role: editingRole }),
      });
      if (!res.ok) {
        setRoleError("No se pudo cambiar el rol.");
        return;
      }
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingRoleUserId
            ? { ...u, role: editingRole as "student" | "parent" | "super-admin" }
            : u,
        ),
      );
      setEditingRoleUserId(null);
      setEditingRole("");
    } catch {
      setRoleError("No se pudo cambiar el rol.");
    } finally {
      setSavingRole(false);
    }
  };

  if (usersError === NOT_FOUND || configError === NOT_FOUND) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft">{NOT_FOUND}</p>
      </Card>
    );
  }

  const flags = config?.flags ?? [];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 space-y-8">
      {/* Feature flags */}
      <Card>
        <h2 className="text-2xl font-semibold mb-2">Funciones (feature flags)</h2>
        <p className="text-sm text-ink-soft mb-4">
          Apagar una función aquí la apaga para todas las cuentas. Cada cuenta puede además apagarla
          por su lado (desde /parents o en la tabla de usuarios).
        </p>
        {configLoading ? (
          <p className="text-ink-soft">Cargando...</p>
        ) : (
          <ul className="space-y-3">
            {flags.map((flag) => (
              <li key={flag.key}>
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5"
                    checked={flag.enabled}
                    onChange={(e) => handleGlobalFlag(flag.key, e.target.checked)}
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

      {/* AI Config Section */}
      <Card>
        <h2 className="text-2xl font-semibold mb-2">Configuración de IA</h2>
        <p className="text-sm text-ink-soft mb-4">
          Se guarda en la base de datos y se aplica sin volver a desplegar (con caché en Redis); no
          sustituye una revisión humana del cambio. Sin valor guardado manda la variable de entorno.
        </p>

        {configLoading ? (
          <p className="text-ink-soft">Cargando configuración...</p>
        ) : configError || !config ? (
          <p className="text-red-600" role="alert">
            {configError || "Error al cargar la configuración."}
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
                                disabled={savingConfig}
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
                                disabled={savingConfig}
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
                                    onClick={() => sendConfig("PUT", param.key, editingValue)}
                                    disabled={savingConfig}
                                    variant="primary"
                                    size="md"
                                  >
                                    {savingConfig ? "Guardando..." : "Guardar"}
                                  </Button>
                                  <Button
                                    onClick={handleConfigCancel}
                                    disabled={savingConfig}
                                    variant="secondary"
                                    size="md"
                                  >
                                    Cancelar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    onClick={() => handleConfigEdit(param)}
                                    variant="secondary"
                                    size="md"
                                  >
                                    Editar
                                  </Button>
                                  {param.source === "db" && (
                                    <Button
                                      onClick={() => sendConfig("DELETE", param.key)}
                                      disabled={savingConfig}
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

      {/* Users Section */}
      <Card>
        <h2 className="text-2xl font-semibold mb-4">Usuarios</h2>
        {usersLoading ? (
          <p className="text-ink-soft">Cargando usuarios...</p>
        ) : usersError ? (
          <p className="text-red-600" role="alert">
            {usersError}
          </p>
        ) : users.length === 0 ? (
          <p className="text-ink-soft">No hay usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            {roleError && (
              <p className="text-red-600 text-sm mb-2" role="alert">
                {roleError}
              </p>
            )}
            <table className="w-full text-sm">
              <thead className="border-b border-line">
                <tr>
                  <th className="text-left py-2 px-4 font-semibold">Nombre</th>
                  <th className="text-left py-2 px-4 font-semibold">Rol</th>
                  {flags.map((flag) => (
                    <th key={flag.key} className="text-center py-2 px-4 font-semibold">
                      {flag.label}
                    </th>
                  ))}
                  <th className="text-left py-2 px-4 font-semibold">Creado</th>
                  <th className="text-right py-2 px-4 font-semibold">Sesiones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-line">
                    <td className="py-3 px-4">
                      {user.displayName || <span className="text-ink-soft italic">Sin nombre</span>}
                    </td>
                    <td className="py-3 px-4">
                      {editingRoleUserId === user.id ? (
                        <div className="flex gap-2 items-center">
                          <select
                            aria-label="Rol"
                            value={editingRole}
                            onChange={(e) => setEditingRole(e.target.value)}
                            disabled={savingRole}
                            className="px-2 py-1 border border-line rounded bg-surface focus:outline-none focus:ring-2 focus:ring-accent"
                          >
                            <option value="student">student</option>
                            <option value="parent">parent</option>
                            <option value="super-admin">super-admin</option>
                          </select>
                          <Button onClick={handleRoleSave} disabled={savingRole} variant="primary" size="md">
                            {savingRole ? "..." : "✓"}
                          </Button>
                          <Button onClick={handleRoleCancel} disabled={savingRole} variant="secondary" size="md">
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2 items-center">
                          {user.role}
                          <Button
                            onClick={() => handleRoleEdit(user.id, user.role)}
                            variant="secondary"
                            size="md"
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </td>
                    {flags.map((flag) => (
                      <td key={flag.key} className="py-3 px-4 text-center">
                        <input
                          type="checkbox"
                          className="h-5 w-5"
                          aria-label={`${flag.label} para ${user.displayName || "esta cuenta"}`}
                          checked={user.flagOverrides[flag.key] ?? true}
                          onChange={(e) => handleAccountFlag(user.id, flag.key, e.target.checked)}
                        />
                      </td>
                    ))}
                    <td className="py-3 px-4 text-ink-soft">
                      {new Date(user.createdAt).toLocaleDateString("es-ES")}
                    </td>
                    <td className="py-3 px-4 text-right">{user.sessionCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
