import type { Subject } from "@/lib/contracts/chat";

/** Nombre de cada asignatura tal y como lo ve la alumna. */
export const SUBJECT_LABELS: Record<Subject, string> = {
  mates: "Matemáticas",
  lengua: "Lengua",
  ciencias: "Ciencias",
};

/**
 * Texto del bloque de sistema opcional con la asignatura deducida del mensaje. Va como bloque
 * separado, después del bloque cacheado con el prompt literal, para no invalidar su prefijo ni tocar
 * el prompt (north_star.md manda sobre él). La asignatura ya no la elige la alumna: se infiere.
 */
export function subjectHint(subject: Subject | undefined): string | undefined {
  return subject ? `La pregunta de la alumna parece ser de la asignatura: ${SUBJECT_LABELS[subject]}.` : undefined;
}

/**
 * Señales de cada asignatura, sobre el texto sin tildes y en minúsculas. Cada patrón cuenta como una
 * señal por asignatura (aunque aparezca varias veces); la asignatura con más señales gana.
 */
const SIGNALS: Record<Subject, readonly RegExp[]> = {
  mates: [
    // Operaciones escritas: 3/4 + 1/2, 5 x 6, 12 : 4, 2^3…
    /\d+(?:[.,]\d+)?\s*(?:[+×÷*^=]|x|\/|:|-)\s*\d+/,
    /\b(?:suma|sumar|sumas|resta|restar|multiplic\w*|divis\w*|dividir)\b/,
    /\b(?:fraccion\w*|decimal\w*|porcentaje\w*|denominador|numerador|mcm|mcd|promedio)\b/,
    /\b(?:ecuacion\w*|incognita\w*|algebra|expresion algebraica|despej\w*)\b/,
    /\b(?:geometri\w*|area|perimetro|volumen|angulo\w*|triangulo\w*|cuadrado\w*|rectangulo\w*|circulo\w*|circunferencia)\b/,
    /\b(?:numero\w*|raiz cuadrada|potencia\w*|exponente\w*|mates|matematica\w*|calcul\w*|problema de)\b/,
    /\b(?:grafic[ao]\w*|coordenada\w*|proporcion\w*|razon\w*|regla de tres)\b/,
  ],
  lengua: [
    /\b(?:ortografi\w*|acento\w*|tilde\w*|silaba\w*|agud[ao]s?|llan[ao]s?|esdrujul\w*)\b/,
    /\b(?:verbo\w*|sustantivo\w*|adjetivo\w*|adverbio\w*|pronombre\w*|conjug\w*|tiempo verbal)\b/,
    /\b(?:oracion\w*|parrafo\w*|sujeto|predicado|gramatica\w*|sintaxis)\b/,
    /\b(?:redact\w*|redaccion|resumen|resumir|comprension lectora|ensayo)\b/,
    /\b(?:sinonimo\w*|antonimo\w*|palabra\w*|letra\w*|mayuscula\w*|puntuacion|coma\w*)\b/,
    /\b(?:lectura|leer|poema\w*|cuento\w*|narrativ\w*|rima\w*|metafora\w*|personaje\w*|autor)\b/,
  ],
  ciencias: [
    /\b(?:planta\w*|animal\w*|especie\w*|ecosistema\w*|cadenas? alimentari\w*|hongo\w*|bacteria\w*)\b/,
    /\b(?:agua|evapor\w*|transpir\w*|condens\w*|precipitacion|ciclo del agua|clima|temperatura)\b/,
    /\b(?:celula\w*|fotosintesis|respiracion|digestion|cuerpo humano|huesos?|musculo\w*|corazon|pulmon\w*)\b/,
    /\b(?:energia|materia|atomo\w*|molecula\w*|fuerza\w*|gravedad|electricidad|magnet\w*|luz|sonido)\b/,
    /\b(?:planeta\w*|sistema solar|universo|luna|sol|estrella\w*|volcan\w*|roca\w*|mineral\w*|terremoto\w*)\b/,
    /\b(?:reciclaje|contaminacion|experimento\w*|hipotesis|ciencias|biologia|fisica|quimica)\b/,
  ],
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Asignatura más probable de un texto suelto, o `null` si no hay señal clara (empate o ninguna). */
export function inferSubjectFromText(text: string): Subject | null {
  const normalized = normalize(text);
  let best: Subject | null = null;
  let bestScore = 0;
  let tied = false;
  for (const subject of Object.keys(SIGNALS) as Subject[]) {
    const score = SIGNALS[subject].filter((pattern) => pattern.test(normalized)).length;
    if (score > bestScore) {
      best = subject;
      bestScore = score;
      tied = false;
    } else if (score > 0 && score === bestScore) {
      tied = true;
    }
  }
  return tied ? null : best;
}

/**
 * Asignatura de la conversación, deducida de lo que escribe la alumna: la del último mensaje suyo con
 * señal clara. Así una continuación sin pistas («no lo entiendo») conserva el tema anterior y un
 * cambio de tema lo actualiza. `null` si ninguno de sus mensajes la deja clara.
 */
export function inferSubject(messages: readonly { role: string; content: string }[]): Subject | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const subject = inferSubjectFromText(message.content);
    if (subject) return subject;
  }
  return null;
}
