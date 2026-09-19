import { checkModelCapability } from "./modelCatalog";
import { getParamDef } from "./registry";

export type ValidationResult = { ok: true; value: string } | { ok: false; message: string };

/**
 * Valida el valor que /admin quiere guardar para un parámetro editable. Los modelos se comprueban
 * además contra el catálogo de OpenRouter (existe y acepta la entrada que su función necesita).
 */
export async function validateParamValue(key: string, raw: string): Promise<ValidationResult> {
  const def = getParamDef(key);
  if (!def || !def.editable) return { ok: false, message: `«${key}» no se puede editar.` };

  const value = raw.trim();
  if (value.length === 0 || value.length > 200) {
    return { ok: false, message: "El valor debe tener entre 1 y 200 caracteres." };
  }

  if (def.kind === "provider" && !def.options?.includes(value)) {
    return { ok: false, message: `${def.label} debe ser uno de: ${def.options?.join(", ")}.` };
  }

  if (def.kind === "int") {
    const n = Number(value);
    const min = def.min ?? 0;
    const max = def.max ?? Number.MAX_SAFE_INTEGER;
    if (!Number.isInteger(n) || n < min || n > max) {
      return { ok: false, message: `${def.label} debe ser un entero entre ${min} y ${max}.` };
    }
  }

  if (def.kind === "model" && def.capability) {
    const problem = await checkModelCapability(value, def.capability);
    if (problem) return { ok: false, message: problem };
  }

  return { ok: true, value };
}
