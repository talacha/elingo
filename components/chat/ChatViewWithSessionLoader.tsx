"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionDetailResponse } from "@/lib/contracts/sessions";
import { ChatView } from "./ChatView";
import { Button } from "@/components/ui/Button";

interface ChatViewWithSessionLoaderProps {
  sessionId: string;
}

export function ChatViewWithSessionLoader({ sessionId }: ChatViewWithSessionLoaderProps) {
  const [session, setSession] = useState<SessionDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSession = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/sessions/${sessionId}`, { credentials: "include" });

        if (response.status === 404) {
          setError("Conversación no encontrada");
          return;
        }

        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const data: SessionDetailResponse = await response.json();
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar la conversación");
        console.error("Failed to load session:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSession();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center">
        <p className="text-ink-soft">Cargando conversación…</p>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4">
        <div className="text-center">
          <h1 className="m-0 mb-2 text-2xl font-bold text-ink">Conversación no encontrada</h1>
          <p className="m-0 text-ink-soft mb-4">
            {error || "No pudimos encontrar esta conversación."}
          </p>
          <Link href="/chat">
            <Button variant="primary">Volver al chat</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <ChatView initialSession={session} />;
}
