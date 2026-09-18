import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ELI — Tutor Nexo",
  description:
    "Tu mentor de estudio para 6º de primaria: te guía paso a paso sin darte la respuesta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
