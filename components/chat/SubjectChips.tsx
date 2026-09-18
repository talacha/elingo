"use client";

import { SUBJECTS, type Subject } from "@/lib/contracts/chat";
import { cn } from "@/components/ui/cn";

interface SubjectChipsProps {
  /** Asignatura seleccionada actualmente. */
  active: Subject | undefined;
  /** Se llama cuando la niña selecciona una asignatura. */
  onChange: (subject: Subject | undefined) => void;
  /** Deshabilitado mientras ELI está respondiendo. */
  disabled?: boolean;
}

const SUBJECT_LABELS: Record<Subject, { label: string; template: string }> = {
  mates: {
    label: "Mates",
    template: "Tengo este problema: … me trabé en …",
  },
  lengua: {
    label: "Lengua",
    template: "Tengo esta duda de ortografía: … no sé bien…",
  },
  ciencias: {
    label: "Ciencias",
    template: "Tengo esta pregunta de ciencias: … no entiendo bien…",
  },
};

export function SubjectChips({ active, onChange, disabled }: SubjectChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUBJECTS.map((subject) => (
        <button
          key={subject}
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange(active === subject ? undefined : subject);
          }}
          title={`${SUBJECT_LABELS[subject].label}: ${SUBJECT_LABELS[subject].template}`}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold leading-tight transition-all duration-150 motion-reduce:transition-none",
            active === subject
              ? "bg-primary text-on-primary shadow-lift"
              : "border border-line bg-surface text-ink hover:bg-surface-2 disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {SUBJECT_LABELS[subject].label}
        </button>
      ))}
    </div>
  );
}
