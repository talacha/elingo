import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { applyConfigOverrides, describeConfig } from "@/lib/config/effective";
import { CONFIG_PARAMS, FLAGS, FLAG_KEYS, getParamDef, globalFlagRowKey } from "@/lib/config/registry";
import { validateParamValue } from "@/lib/config/validate";
import { ACCOUNT_FLAG_IMAGE, ACCOUNT_FLAG_VOICE } from "@/lib/db/repo";
import { envSchema, type Env } from "@/lib/env";

const env: Env = envSchema.parse({});

describe("registro de configuración", () => {
  it("las claves son únicas, en snake_case y cada una apunta a un campo real de Env", () => {
    const keys = CONFIG_PARAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const param of CONFIG_PARAMS) {
      expect(param.key).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(Object.keys(envSchema.shape)).toContain(param.envKey);
    }
  });

  it("define los tres modelos: base (texto), visual (imagen) y de voz (audio)", () => {
    expect(getParamDef("base_model")).toMatchObject({ envKey: "OPENROUTER_MODEL", capability: "text", editable: true });
    expect(getParamDef("visual_model")).toMatchObject({ envKey: "OPENROUTER_VISION_MODEL", capability: "image" });
    expect(getParamDef("speech_model")).toMatchObject({ envKey: "OPENROUTER_TRANSCRIBE_MODEL", capability: "audio" });
  });

  it("nunca incluye secretos ni conexiones: esos se quedan en variables de entorno", () => {
    for (const param of CONFIG_PARAMS) {
      // Sufijos de secreto/conexión anclados: AI_MAX_OUTPUT_TOKENS o DAILY_TOKEN_BUDGET son límites.
      expect(param.envKey).not.toMatch(/(_KEY|_TOKEN|_SECRET|_URL)$|DATABASE|ADMIN_EMAILS|SIGNING|SERVICE_ROLE/);
    }
  });

  it("los parámetros que se fijan al arrancar son de solo lectura", () => {
    for (const key of ["rate_limit_max", "rate_limit_window", "daily_token_budget"]) {
      expect(getParamDef(key)?.editable).toBe(false);
    }
  });

  it("los flags cubren voz e imagen y coinciden con las claves que usa la capa de datos", () => {
    expect([...FLAG_KEYS]).toEqual(["voice_mode", "image_mode"]);
    expect(FLAGS.map((f) => f.key)).toEqual([...FLAG_KEYS]);
    expect(ACCOUNT_FLAG_VOICE).toBe("voice_mode");
    expect(ACCOUNT_FLAG_IMAGE).toBe("image_mode");
    expect(globalFlagRowKey("voice_mode")).toBe("flag.voice_mode");
    for (const flag of FLAGS) expect(flag.ui.length).toBeGreaterThan(0);
  });

  it("los modelos por defecto son los gratuitos acordados y el visual/voz aceptan imagen/audio", () => {
    expect(env.OPENROUTER_MODEL).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(env.OPENROUTER_VISION_MODEL).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
    expect(env.OPENROUTER_TRANSCRIBE_MODEL).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
  });

  it(".env.example documenta los modelos con los mismos valores por defecto", () => {
    const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
    expect(example).toContain(`OPENROUTER_MODEL=${env.OPENROUTER_MODEL}`);
    expect(example).toContain(`OPENROUTER_VISION_MODEL=${env.OPENROUTER_VISION_MODEL}`);
    expect(example).toContain(`OPENROUTER_TRANSCRIBE_MODEL=${env.OPENROUTER_TRANSCRIBE_MODEL}`);
  });
});

describe("applyConfigOverrides", () => {
  it("sin filas aplicables devuelve el mismo objeto (las cachés por identidad siguen valiendo)", () => {
    expect(applyConfigOverrides(env, {})).toBe(env);
    expect(applyConfigOverrides(env, { "flag.voice_mode": "false", desconocida: "x" })).toBe(env);
  });

  it("aplica las filas por encima de las variables de entorno sin mutar el original", () => {
    const effective = applyConfigOverrides(env, {
      base_model: "openrouter/free",
      ai_max_output_tokens: "2048",
      ai_provider: "openrouter",
    });
    expect(effective).toMatchObject({
      OPENROUTER_MODEL: "openrouter/free",
      AI_MAX_OUTPUT_TOKENS: 2048,
      AI_PROVIDER: "openrouter",
    });
    expect(env.OPENROUTER_MODEL).toBe("nvidia/nemotron-3.5-lightning:free");
  });

  it("ignora valores que no validan (proveedor desconocido, entero inválido, vacío)", () => {
    const effective = applyConfigOverrides(env, {
      ai_provider: "gpt-4",
      ai_window_pairs: "muchos",
      ai_max_input_chars: "12.5",
      base_model: "   ",
    });
    expect(effective).toBe(env);
  });

  it("no deja cambiar en caliente lo que se fija al arrancar", () => {
    expect(applyConfigOverrides(env, { rate_limit_max: "1", daily_token_budget: "1" })).toBe(env);
  });
});

describe("describeConfig", () => {
  it("marca cada parámetro como guardado (db) o de entorno (env) y calcula el modelo activo", () => {
    const view = describeConfig({ ...env, OPENROUTER_API_KEY: "k" }, { visual_model: "openrouter/free" });
    const byKey = Object.fromEntries(view.params.map((p) => [p.key, p]));

    expect(view.provider).toBe("openrouter");
    expect(view.activeModel).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(byKey.visual_model).toMatchObject({ value: "openrouter/free", source: "db" });
    expect(byKey.base_model).toMatchObject({ source: "env" });
    expect(view.params).toHaveLength(CONFIG_PARAMS.length);
  });

  it("un valor guardado inválido se muestra como de entorno (es el que realmente se usa)", () => {
    const view = describeConfig(env, { ai_provider: "gpt-4" });
    expect(view.params.find((p) => p.key === "ai_provider")).toMatchObject({ value: "mock", source: "env" });
  });

  it("sin claves el proveedor activo es el mock", () => {
    expect(describeConfig(env, {})).toMatchObject({ provider: "mock", activeModel: "eli-mock" });
  });
});

describe("validateParamValue", () => {
  it("acepta un entero dentro de rango y un proveedor válido", async () => {
    expect(await validateParamValue("ai_window_pairs", " 4 ")).toEqual({ ok: true, value: "4" });
    expect(await validateParamValue("ai_provider", "anthropic")).toEqual({ ok: true, value: "anthropic" });
  });

  it("rechaza claves desconocidas o de solo lectura", async () => {
    expect((await validateParamValue("nope", "x")).ok).toBe(false);
    expect((await validateParamValue("daily_token_budget", "5")).ok).toBe(false);
  });
});
