import { getRepo } from "@/lib/db";
import { CONFIG_CACHE_PREFIX, invalidate, readThrough } from "./cache";
import { FLAGS, FLAG_KEYS, globalFlagRowKey, type FlagKey } from "./registry";
import { deleteConfigRow, getConfigRows, setConfigRow } from "./store";

export type FlagValues = Record<FlagKey, boolean>;

const accountKey = (userId: string) => `${CONFIG_CACHE_PREFIX}:flags:${userId}`;

function allDefaults(): FlagValues {
  return Object.fromEntries(FLAGS.map((f) => [f.key, f.defaultEnabled])) as FlagValues;
}

function parseBool(raw: string | undefined): boolean | undefined {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return undefined;
}

/** Valor global de cada flag (fila `flag.<nombre>` de `app_config`; sin fila, el valor por defecto). */
export async function getGlobalFlags(): Promise<FlagValues> {
  const rows = await getConfigRows();
  const values = allDefaults();
  for (const flag of FLAG_KEYS) values[flag] = parseBool(rows[globalFlagRowKey(flag)]) ?? values[flag];
  return values;
}

/** Flags que la cuenta ha apartado del global (solo las filas de `account_flags`). */
export async function getAccountFlagOverrides(userId: string): Promise<Partial<FlagValues>> {
  try {
    const rows = await readThrough(accountKey(userId), () => getRepo().getAccountFlags(userId));
    const overrides: Partial<FlagValues> = {};
    for (const flag of FLAG_KEYS) if (typeof rows[flag] === "boolean") overrides[flag] = rows[flag];
    return overrides;
  } catch (error) {
    console.error("[config] no se pudieron leer los flags de la cuenta", error);
    return {};
  }
}

/**
 * Flags efectivos: activo si lo está el global **y** la cuenta no lo ha apagado. Sin `userId`
 * (alumna anónima) solo cuenta el global. Nunca lanza: ante un fallo, el valor por defecto.
 */
export async function getEffectiveFlags(userId?: string): Promise<FlagValues> {
  const global = await getGlobalFlags().catch(() => allDefaults());
  if (!userId) return global;
  const account = await getAccountFlagOverrides(userId);
  return Object.fromEntries(FLAG_KEYS.map((flag) => [flag, global[flag] && (account[flag] ?? true)])) as FlagValues;
}

/** Valor de la cuenta tal como lo ve /parents: su propio interruptor, sin mezclar el global. */
export async function getAccountFlagValues(userId: string): Promise<FlagValues> {
  const account = await getAccountFlagOverrides(userId);
  return Object.fromEntries(FLAG_KEYS.map((flag) => [flag, account[flag] ?? true])) as FlagValues;
}

export async function setGlobalFlag(flag: FlagKey, enabled: boolean, updatedBy: string): Promise<void> {
  await setConfigRow(globalFlagRowKey(flag), String(enabled), updatedBy);
}

/** `null` quita el override de la cuenta (vuelve a seguir al global). */
export async function setAccountFlag(
  userId: string,
  flag: FlagKey,
  enabled: boolean | null,
  updatedBy: string,
): Promise<void> {
  await getRepo().setAccountFlag(userId, flag, enabled, updatedBy);
  await invalidate(accountKey(userId));
}

/** Quita el valor global guardado de un flag (vuelve al valor por defecto). */
export async function clearGlobalFlag(flag: FlagKey): Promise<void> {
  await deleteConfigRow(globalFlagRowKey(flag));
}
