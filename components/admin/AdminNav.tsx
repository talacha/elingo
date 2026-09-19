"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cn } from "@/components/ui/cn";

/** Las tres secciones de /admin, cada una en su propia ruta. */
export const ADMIN_SECTIONS = [
  { segment: "users", href: "/admin/users", label: "Usuarios" },
  { segment: "config", href: "/admin/config", label: "Configuración" },
  { segment: "features", href: "/admin/features", label: "Funciones" },
] as const;

export function AdminNav() {
  const active = useSelectedLayoutSegment();
  return (
    <nav aria-label="Secciones de administración" className="flex flex-wrap gap-2">
      {ADMIN_SECTIONS.map((section) => {
        const current = active === section.segment;
        return (
          <Link
            key={section.segment}
            href={section.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full px-4 py-2 font-display font-semibold transition-colors motion-reduce:transition-none",
              current
                ? "bg-primary text-on-primary shadow-lift"
                : "border-2 border-line bg-surface text-ink hover:border-sky",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
