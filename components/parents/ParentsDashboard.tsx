"use client";

import { useEffect, useState } from "react";
import type { ParentInsightsResponse } from "@/lib/contracts/parents";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const SUBJECT_NAMES: Record<string, string> = {
  mates: "Mates",
  lengua: "Lengua",
  ciencias: "Ciencias",
};

type Page = "lock" | "set-safe-word" | "unlock" | "dashboard";

export function ParentsDashboard() {
  const [page, setPage] = useState<Page>("lock");
  const [insights, setInsights] = useState<ParentInsightsResponse | null>(null);
  const [safeWord, setSafeWord] = useState("");
  const [safeWordConfirm, setSafeWordConfirm] = useState("");
  const [unlockWord, setUnlockWord] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [updatingSettings, setUpdatingSettings] = useState<string | null>(null);

  // On mount, try to fetch insights
  useEffect(() => {
    fetchInsights();
  }, []);

  async function fetchInsights() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/parents/insights");
      const data = await res.json();

      if (res.ok) {
        setInsights(data);
        setPage("dashboard");
      } else if (res.status === 401) {
        if (data.error === "unauthorized" && data.message?.includes("desbloquear")) {
          setPage("unlock");
        } else {
          setPage("lock");
        }
      } else {
        setError(data.message || "Error desconocido.");
      }
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetSafeWord() {
    setError("");
    if (!safeWord.trim()) {
      setError("Por favor, ingresa una palabra segura.");
      return;
    }
    if (safeWord.length < 4) {
      setError("La palabra segura debe tener al menos 4 caracteres.");
      return;
    }
    if (safeWord !== safeWordConfirm) {
      setError("Las palabras no coinciden.");
      return;
    }

    setWorking(true);
    try {
      const res = await fetch("/api/parents/safe-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeWord }),
      });

      if (res.ok) {
        setSafeWord("");
        setSafeWordConfirm("");
        await fetchInsights();
      } else {
        const data = await res.json();
        setError(data.message || "Error al establecer la palabra segura.");
      }
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function handleUnlock() {
    setError("");
    if (!unlockWord.trim()) {
      setError("Por favor, ingresa la palabra segura.");
      return;
    }

    setWorking(true);
    try {
      const res = await fetch("/api/parents/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ safeWord: unlockWord }),
      });

      if (res.ok) {
        setUnlockWord("");
        await fetchInsights();
      } else {
        const data = await res.json();
        if (data.error === "needs_safe_word") {
          setPage("set-safe-word");
          setError("");
        } else {
          setError(data.message || "Palabra segura incorrecta.");
        }
      }
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setWorking(false);
    }
  }

  async function handleSettingsChange(field: "allowImages" | "allowVoice" | "allowText") {
    if (!insights) return;
    setUpdatingSettings(field);
    setError("");

    const newValue = !insights.settings[field];
    try {
      const res = await fetch("/api/parents/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: newValue }),
      });

      if (res.ok) {
        const updated = await res.json();
        setInsights({
          ...insights,
          settings: updated,
        });
      } else {
        const data = await res.json();
        setError(data.message || "Error al actualizar configuración.");
      }
    } catch {
      setError("Error al conectar con el servidor.");
    } finally {
      setUpdatingSettings(null);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <p className="text-center text-ink-soft">Cargando...</p>
        </Card>
      </div>
    );
  }

  if (page === "lock") {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <p className="text-center text-ink-soft mb-4">
            Necesitas iniciar sesión para acceder a esta área.
          </p>
          <div className="flex gap-2 justify-center">
            <Button href="/login" variant="secondary">
              Entrar
            </Button>
            <Button href="/registro" variant="secondary">
              Registrarse
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (page === "set-safe-word") {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSetSafeWord();
          }}
          className="w-full max-w-md mx-auto"
        >
          <Card>
            <h1 className="font-display text-2xl font-bold mb-4">Establecer palabra segura</h1>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-card border border-peach bg-surface text-ink text-sm"
              >
                {error}
              </div>
            )}

            <p className="text-ink-soft mb-4 text-sm">
              Esta palabra te permitirá acceder al área de padres desde cualquier dispositivo.
            </p>

            <div className="mb-4">
              <label htmlFor="safeWord" className="block font-display font-semibold mb-2">
                Palabra segura
              </label>
              <input
                id="safeWord"
                type="password"
                required
                minLength={4}
                value={safeWord}
                onChange={(e) => setSafeWord(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                disabled={working}
                className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="safeWordConfirm" className="block font-display font-semibold mb-2">
                Confirmar palabra segura
              </label>
              <input
                id="safeWordConfirm"
                type="password"
                required
                minLength={4}
                value={safeWordConfirm}
                onChange={(e) => setSafeWordConfirm(e.target.value)}
                placeholder="Repite la palabra segura"
                disabled={working}
                className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
              />
            </div>

            <Button type="submit" disabled={working} className="w-full">
              {working ? "Guardando..." : "Establecer palabra segura"}
            </Button>
          </Card>
        </form>
      </div>
    );
  }

  if (page === "unlock") {
    return (
      <div className="flex flex-col items-center justify-center p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleUnlock();
          }}
          className="w-full max-w-md mx-auto"
        >
          <Card>
            <h1 className="font-display text-2xl font-bold mb-4">Desbloquear área de padres</h1>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-card border border-peach bg-surface text-ink text-sm"
              >
                {error}
              </div>
            )}

            <p className="text-ink-soft mb-4 text-sm">
              Ingresa tu palabra segura para acceder al área de padres.
            </p>

            <div className="mb-6">
              <label htmlFor="unlockWord" className="block font-display font-semibold mb-2">
                Palabra segura
              </label>
              <input
                id="unlockWord"
                type="password"
                required
                value={unlockWord}
                onChange={(e) => setUnlockWord(e.target.value)}
                placeholder="Tu palabra segura"
                disabled={working}
                className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
              />
            </div>

            <Button type="submit" disabled={working} className="w-full">
              {working ? "Desbloqueando..." : "Desbloquear"}
            </Button>
          </Card>
        </form>
      </div>
    );
  }

  if (page === "dashboard" && insights) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="font-display text-2xl font-bold mb-6">Área de padres</h1>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-card border border-peach bg-surface text-ink text-sm"
          >
            {error}
          </div>
        )}

        <Card className="mb-6">
          <h2 className="font-display text-lg font-bold mb-4">Configuración</h2>

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={insights.settings.allowImages}
                onChange={() => handleSettingsChange("allowImages")}
                disabled={updatingSettings !== null}
                className="w-5 h-5 rounded border border-line"
              />
              <span className="font-display font-semibold">Permitir imágenes</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={insights.settings.allowVoice}
                onChange={() => handleSettingsChange("allowVoice")}
                disabled={updatingSettings !== null}
                className="w-5 h-5 rounded border border-line"
              />
              <span className="font-display font-semibold">Permitir voz</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={insights.settings.allowText}
                onChange={() => handleSettingsChange("allowText")}
                disabled={updatingSettings !== null}
                className="w-5 h-5 rounded border border-line"
              />
              <span className="font-display font-semibold">Permitir texto</span>
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-bold mb-4">Progreso por asignatura</h2>

          {insights.subjects.length === 0 ? (
            <p className="text-center text-ink-soft">Todavía no hay actividad que mostrar.</p>
          ) : (
            <div className="space-y-4">
              {insights.subjects.map((subject) => (
                <div
                  key={subject.subject}
                  className="p-3 rounded-card border border-line bg-sky-50"
                >
                  <h3 className="font-display font-semibold mb-2">
                    {SUBJECT_NAMES[subject.subject] || subject.subject}
                  </h3>
                  <div className="text-sm text-ink-soft space-y-1">
                    <p>{subject.sessionCount} sesiones</p>
                    <p>{subject.messageCount} mensajes</p>
                    {subject.answerRequests > 0 && (
                      <p className="text-peach-dark">
                        Pidió la respuesta directa {subject.answerRequests} veces — puede ser
                        buen momento para repasar juntos.
                      </p>
                    )}
                    {subject.lastActivity && (
                      <p>
                        Última actividad:{" "}
                        {new Date(subject.lastActivity).toLocaleDateString("es-ES")}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return null;
}
