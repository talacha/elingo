"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabaseAvailable = useMemo(() => createSupabaseClient() !== null, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const supabase = createSupabaseClient();
    if (!supabase) {
      setError("La autenticación no está disponible en este momento.");
      return;
    }

    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes("Invalid login credentials")) {
          setError("Correo o contraseña incorrectos.");
        } else if (signInError.message.includes("Email not confirmed")) {
          setError("Por favor, confirma tu correo electrónico.");
        } else {
          setError("Error al iniciar sesión. Intenta de nuevo.");
        }
        return;
      }

      router.push("/chat");
    } catch {
      setError("Error inesperado. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (!supabaseAvailable) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <p className="text-center text-ink-soft">
          La autenticación no está disponible todavía.
        </p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto">
      <Card>
        <h1 className="font-display text-2xl font-bold mb-4">Entrar</h1>

        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-card border border-peach bg-surface text-ink text-sm"
          >
            {error}
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="email" className="block font-display font-semibold mb-2">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="madre@ejemplo.com"
            disabled={loading}
            className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="password" className="block font-display font-semibold mb-2">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Tu contraseña"
            disabled={loading}
            className="w-full px-4 py-2 rounded-card border border-line bg-surface text-ink placeholder-ink-soft focus:outline-none focus:ring-2 focus:ring-sun disabled:opacity-50"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="w-full mb-3"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        <p className="text-center text-ink-soft text-sm">
          ¿No tienes cuenta?{" "}
          <a href="/registro" className="font-semibold text-sun hover:text-sun-deep">
            Regístrate
          </a>
        </p>
      </Card>
    </form>
  );
}
