"use client";

import { useState, useRef } from "react";
import { cn } from "@/components/ui/cn";
import type { UseSpeechInputResult } from "./useSpeechInput";

interface VoiceButtonProps {
  speechInput: UseSpeechInputResult;
  streaming: boolean;
  disabled?: boolean;
}

function MicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2c-1.104 0-2 .896-2 2v8c0 1.104.896 2 2 2s2-.896 2-2V4c0-1.104-.896-2-2-2z" />
      <path d="M7 12a5 5 0 0 0 10 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function VoiceButton({ speechInput, streaming, disabled }: VoiceButtonProps) {
  const [showHint, setShowHint] = useState(false);
  const [enableHoldMode, setEnableHoldMode] = useState(true);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isListening = speechInput.status === "listening";
  const isTranscribing = speechInput.status === "transcribing";

  const handleMouseEnter = () => {
    if (!disabled) {
      hintTimeoutRef.current = setTimeout(() => {
        setShowHint(true);
      }, 500);
    }
  };

  const handleMouseLeave = () => {
    if (hintTimeoutRef.current) clearTimeout(hintTimeoutRef.current);
    setShowHint(false);
  };

  const handleMouseDown = () => {
    if (enableHoldMode) {
      speechInput.start();
    }
  };

  const handleMouseUp = () => {
    if (enableHoldMode) {
      speechInput.stop();
    }
  };

  const handleTouchStart = () => {
    if (enableHoldMode) {
      speechInput.start();
    }
  };

  const handleTouchEnd = () => {
    if (enableHoldMode) {
      speechInput.stop();
    }
  };

  return (
    <div className="relative">
      {/* Hovering hint UI */}
      {showHint && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 pointer-events-none">
          <div className="bg-ink text-on-ink px-3 py-2 rounded-card text-sm font-medium whitespace-nowrap shadow-lift">
            <div className="flex items-center gap-2">
              <span>Hold to record</span>
              <button
                type="button"
                onClick={() => setEnableHoldMode(!enableHoldMode)}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 transition-colors",
                  enableHoldMode ? "border-accent bg-accent" : "border-ink-soft bg-surface"
                )}
                aria-label={enableHoldMode ? "Disable hold to record" : "Enable hold to record"}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
                    enableHoldMode ? "translate-x-5" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
        </div>
      )}

      {/* Mic Button */}
      <button
        ref={buttonRef}
        type="button"
        disabled={streaming || disabled}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseEnter={handleMouseEnter}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        aria-label="Grabar voz (mantén presionado)"
        className={cn(
          "grid size-11 shrink-0 place-items-center rounded-full text-on-primary shadow-lift transition-[background-color,translate] duration-150 ease-out hover:-translate-y-px motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          isListening || isTranscribing ? "bg-peach hover:bg-peach-deep" : "bg-surface-2 hover:bg-surface-3 text-ink",
          "disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <MicIcon />
      </button>

      {/* Transcribing indicator */}
      {isTranscribing && (
        <div className="absolute inset-0 rounded-full border-2 border-peach animate-pulse" aria-hidden="true" />
      )}
    </div>
  );
}
