/**
 * Filtro de la respuesta del modelo: la niña solo debe ver el mensaje final, nunca el razonamiento.
 *
 * Algunos modelos (sobre todo los gratuitos «de razonamiento») lo cuelan dentro del propio texto:
 *   1. entre etiquetas `<think>…</think>` (o `<thinking>`), o
 *   2. como un «proceso de pensamiento» en claro al principio («Here's a thinking process: 1. Analyze
 *      User Input…»), tras el cual a veces ni siquiera llega la respuesta.
 *
 * (1) se recorta en streaming. (2) se detecta en el arranque de la respuesta: se retiene un trozo
 * corto antes de emitir nada y, si empieza como razonamiento, se descarta TODO y `leakedThinking`
 * queda en `true`. Quien lo use debe tratar eso como un intento fallido (reintento con el modelo de
 * respaldo), no como una respuesta: no hay forma fiable de separar el borrador de la respuesta final.
 *
 * Sin dependencias ni efectos: solo cadenas.
 */

/** Caracteres que se retienen al principio para decidir si es razonamiento filtrado. */
const HEAD_LENGTH = 60;

const LEAK_PATTERNS: readonly RegExp[] = [
  /^(?:here(?:'|’)?s|here is|this is)\s+(?:a|my|the)\s+(?:thinking|thought|reasoning)\s+process/i,
  /^(?:thinking|thought|reasoning)\s+process\b/i,
  /^[*#\s]*(?:\d+[.)]\s*)?[*\s]*analy[sz]e\s+(?:the\s+)?(?:user|request|input|query|question)/i,
  /^(?:aquí\s+(?:va|tienes|está)|este\s+es)\s+(?:mi|el|un)\s+proceso\s+de\s+(?:pensamiento|razonamiento)/i,
  /^proceso\s+de\s+(?:pensamiento|razonamiento)\b/i,
];

const OPEN_TAG = /<think(?:ing)?>/i;
const CLOSE_TAG = /<\/think(?:ing)?>/i;
const OPEN_TAG_TEXT = "<thinking>";

/** ¿El texto (ya sin espacios iniciales) empieza como un razonamiento en claro? */
export function startsLikeReasoning(text: string): boolean {
  const head = text.trimStart();
  return LEAK_PATTERNS.some((pattern) => pattern.test(head));
}

export class ReplyFilter {
  /** Texto pendiente de procesar por el recorte de etiquetas (puede acabar en una etiqueta a medias). */
  private pending = "";
  private insideThink = false;
  /** Tras quitar un bloque, se descartan los espacios que lo separaban del texto real. */
  private skipSpace = false;
  /** Texto ya sin etiquetas, retenido hasta decidir si arranca como razonamiento. */
  private head = "";
  private decided = false;
  private leaked = false;

  /** `true` si la respuesta arrancó como razonamiento filtrado: se ha descartado entera. */
  get leakedThinking(): boolean {
    return this.leaked;
  }

  /** Recibe un delta del modelo y devuelve lo que ya se puede enseñar a la niña (puede ser ""). */
  push(delta: string): string {
    return this.gate(this.stripTags(delta));
  }

  /** Fin de la respuesta: devuelve lo que quedaba retenido. */
  finish(): string {
    const rest = this.insideThink ? "" : this.pending;
    this.pending = "";
    const tail = this.gate(rest);
    if (this.decided) return tail;
    // Respuesta corta que nunca llegó al tamaño de decisión.
    this.decided = true;
    if (startsLikeReasoning(this.head)) {
      this.leaked = true;
      this.head = "";
      return "";
    }
    const out = this.head;
    this.head = "";
    return out;
  }

  /** Quita los bloques `<think>…</think>` en streaming, reteniendo una etiqueta que aún no ha llegado entera. */
  private stripTags(delta: string): string {
    this.pending += delta;
    let out = "";
    for (;;) {
      if (this.insideThink) {
        const close = CLOSE_TAG.exec(this.pending);
        if (!close) {
          // Dentro del razonamiento no se conserva nada, salvo el final por si trae `</think` a medias.
          this.pending = this.pending.slice(-12);
          return out;
        }
        this.pending = this.pending.slice(close.index + close[0].length);
        this.insideThink = false;
        this.skipSpace = true;
        continue;
      }
      const open = OPEN_TAG.exec(this.pending);
      if (open) {
        out += this.clean(this.pending.slice(0, open.index));
        this.pending = this.pending.slice(open.index + open[0].length);
        this.insideThink = true;
        continue;
      }
      // Sin etiqueta completa: se retiene el final si pudiera ser el comienzo de una.
      const lt = this.pending.lastIndexOf("<");
      if (lt !== -1 && OPEN_TAG_TEXT.startsWith(this.pending.slice(lt).toLowerCase())) {
        out += this.clean(this.pending.slice(0, lt));
        this.pending = this.pending.slice(lt);
      } else {
        out += this.clean(this.pending);
        this.pending = "";
      }
      return out;
    }
  }

  private clean(text: string): string {
    if (!this.skipSpace) return text;
    const trimmed = text.replace(/^\s+/, "");
    if (trimmed.length > 0) this.skipSpace = false;
    return trimmed;
  }

  /** Retiene el arranque hasta poder decidir; después deja pasar todo (o descarta todo si era razonamiento). */
  private gate(text: string): string {
    if (this.leaked) return "";
    if (this.decided) return text;
    this.head += text;
    if (this.head.trimStart().length < HEAD_LENGTH) return "";

    this.decided = true;
    if (startsLikeReasoning(this.head)) {
      this.leaked = true;
      this.head = "";
      return "";
    }
    const out = this.head;
    this.head = "";
    return out;
  }
}
