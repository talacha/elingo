import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const KEY_LENGTH = 64;

/** Insensible a mayúsculas y espacios: se teclea rápido en un móvil para entrar en /parents. */
function normalize(word: string): string {
  return word.trim().toLowerCase();
}

/** Hash de la palabra segura (scrypt + sal aleatoria). Formato de salida: "saltHex:hashHex". */
export async function hashSafeWord(word: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(normalize(word), salt, KEY_LENGTH)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Compara en tiempo constante; false ante cualquier formato inesperado en `stored` (nunca lanza). */
export async function verifySafeWord(word: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const derived = (await scrypt(normalize(word), salt, KEY_LENGTH)) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}
