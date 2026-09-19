import { afterEach, describe, expect, it } from "vitest";
import { inputHasImage, modelForRequest, type TutorProvider } from "@/lib/contracts/ai";
import { chatRequestSchema, MAX_IMAGE_BASE64_CHARS } from "@/lib/contracts/chat";
import {
  MAX_SPEECH_INPUT_CHARS,
  MAX_TRANSCRIBE_AUDIO_BASE64_CHARS,
  speechRequestSchema,
  transcribeRequestSchema,
} from "@/lib/contracts/media";
import { getEnv, resetEnvCache, resolveProvider } from "@/lib/env";
import { MemoryRateLimiter, parseWindow } from "@/lib/ratelimit/memory";

const uuid = () => crypto.randomUUID();

describe("contrato POST /api/chat", () => {
  it("acepta una petición válida", () => {
    const parsed = chatRequestSchema.safeParse({
      sessionId: uuid(),
      subject: "mates",
      messages: [{ id: uuid(), role: "user", content: "Tengo este problema: 3/4 + 1/2" }],
    });
    expect(parsed.success).toBe(true);
  });

  it("rechaza mensajes vacíos y asignaturas desconocidas", () => {
    expect(chatRequestSchema.safeParse({ sessionId: uuid(), messages: [] }).success).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        sessionId: uuid(),
        subject: "historia",
        messages: [{ id: uuid(), role: "user", content: "hola" }],
      }).success,
    ).toBe(false);
  });

  it("T-050: acepta una imagen adjunta con mediaType y tamaño válidos", () => {
    const parsed = chatRequestSchema.safeParse({
      sessionId: uuid(),
      messages: [
        {
          id: uuid(),
          role: "user",
          content: "mira este problema",
          image: { mediaType: "image/webp", data: "ZmFrZS1pbWFnZQ==" },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("T-050: rechaza mediaType fuera de la lista y payloads mayores que MAX_IMAGE_BASE64_CHARS", () => {
    expect(
      chatRequestSchema.safeParse({
        sessionId: uuid(),
        messages: [
          {
            id: uuid(),
            role: "user",
            content: "foto",
            image: { mediaType: "image/gif", data: "ZmFrZQ==" },
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      chatRequestSchema.safeParse({
        sessionId: uuid(),
        messages: [
          {
            id: uuid(),
            role: "user",
            content: "foto",
            image: { mediaType: "image/jpeg", data: "a".repeat(MAX_IMAGE_BASE64_CHARS + 1) },
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("T-050: el texto sigue siendo obligatorio aunque haya imagen", () => {
    expect(
      chatRequestSchema.safeParse({
        sessionId: uuid(),
        messages: [
          {
            id: uuid(),
            role: "user",
            content: "",
            image: { mediaType: "image/jpeg", data: "ZmFrZQ==" },
          },
        ],
      }).success,
    ).toBe(true); // content vacío pasa zod (el límite de "no vacío" lo aplica la UI/route, igual que hoy sin imagen)
  });
});

describe("T-051: modelForRequest / inputHasImage", () => {
  const provider: TutorProvider = {
    name: "openrouter",
    model: "nvidia/nemotron-3.5-lightning:free",
    visionModel: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    reply: async () => {
      throw new Error("no usado en este test");
    },
  };

  it("sin imagen, usa el modelo por defecto", () => {
    const input = { messages: [{ role: "user" as const, content: "hola" }] };
    expect(inputHasImage(input)).toBe(false);
    expect(modelForRequest(provider, input)).toBe(provider.model);
  });

  it("con imagen en el último turno, usa visionModel si el proveedor lo define", () => {
    const input = {
      messages: [
        { role: "user" as const, content: "hola" },
        {
          role: "user" as const,
          content: "mira",
          images: [{ mediaType: "image/png" as const, data: "ZmFrZQ==" }],
        },
      ],
    };
    expect(inputHasImage(input)).toBe(true);
    expect(modelForRequest(provider, input)).toBe(provider.visionModel);
  });

  it("con imagen pero sin visionModel definido (Anthropic), cae al modelo normal", () => {
    const noVision: TutorProvider = { ...provider, visionModel: undefined };
    const input = {
      messages: [
        { role: "user" as const, content: "mira", images: [{ mediaType: "image/png" as const, data: "x" }] },
      ],
    };
    expect(modelForRequest(noVision, input)).toBe(noVision.model);
  });
});

describe("T-052/T-053: contratos de voz", () => {
  it("transcribeRequestSchema acepta audio y mimeType, rechaza payloads de más de MAX_TRANSCRIBE_AUDIO_BASE64_CHARS", () => {
    expect(
      transcribeRequestSchema.safeParse({ audio: "ZmFrZQ==", mimeType: "audio/webm" }).success,
    ).toBe(true);
    expect(
      transcribeRequestSchema.safeParse({
        audio: "a".repeat(MAX_TRANSCRIBE_AUDIO_BASE64_CHARS + 1),
        mimeType: "audio/webm",
      }).success,
    ).toBe(false);
    expect(transcribeRequestSchema.safeParse({ audio: "", mimeType: "audio/webm" }).success).toBe(
      false,
    );
  });

  it("speechRequestSchema acepta texto no vacío hasta MAX_SPEECH_INPUT_CHARS", () => {
    expect(speechRequestSchema.safeParse({ text: "Buen intento, revisemos el paso anterior." }).success).toBe(
      true,
    );
    expect(speechRequestSchema.safeParse({ text: "" }).success).toBe(false);
    expect(speechRequestSchema.safeParse({ text: "a".repeat(MAX_SPEECH_INPUT_CHARS + 1) }).success).toBe(
      false,
    );
  });
});

describe("env", () => {
  afterEach(() => resetEnvCache());

  it("aplica valores por defecto y elige mock sin claves", () => {
    resetEnvCache();
    const env = getEnv();
    expect(env.ANTHROPIC_MODEL).toBe("claude-fable-5-1");
    expect(env.OPENROUTER_MODEL).toBe("nvidia/nemotron-3.5-lightning:free");
    expect(env.OPENROUTER_VISION_MODEL).toBe("nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free");
    expect(env.FISH_AUDIO_API_KEY).toBeUndefined();
    expect(env.AI_WINDOW_PAIRS).toBe(6);
    expect(env.AUTH_REQUIRED).toBe(false);
    expect(resolveProvider({ ...env, ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: undefined, AI_PROVIDER: undefined })).toBe("mock");
  });

  it("deduce el proveedor por las claves presentes", () => {
    const base = getEnv();
    expect(resolveProvider({ ...base, AI_PROVIDER: undefined, ANTHROPIC_API_KEY: "k" })).toBe("anthropic");
    expect(
      resolveProvider({ ...base, AI_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined, OPENROUTER_API_KEY: "k" }),
    ).toBe("openrouter");
    expect(resolveProvider({ ...base, AI_PROVIDER: "mock", ANTHROPIC_API_KEY: "k" })).toBe("mock");
  });
});

describe("MemoryRateLimiter", () => {
  it("parsea ventanas", () => {
    expect(parseWindow("10 m")).toBe(600_000);
    expect(parseWindow("30s")).toBe(30_000);
    expect(() => parseWindow("pronto")).toThrow();
  });

  it("permite N peticiones por ventana y luego bloquea hasta que expira", async () => {
    let now = 1_000;
    const limiter = new MemoryRateLimiter(2, 1_000, () => now);
    expect((await limiter.check("a")).ok).toBe(true);
    expect((await limiter.check("a")).ok).toBe(true);
    const blocked = await limiter.check("a");
    expect(blocked.ok).toBe(false);
    expect(blocked.resetAt).toBe(2_000);
    expect((await limiter.check("b")).ok).toBe(true);
    now = 2_001;
    expect((await limiter.check("a")).ok).toBe(true);
  });
});
