import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;

/** Normaliza antes de derivar: la palabra segura es memorable, no debe ser sensible a mayúsculas o espacios. */
function normalize(word: string): string {
  return word.trim().toLowerCase();
}

/** Deriva un hash salteado (scrypt) de la palabra segura. Nunca se guarda en texto plano. */
export async function hashSafeWord(word: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(normalize(word), salt, KEY_LENGTH);
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

/** Compara en tiempo constante; false también si el hash guardado tiene un formato inesperado. */
export async function verifySafeWord(word: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex] = storedHash.split(":");
  if (!saltHex || !keyHex) return false;
  let salt: Buffer;
  let storedKey: Buffer;
  try {
    salt = Buffer.from(saltHex, "hex");
    storedKey = Buffer.from(keyHex, "hex");
  } catch {
    return false;
  }
  if (storedKey.length !== KEY_LENGTH) return false;
  const derived = await scrypt(normalize(word), salt, KEY_LENGTH);
  return timingSafeEqual(derived, storedKey);
}
