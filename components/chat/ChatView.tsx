"use client";

import { useEffect, useState, useRef } from "react";
import type { SessionDetailResponse } from "@/lib/contracts/sessions";
import type { ChatCapabilities } from "@/app/api/chat/capabilities/route";
import { Button } from "@/components/ui/Button";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { SubjectChips } from "./SubjectChips";
import { EmptyState } from "./EmptyState";
import { SessionList } from "./SessionList";
import { useTutorChat, type TutorChatError } from "./useTutorChat";

function ErrorNotice({
  error,
  canRetry,
  onRetry,
}: {
  error: TutorChatError;
  canRetry: boolean;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-card border-2 border-peach bg-surface px-4 py-3 text-ink shadow-lift"
    >
      <p className="m-0">{error.message}</p>
      {canRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

interface ChatViewProps {
  initialSession?: SessionDetailResponse;
}

export function ChatView({ initialSession }: ChatViewProps = {}) {
  const chat = useTutorChat();
  const streaming = chat.status === "streaming";
  const retry = () => void chat.retry();
  const [showSessions, setShowSessions] = useState(false);
  const [capabilities, setCapabilities] = useState<ChatCapabilities>({
    allowImages: true,
    allowVoice: true,
    allowText: true,
  });
  const loadedSessionIdRef = useRef<string | null>(null);

  // Load initial session messages if provided
  useEffect(() => {
    if (initialSession && loadedSessionIdRef.current !== initialSession.session.id) {
      chat.loadMessages(initialSession.messages, initialSession.session.subject ?? undefined);
      loadedSessionIdRef.current = initialSession.session.id;
    }
  }, [initialSession, chat]);

  // Fetch user capabilities on mount
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/chat/capabilities");
        if (response.ok) {
          const data = await response.json();
          setCapabilities(data);
        }
      } catch (error) {
        console.error("Failed to fetch chat capabilities:", error);
        // Keep default (all-true) on error
      }
    })();
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-canvas px-gutter py-3">
        <div className="flex flex-col gap-1">
          <h1 className="m-0 flex items-center gap-2 font-display text-[0.95rem] font-semibold text-ink-soft">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-leaf" />
            Plática con ELI
          </h1>
          {chat.meta?.model && (
            <p className="m-0 text-[0.75rem] text-ink-soft/60">
              Modelo: {chat.meta.model}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setShowSessions(!showSessions)}>
            Mis conversaciones
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              chat.newSession();
              setShowSessions(false);
            }}
          >
            Nueva conversación
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <MessageList
          className="min-h-0 flex-1"
          messages={chat.messages}
          streaming={streaming}
          thinking={chat.isThinking}
          model={chat.meta?.model}
          autoSpeakId={capabilities.allowVoice ? chat.speakReplyId : null}
          intro={
            chat.messages.length === 0 ? (
              <EmptyState
                onSelectPrompt={(prompt, subject) => {
                  chat.setSubject(subject);
                  void chat.send(prompt);
                }}
                disabled={streaming}
              />
            ) : null
          }
        />

        {/* Sesiones drawer: panel lateral en escritorio, superpuesta a toda pantalla en móvil
            (un aside de ancho fijo, en lugar de superponerse, dejaría la conversación en una
            franja de ~35px, verificado en un viewport de 375px). */}
        {showSessions && (
          <>
            <div
              className="fixed inset-0 z-10 bg-ink/30 sm:hidden"
              aria-hidden="true"
              onClick={() => setShowSessions(false)}
            />
            <aside className="fixed inset-y-0 right-0 z-20 w-full max-w-sm overflow-y-auto border-l border-line bg-canvas sm:static sm:z-auto sm:w-80 sm:max-w-none">
              <div className="p-4">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <h2 className="m-0 font-semibold text-ink">Mis conversaciones</h2>
                  <button
                    type="button"
                    onClick={() => setShowSessions(false)}
                    aria-label="Cerrar"
                    className="grid size-9 shrink-0 place-items-center rounded-full text-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink sm:hidden"
                  >
                    ×
                  </button>
                </div>
                <SessionList onSessionClick={() => setShowSessions(false)} />
              </div>
            </aside>
          </>
        )}
      </div>

      <div className="border-t border-line bg-canvas px-gutter pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        <div className="mx-auto w-full max-w-3xl space-y-3">
          {chat.error ? (
            <ErrorNotice error={chat.error} canRetry={chat.canRetry} onRetry={retry} />
          ) : (
            chat.canRetry && (
              <p className="m-0 flex flex-wrap items-center justify-between gap-2 px-1 text-ink-soft">
                <span>Has parado a ELI antes de que contestara.</span>
                <Button variant="ghost" onClick={retry}>
                  Reintentar
                </Button>
              </p>
            )
          )}

          {/* Selector de asignatura */}
          {chat.messages.length > 0 && (
            <div className="px-1">
              <p className="m-0 mb-2 text-sm font-semibold text-ink-soft">Asignatura:</p>
              <SubjectChips
                active={chat.subject}
                onChange={chat.setSubject}
                disabled={streaming}
              />
            </div>
          )}

          <ChatInput
            streaming={streaming}
            onSend={(text, image, options) => void chat.send(text, image, options)}
            onStop={chat.stop}
            subject={chat.subject}
            capabilities={capabilities}
          />
          {chat.meta?.provider === "mock" && (
            <p className="m-0 text-center text-[0.8rem] text-ink-soft">
              ELI está en modo de prueba: sus respuestas son de ejemplo.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
