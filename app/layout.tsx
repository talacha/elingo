import type { Metadata, Viewport } from "next";
import { Andika, Fredoka } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

// Tipografías de la landing original: Fredoka para títulos y Andika para el texto
// (diseñada para lectores jóvenes). Se exponen como variables CSS que consume globals.css.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-fredoka",
  display: "swap",
});

const andika = Andika({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-andika",
  display: "swap",
});

const description =
  "Tu mentor de estudio para 6º de primaria: te guía paso a paso sin darte nunca la respuesta.";

export const metadata: Metadata = {
  title: { default: "ELI — Tutor Nexo", template: "%s · ELI" },
  description,
  applicationName: "ELI",
  openGraph: {
    title: "ELI — Tutor Nexo",
    description,
    siteName: "ELI",
    locale: "es_ES",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffcf5" },
    { media: "(prefers-color-scheme: dark)", color: "#1f3028" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={`${fredoka.variable} ${andika.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-body text-ink">{children}</body>
    </html>
  );
}
