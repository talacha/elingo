"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { AdminUsersResponse, FlagKey } from "@/lib/contracts/admin";
import { NOT_FOUND, NotFoundCard, readError, useAdminConfig } from "./shared";

/** /admin/users: cuentas, su rol y sus flags por cuenta. */
export function UsersSection() {
  const [users, setUsers] = useState<AdminUsersResponse["users"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Solo para las columnas de flags (su definición y etiquetas).
  const { config } = useAdminConfig();
  const flags = config?.flags ?? [];

  const [editingRoleUserId, setEditingRoleUserId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [flagError, setFlagError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/users");
        if (cancelled) return;
        if (res.status === 404) setError(NOT_FOUND);
        else if (res.ok) setUsers(((await res.json()) as AdminUsersResponse).users);
        else setError("Error al cargar los usuarios.");
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

  if (error === NOT_FOUND) return <NotFoundCard />;

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

  return (
    <Card>
      <h2 className="text-2xl font-semibold mb-4">Usuarios</h2>
      {loading ? (
        <p className="text-ink-soft">Cargando usuarios...</p>
      ) : error ? (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      ) : users.length === 0 ? (
        <p className="text-ink-soft">No hay usuarios.</p>
      ) : (
        <div className="overflow-x-auto">
          {(roleError || flagError) && (
            <p className="text-red-600 text-sm mb-2" role="alert">
              {roleError || flagError}
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
                        <Button onClick={() => void handleRoleSave()} disabled={savingRole} variant="primary" size="md">
                          {savingRole ? "..." : "✓"}
                        </Button>
                        <Button onClick={handleRoleCancel} disabled={savingRole} variant="secondary" size="md">
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        {user.role}
                        <Button onClick={() => handleRoleEdit(user.id, user.role)} variant="secondary" size="md">
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
                        onChange={(e) => void handleAccountFlag(user.id, flag.key, e.target.checked)}
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
  );
}
