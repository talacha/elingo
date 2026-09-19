import type { Metadata, Viewport } from "next";
import { Andika, Fredoka } from "next/font/google";
import type { ReactNode } from "react";
import { getEnv } from "@/lib/env";
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
const env = getEnv();

const title = "ELI — hagamos la tarea juntos";

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title: { default: title, template: "%s · ELI" },
  description,
  applicationName: "ELI",
  keywords: [
    "tutor IA",
    "deberes",
    "primaria",
    "K-12",
    "tareas en español y en inglés",
    "estudio",
    "tareas",
    "ayuda escolar",
  ],
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  openGraph: {
    title,
    description,
    siteName: "ELI",
    locale: "es_ES",
    type: "website",
    url: "/",
    // Sin `images`: app/opengraph-image.tsx (convención de archivo de Next.js) ya
    // genera y enlaza la imagen automáticamente, con su propio ancho/alto/alt.
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    // Igual que arriba: app/twitter-image.tsx la resuelve sola.
  },
  alternates: {
    canonical: "/",
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "ELI",
    alternateName: title,
    description: description,
    url: env.NEXT_PUBLIC_APP_URL,
    applicationCategory: "EducationalApplication",
    inLanguage: "es",
    audience: {
      "@type": "EducationalAudience",
      educationalRole: "student",
      ageRange: "11-12",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  return (
    <html lang="es" className={`${fredoka.variable} ${andika.variable} h-full antialiased`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="flex min-h-full flex-col font-body text-ink">{children}</body>
    </html>
  );
}
