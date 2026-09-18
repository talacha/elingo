"use client";

import Link from "next/link";
import { EliMark } from "@/components/landing/EliMark";
import { Button } from "@/components/ui/Button";
import { ChatInput } from "./ChatInput";
import { MessageList } from "./MessageList";
import { SubjectChips } from "./SubjectChips";
import { EmptyState } from "./EmptyState";
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

export function ChatView() {
  const chat = useTutorChat();
  const streaming = chat.status === "streaming";
  const retry = () => void chat.retry();

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line bg-canvas px-gutter py-3">
        <Link
          href="/"
          aria-label="ELI, volver al inicio"
          className="inline-flex items-center gap-2.5 font-display text-2xl font-bold tracking-wider text-ink"
        >
          <EliMark className="size-[30px]" />
          ELI
        </Link>
        <h1 className="m-0 flex items-center gap-2 font-display text-[0.95rem] font-semibold text-ink-soft">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-leaf" />
          Plática con ELI
        </h1>
      </header>

      <MessageList
        className="min-h-0 flex-1"
        messages={chat.messages}
        streaming={streaming}
        thinking={chat.isThinking}
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
            onSend={(text) => void chat.send(text)}
            onStop={chat.stop}
            subject={chat.subject}
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
