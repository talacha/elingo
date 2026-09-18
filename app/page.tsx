import Link from "next/link";

// Placeholder de T-001. "/" se reescribe a public/landing.html hasta que T-013
// construya la portada real aquí.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-bold">Hola, soy ELI</h1>
      <p className="max-w-md text-lg">
        Tu mentor de estudio para 6º de primaria. Te guío paso a paso, pero la respuesta la
        encuentras tú.
      </p>
      <Link href="/chat" className="rounded-full bg-orange-500 px-6 py-3 font-semibold text-white">
        Empezar
      </Link>
    </main>
  );
}
