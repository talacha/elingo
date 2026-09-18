"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SessionSummary } from "@/lib/contracts/sessions";
import type { SessionsListResponse } from "@/lib/contracts/sessions";
import { Card } from "@/components/ui/Card";

function formatRelativeDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Hace un momento";
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    // Fallback a formato corto
    return date.toLocaleDateString("es-ES", { month: "short", day: "numeric" });
  } catch {
    return "Hace poco";
  }
}

function getSubjectLabel(subject: string | null): string {
  switch (subject) {
    case "mates":
      return "Mates";
    case "lengua":
      return "Lengua";
    case "ciencias":
      return "Ciencias";
    default:
      return "Tema";
  }
}

interface SessionListProps {
  onSessionClick?: () => void;
}

export function SessionList({ onSessionClick }: SessionListProps) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/sessions", { credentials: "include" });
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }
        const data: SessionsListResponse = await response.json();
        setSessions(data.sessions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cargar el historial");
        console.error("Failed to fetch sessions:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">Cargando historial…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink-soft">Todavía no tienes conversaciones guardadas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <Link
          key={session.id}
          href={`/chat/${session.id}`}
          onClick={onSessionClick}
          className="block no-underline"
        >
          <Card className="cursor-pointer transition-colors hover:bg-surface-hover p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="m-0 font-semibold text-ink truncate">
                  {session.title || "Conversación sin título"}
                </p>
                <p className="m-0 text-sm text-ink-soft">{getSubjectLabel(session.subject)}</p>
              </div>
              <p className="m-0 text-xs text-ink-soft whitespace-nowrap">
                {formatRelativeDate(session.updatedAt)}
              </p>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
