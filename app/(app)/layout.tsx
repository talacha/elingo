import type { ReactNode } from "react";
import Link from "next/link";
import { EliMark } from "@/components/landing/EliMark";
import { SessionButton } from "@/components/auth/SessionButton";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-line bg-surface">
        <Link href="/chat" className="flex items-center gap-2 hover:opacity-80">
          <div className="w-8 h-8 flex-shrink-0">
            <EliMark />
          </div>
          <span className="font-display font-semibold text-lg text-ink hidden sm:inline">
            ELI
          </span>
        </Link>

        <div className="flex-1" />

        <SessionButton />
      </header>

      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
