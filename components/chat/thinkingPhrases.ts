/**
 * Frases del indicador «ELI está pensando…». Rotan mientras llega la respuesta, como el texto
 * animado de Claude, pero para una niña de primaria: cortas, cálidas, con humor suave y sin
 * nada que asuste o meta prisa. Algunas aluden al método de ELI (guiar con preguntas, no dar el resultado).
 *
 * La primera es siempre la misma: es la que ve la niña si la respuesta llega rápido y la que lee un
 * lector de pantalla.
 */
export interface ThinkingPhrase {
  text: string;
  /** Adorno opcional; va fuera del texto animado para que conserve sus colores. */
  emoji?: string;
}

export const THINKING_PHRASES: readonly ThinkingPhrase[] = [
  { text: "ELI está pensando…" },
  { text: "Buscando una buena pista para ti…", emoji: "🔎" },
  { text: "Pensando una pregunta que te ayude…", emoji: "💭" },
  { text: "Afilando mi lápiz mágico…", emoji: "✏️" },
  { text: "Revisando mi mochila de ideas…", emoji: "🎒" },
  { text: "Conectando mis neuronas…", emoji: "⚡" },
  { text: "Armando un acertijo para ti…", emoji: "🧩" },
  { text: "Hojeando el libro de los misterios…", emoji: "📚" },
  { text: "Contando hasta tres para no equivocarme…", emoji: "🔢" },
  { text: "Encendiendo la bombilla de las ideas…", emoji: "💡" },
  { text: "Preguntándole a mi cerebro de robot…", emoji: "🤖" },
  { text: "Ordenando las piezas del rompecabezas…", emoji: "🧠" },
];

/** Cuánto se queda cada frase en pantalla. */
export const PHRASE_INTERVAL_MS = 2800;

/**
 * Índice de la siguiente frase: al azar, sin repetir la actual y sin volver a la primera (la
 * primera solo se ve al empezar). `random` se inyecta para poder probarlo.
 */
export function nextPhraseIndex(current: number, count: number, random: () => number = Math.random): number {
  const candidates: number[] = [];
  for (let i = 1; i < count; i++) if (i !== current) candidates.push(i);
  if (candidates.length === 0) return 0;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
}
