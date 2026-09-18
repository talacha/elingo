import Link from "next/link";
import type { ReactNode } from "react";
import { ChatPreview } from "@/components/landing/ChatPreview";
import { EliMark } from "@/components/landing/EliMark";
import { EliMascot } from "@/components/landing/EliMascot";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

const steps = [
  {
    title: "Le cuentas a ELI qué no entiendes.",
    text: "Por ejemplo: «Tengo este problema y me trabé aquí».",
  },
  { title: "ELI te hace preguntas chiquitas.", text: "Una por una. Sin prisa y sin regaños." },
  {
    title: "¡Tú encuentras la respuesta!",
    text: "Y la idea se enciende en tu cabeza, como una lucecita.",
  },
];

const traits: Array<{ tone: string; icon: ReactNode; title: string; text: string }> = [
  {
    tone: "bg-sun",
    icon: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
    title: "Nunca dice «No».",
    text: "Si te equivocas, ELI dice: «Buen intento, vamos a revisar el paso anterior».",
  },
  {
    tone: "bg-sky",
    icon: (
      <path d="M5 5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    ),
    title: "Habla fácil.",
    text: "Sin palabras raras. Con frases cortas que sí se entienden.",
  },
  {
    tone: "bg-peach",
    icon: (
      <>
        <rect x="3" y="8" width="18" height="10" rx="5" />
        <path d="M8 11v4M6 13h4" />
        <circle cx="15.5" cy="12" r=".9" />
        <circle cx="17.5" cy="14" r=".9" />
      </>
    ),
    title: "Explica con cosas que conoces.",
    text: "Videojuegos, juegos y cosas de todos los días.",
  },
  {
    tone: "bg-leaf",
    icon: <path d="M13 3 5 14h6l-1 7 8-11h-6z" />,
    title: "Juega contigo.",
    text: "Te hace preguntas rápidas, como en un concurso.",
  },
];

const subjects = [
  {
    band: "bg-sun",
    tilt: "-rotate-[1.5deg]",
    title: "Matemáticas",
    text: "Sumas, restas, fracciones y problemas.",
  },
  {
    band: "bg-peach",
    tilt: "rotate-[1.2deg]",
    title: "Español",
    text: "Leer, escribir y contar historias.",
  },
  {
    band: "bg-sky",
    tilt: "-rotate-[0.8deg]",
    title: "Ciencias",
    text: "Plantas, animales, tu cuerpo y el espacio.",
  },
];

const does = [
  "Guía paso a paso con preguntas, al estilo socrático.",
  "En matemáticas, desglosa el problema y pide identificar los datos primero.",
  "Corrige siempre en positivo: «Buen intento, revisemos el paso anterior».",
  "Explica con analogías de hoy: videojuegos y vida cotidiana.",
];

const doesNot = [
  "No entrega el resultado final.",
  "No redacta textos completos por el alumno.",
  "No usa tecnicismos ni párrafos largos.",
];

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="font-display text-[0.85rem] font-semibold tracking-[0.12em] text-ink-soft uppercase">
      {children}
    </span>
  );
}

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-wrap px-gutter pb-10">
      <a
        href="#inicio"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2 focus:font-display focus:font-semibold focus:text-ink focus:shadow-card"
      >
        Saltar al contenido
      </a>

      <header className="flex flex-wrap items-center justify-between gap-4 pt-5 pb-1.5">
        <Link
          href="/"
          aria-label="ELI, ir al inicio"
          className="inline-flex items-center gap-2.5 font-display text-2xl font-bold tracking-wider text-ink"
        >
          <EliMark className="size-[30px]" />
          ELI
        </Link>
        <Button href="#adultos" variant="secondary">
          Para mamás y papás
        </Button>
      </header>

      <main id="inicio" className="grid gap-section">
        {/* Portada */}
        <section
          aria-labelledby="t-hola"
          className="grid items-center gap-5 pt-4 md:grid-cols-[1.15fr_0.85fr] md:gap-[clamp(24px,4vw,56px)] md:pt-[clamp(16px,4vw,40px)]"
        >
          <div className="grid justify-items-start gap-5">
            <span className="inline-block -rotate-[2.5deg] rounded-full bg-paper px-4 py-[0.45em] font-display text-[0.95rem] font-semibold text-paper-ink shadow-sticker">
              Para 6º de primaria
            </span>
            <h1 id="t-hola" className="text-display font-bold">
              ¡Hola! Soy{" "}
              <span className="underline decoration-sun decoration-wavy decoration-[0.12em] underline-offset-[0.14em] [text-decoration-skip-ink:none]">
                ELI
              </span>
              .
            </h1>
            <p className="max-w-[34ch] text-lead">
              Soy tu amigo para hacer la tarea. Cuando algo de la escuela se pone difícil, yo te
              ayudo a entenderlo. Tú y yo, juntos.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button href="/chat" size="lg">
                Empezar
              </Button>
              <Button href="#como" variant="ghost">
                ¿Cómo funciona?
              </Button>
            </div>
          </div>
          <div className="relative order-first w-[min(70%,240px)] justify-self-center md:order-none md:w-[min(100%,300px)]">
            <span className="absolute -top-3.5 -right-2.5 rotate-[3deg] rounded-bubble bg-paper px-4 py-[0.55em] font-display text-[1.05rem] font-semibold whitespace-nowrap text-paper-ink shadow-card after:absolute after:-bottom-[7px] after:left-[22px] after:size-4 after:rotate-45 after:rounded-[3px] after:bg-paper after:content-['']">
              ¿En qué te trabajaste hoy?
            </span>
            <EliMascot className="block h-auto w-full" />
          </div>
        </section>

        {/* El secreto */}
        <section
          aria-labelledby="t-secreto"
          className="grid items-center gap-7 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:gap-[clamp(28px,5vw,64px)]"
        >
          <div className="grid max-w-[58ch] gap-3.5">
            <Eyebrow>El secreto de ELI</Eyebrow>
            <h2 id="t-secreto" className="text-title font-semibold">
              ELI nunca te dice la respuesta.
            </h2>
            <p>Pero te ayuda a encontrarla tú. Y la próxima vez, ¡ya lo puedes hacer sin ayuda!</p>
            <p>Por eso ELI no hace la tarea por ti. ELI te acompaña mientras tú la haces.</p>
          </div>
          <Card
            as="aside"
            variant="note"
            padded={false}
            className="relative w-full max-w-[340px] rotate-[1deg] justify-self-start px-7 pt-9 pb-6 text-[1.3rem] leading-[1.35] before:absolute before:-top-3.5 before:left-1/2 before:h-7 before:w-[110px] before:-translate-x-1/2 before:-rotate-[3deg] before:rounded-[2px] before:bg-tape before:shadow-[0_1px_2px_rgba(0,0,0,0.08)] before:content-[''] md:rotate-[2deg] md:justify-self-center"
          >
            <p>
              Es como aprender a andar en bici. ELI no pedalea por ti. Te sostiene un poquito, corre
              a tu lado y te dice: <strong>¡tú puedes!</strong>
            </p>
            <span className="mt-3.5 block text-right font-body text-base font-normal text-paper-soft">
              — ELI
            </span>
          </Card>
        </section>

        {/* Así funciona */}
        <section id="como" aria-labelledby="t-como" className="grid scroll-mt-6 gap-3.5">
          <Eyebrow>Así funciona</Eyebrow>
          <h2 id="t-como" className="text-title font-semibold">
            Tres pasos, muy fáciles.
          </h2>
          <div className="mt-4 grid items-center gap-7 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-[clamp(28px,5vw,64px)]">
            <ol className="grid gap-6">
              {steps.map((step, index) => (
                <li key={step.title} className="grid grid-cols-[56px_1fr] items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="grid size-14 place-items-center rounded-full bg-sun font-display text-[1.6rem] font-bold text-paper-ink shadow-lift"
                  >
                    {index + 1}
                  </span>
                  <div className="grid gap-1">
                    <h3 className="text-[1.35rem] font-semibold">{step.title}</h3>
                    <p className="text-ink-soft">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <ChatPreview />
          </div>
        </section>

        {/* Cómo es ELI */}
        <section aria-labelledby="t-como-es" className="grid gap-3.5">
          <Eyebrow>Cómo es ELI</Eyebrow>
          <h2 id="t-como-es" className="text-title font-semibold">
            Paciente, alegre y siempre de tu lado.
          </h2>
          <ul className="mt-4 grid gap-7 md:grid-cols-2 md:gap-x-10">
            {traits.map((trait) => (
              <li key={trait.title} className="grid grid-cols-[52px_1fr] items-start gap-4">
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-[52px] place-items-center rounded-2xl text-face",
                    trait.tone,
                  )}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-[26px]"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {trait.icon}
                  </svg>
                </span>
                <div className="grid gap-1">
                  <h3 className="text-[1.35rem] font-semibold">{trait.title}</h3>
                  <p className="text-ink-soft">{trait.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Materias */}
        <section aria-labelledby="t-materias" className="grid gap-3.5">
          <Eyebrow>Materias</Eyebrow>
          <h2 id="t-materias" className="text-title font-semibold">
            ¿Con qué te ayuda ELI?
          </h2>
          <ul className="mt-4 flex flex-wrap gap-[22px]">
            {subjects.map((subject) => (
              <li key={subject.title} className="max-w-[340px] flex-[1_1_240px]">
                <Card
                  as="article"
                  variant="paper"
                  padded={false}
                  className={cn(
                    "h-full overflow-hidden transition-[rotate,translate] duration-200 hover:-translate-y-1 hover:rotate-0 motion-reduce:transition-none",
                    subject.tilt,
                  )}
                >
                  <div aria-hidden="true" className={cn("h-4", subject.band)} />
                  <div className="grid gap-1.5 px-5 pt-[18px] pb-5">
                    <h3 className="text-2xl font-semibold">{subject.title}</h3>
                    <p className="text-[1.02rem] text-paper-soft">{subject.text}</p>
                    <span
                      aria-hidden="true"
                      className="mt-2.5 flex items-end gap-2 text-[0.82rem] tracking-[0.04em] text-paper-soft after:mb-[0.35em] after:flex-1 after:border-b-[1.5px] after:border-paper-line after:content-['']"
                    >
                      Nombre
                    </span>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* Para las personas grandes */}
        <Card
          as="section"
          id="adultos"
          aria-labelledby="t-adultos"
          className="grid scroll-mt-6 gap-5"
        >
          <Eyebrow>Para mamás, papás y maestros</Eyebrow>
          <h2 id="t-adultos" className="text-title font-semibold">
            Lo que ELI hace y lo que no.
          </h2>
          <p className="max-w-[58ch]">
            ELI (hagamos la tarea juntos) es un tutor de estudio con inteligencia artificial para estudiantes de
            6º de primaria, de 11 a 12 años, que se preparan para la secundaria.
          </p>
          <div className="mt-1 grid gap-6 md:grid-cols-2 md:gap-x-10">
            <div>
              <h3 className="mb-2.5 text-xl font-semibold">Lo que sí hace</h3>
              <ul className="grid gap-2.5">
                {does.map((item) => (
                  <li
                    key={item}
                    className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[1.02rem]"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="mt-1 size-[22px] stroke-leaf"
                      fill="none"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12l4 4 10-10" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2.5 text-xl font-semibold">Lo que no hace</h3>
              <ul className="grid gap-2.5">
                {doesNot.map((item) => (
                  <li
                    key={item}
                    className="grid grid-cols-[24px_1fr] items-start gap-2.5 text-[1.02rem]"
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="mt-1 size-[22px] stroke-ink-soft"
                      fill="none"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <path d="M8 12h8" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-ink-soft">
            Ya disponible en <strong>eli.ngo</strong>.
          </p>
        </Card>
      </main>

      <footer className="mt-section flex flex-wrap justify-between gap-x-6 gap-y-2 border-t border-dashed border-line pt-[26px] pb-2 text-[0.95rem] text-ink-soft">
        <span>
          <strong>ELI</strong> · hagamos la tarea juntos
        </span>
        <Link href="/chat" className="underline decoration-dotted underline-offset-2 hover:text-ink">
          Prueba ELI: https://eli.ngo/chat
        </Link>
      </footer>
    </div>
  );
}
