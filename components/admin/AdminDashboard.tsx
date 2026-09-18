"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AI_CONFIG_KEYS, type AdminAiConfigResponse, type AdminUsersResponse, type AiConfigKey } from "@/lib/contracts/admin";

interface AdminDashboardState {
  usersLoading: boolean;
  usersError: string;
  users: AdminUsersResponse["users"];
  configLoading: boolean;
  configError: string;
  config: Record<string, string>;
  editingKey: AiConfigKey | null;
  editingValue: string;
  savingConfig: boolean;
  saveError: string;
}

export function AdminDashboard() {
  const [state, setState] = useState<AdminDashboardState>({
    usersLoading: true,
    usersError: "",
    users: [],
    configLoading: true,
    configError: "",
    config: {},
    editingKey: null,
    editingValue: "",
    savingConfig: false,
    saveError: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [usersRes, configRes] = await Promise.all([
          fetch("/api/admin/users"),
          fetch("/api/admin/config"),
        ]);

        if (usersRes.status === 404 || configRes.status === 404) {
          setState((prev) => ({
            ...prev,
            usersError: "Página no encontrada.",
            configError: "Página no encontrada.",
            usersLoading: false,
            configLoading: false,
          }));
          return;
        }

        if (!usersRes.ok) {
          setState((prev) => ({
            ...prev,
            usersError: "Error al cargar los usuarios.",
            usersLoading: false,
          }));
        } else {
          const usersData: AdminUsersResponse = await usersRes.json();
          setState((prev) => ({
            ...prev,
            users: usersData.users,
            usersError: "",
            usersLoading: false,
          }));
        }

        if (!configRes.ok) {
          setState((prev) => ({
            ...prev,
            configError: "Error al cargar la configuración.",
            configLoading: false,
          }));
        } else {
          const configData: AdminAiConfigResponse = await configRes.json();
          setState((prev) => ({
            ...prev,
            config: configData.overrides,
            configError: "",
            configLoading: false,
          }));
        }
      } catch {
        setState((prev) => ({
          ...prev,
          usersError: "Página no encontrada.",
          configError: "Página no encontrada.",
          usersLoading: false,
          configLoading: false,
        }));
      }
    }

    loadData();
  }, []);

  const handleConfigEdit = (key: AiConfigKey) => {
    setState((prev) => ({
      ...prev,
      editingKey: key,
      editingValue: prev.config[key] ?? "",
    }));
  };

  const handleConfigCancel = () => {
    setState((prev) => ({
      ...prev,
      editingKey: null,
      editingValue: "",
      saveError: "",
    }));
  };

  const handleConfigSave = async () => {
    if (!state.editingKey) return;

    setState((prev) => ({
      ...prev,
      savingConfig: true,
      saveError: "",
    }));

    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key: state.editingKey,
          value: state.editingValue,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState((prev) => ({
          ...prev,
          savingConfig: false,
          saveError: body.message ?? "Error al guardar.",
        }));
        return;
      }

      const data: AdminAiConfigResponse = await res.json();
      setState((prev) => ({
        ...prev,
        config: data.overrides,
        editingKey: null,
        editingValue: "",
        savingConfig: false,
        saveError: "",
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        savingConfig: false,
        saveError: "Error al guardar.",
      }));
    }
  };

  if (
    state.usersError === "Página no encontrada." ||
    state.configError === "Página no encontrada."
  ) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft">Página no encontrada.</p>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 space-y-8">
      {/* Users Section */}
      <Card>
        <h2 className="text-2xl font-semibold mb-4">Usuarios</h2>
        {state.usersLoading ? (
          <p className="text-ink-soft">Cargando usuarios...</p>
        ) : state.usersError ? (
          <p className="text-red-600" role="alert">
            {state.usersError}
          </p>
        ) : state.users.length === 0 ? (
          <p className="text-ink-soft">No hay usuarios.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-ink-lighter">
                <tr>
                  <th className="text-left py-2 px-4 font-semibold">Nombre</th>
                  <th className="text-left py-2 px-4 font-semibold">Rol</th>
                  <th className="text-left py-2 px-4 font-semibold">Creado</th>
                  <th className="text-right py-2 px-4 font-semibold">Sesiones</th>
                </tr>
              </thead>
              <tbody>
                {state.users.map((user) => (
                  <tr key={user.id} className="border-b border-ink-lighter">
                    <td className="py-3 px-4">
                      {user.displayName || <span className="text-ink-soft italic">Sin nombre</span>}
                    </td>
                    <td className="py-3 px-4">{user.role}</td>
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

      {/* AI Config Section */}
      <Card>
        <h2 className="text-2xl font-semibold mb-2">Modelo de IA activo</h2>
        <p className="text-sm text-ink-soft mb-6">
          Esto cambia el modelo activo sin volver a desplegar; no sustituye una revisión humana del
          cambio.
        </p>

        {state.configLoading ? (
          <p className="text-ink-soft">Cargando configuración...</p>
        ) : state.configError ? (
          <p className="text-red-600" role="alert">
            {state.configError}
          </p>
        ) : (
          <div className="space-y-4">
            {AI_CONFIG_KEYS.map((key) => {
              const isEditing = state.editingKey === key;
              const value = state.config[key];
              const displayValue = value || "(usa la variable de entorno)";

              return (
                <div key={key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">{key}</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={state.editingValue}
                        onChange={(e) =>
                          setState((prev) => ({
                            ...prev,
                            editingValue: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 border border-ink-lighter rounded bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent"
                        disabled={state.savingConfig}
                      />
                    ) : (
                      <p className="text-ink-soft">{displayValue}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <Button
                          onClick={handleConfigSave}
                          disabled={state.savingConfig}
                          variant="primary"
                          size="md"
                        >
                          {state.savingConfig ? "Guardando..." : "Guardar"}
                        </Button>
                        <Button
                          onClick={handleConfigCancel}
                          disabled={state.savingConfig}
                          variant="secondary"
                          size="md"
                        >
                          Cancelar
                        </Button>
                      </>
                    ) : (
                      <Button
                        onClick={() => handleConfigEdit(key)}
                        variant="secondary"
                        size="md"
                      >
                        Editar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {state.saveError && (
              <p className="text-red-600 text-sm" role="alert">
                {state.saveError}
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
