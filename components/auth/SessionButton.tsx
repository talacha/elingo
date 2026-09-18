"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createSupabaseClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export function SessionButton() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseAvailable, setSupabaseAvailable] = useState(false);

  useEffect(() => {
    async function checkSession() {
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
        setUser(user);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    checkSession();
  }, []);

  async function handleLogout() {
    const supabase = createSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
      setUser(null);
    }
  }

  if (loading || !supabaseAvailable) {
    return null; // Don't show anything if Supabase is not configured or still loading
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/perfil" className="text-ink hover:text-ink-soft underline">
          {user.email || "Perfil"}
        </Link>
        <button
          onClick={handleLogout}
          className="text-ink-soft hover:text-ink underline"
        >
          Salir
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <Button variant="ghost" href="/login" size="md">
        Entrar
      </Button>
      <Button variant="secondary" href="/registro" size="md">
        Registrarse
      </Button>
    </div>
  );
}
