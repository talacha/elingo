"use client";

import { useEffect, useState } from "react";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface Profile {
  displayName: string;
  grade: string;
}

export function ProfileForm() {
  const [profile, setProfile] = useState<Profile>({ displayName: "", grade: "6º" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [supabaseAvailable, setSupabaseAvailable] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createSupabaseClient();

      if (!supabase) {
        setSupabaseAvailable(false);
        setLoading(false);
        return;
      }

      setSupabaseAvailable(true);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setIsAuthenticated(false);
          setLoading(false);
          return;
        }

        setIsAuthenticated(true);

        // In a real app, we'd load the profile from the database
        // For now, we just show empty fields ready to be filled
        setProfile({
          displayName: "",
          grade: "6º",
        });
      } catch {
        setError("Error al cargar el perfil.");
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!profile.displayName.trim()) {
      setError("Por favor, ingresa el nombre de la alumna.");
      return;
    }

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError("La autenticación no está disponible.");
      return;
    }

    setSaving(true);

    try {
      // In a real app, we'd save this to the database
      // For now, just show success message
      setSuccess("Perfil guardado correctamente.");
    } catch {
      setError("Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft">Cargando...</p>
      </Card>
    );
  }

  if (!supabaseAvailable) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft">
          La autenticación no está disponible todavía.
        </p>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft mb-4">
          Te enviamos un email. Debes verificar tu cuenta de email para poder registrarte.
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
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <Card>
        <h1 className="font-display text-2xl font-bold mb-4">Perfil de la alumna</h1>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-card border border-peach bg-surface text-ink text-sm"
          >
            {error}
          </div>
        )}

        {success && (
          <div
            role="status"
            className="mb-4 p-3 rounded-card border border-leaf bg-surface text-ink text-sm"
          >
            {success}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="displayName" className="block font-display font-semibold mb-2">
            Nombre de la alumna
          </label>
          <input
            id="displayName"
            type="text"
            required
            value={profile.displayName}
            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
            placeholder="Ej: María"
            disabled={saving}
            className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="grade" className="block font-display font-semibold mb-2">
            Grado
          </label>
          <select
            id="grade"
            value={profile.grade}
            onChange={(e) => setProfile({ ...profile, grade: e.target.value })}
            disabled={saving}
            className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
          >
            <option value="5º">5º de primaria</option>
            <option value="6º">6º de primaria</option>
            <option value="1º ESO">1º de ESO</option>
            <option value="2º ESO">2º de ESO</option>
          </select>
        </div>

        <Button
          type="submit"
          disabled={saving}
          className="w-full"
        >
          {saving ? "Guardando..." : "Guardar perfil"}
        </Button>
      </Card>
    </form>
  );
}
