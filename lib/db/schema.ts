import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Esquema de Neon (Postgres) en Drizzle. Fuente de verdad: tasks.md, sección 6.5.
 * El SQL versionado en drizzle/ se genera con `pnpm db:generate`; nunca se edita a mano.
 */
export const USER_ROLES = ["student", "parent", "super-admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MESSAGE_ROLES = ["user", "assistant", "system"] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

const timestamptz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supabaseUserId: text("supabase_user_id").unique(),
    displayName: text("display_name"),
    grade: text("grade").notNull().default("6º"),
    role: text("role", { enum: USER_ROLES }).notNull().default("student"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    /** M7: hash (scrypt + sal) de la palabra segura que protege /parents; null = aún no la fijó. */
    safeWordHash: text("safe_word_hash"),
    /** OBSOLETA: ya no se lee. Imágenes y voz son los flags `image_mode`/`voice_mode` de `account_flags`. */
    allowImages: boolean("allow_images").notNull().default(true),
    /** OBSOLETA: ver `allowImages`. */
    allowVoice: boolean("allow_voice").notNull().default(true),
    allowText: boolean("allow_text").notNull().default(true),
  },
  (t) => [check("users_role_check", sql`${t.role} in ('student', 'parent', 'super-admin')`)],
);

/** M7: config de IA en caliente que un admin cambia desde /admin (tasks.md 6.13). Vacía = todo por env vars. */
export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
export type AppConfigRow = typeof appConfig.$inferSelect;

/**
 * Feature flags por cuenta: solo las filas que se apartan del valor global (ausente = sigue al
 * global). El valor global de cada flag vive en `app_config` con la clave `flag.<nombre>`.
 * Fuente de verdad de las claves: lib/config/registry.ts.
 */
export const accountFlags = pgTable(
  "account_flags",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    flag: text("flag").notNull(),
    enabled: boolean("enabled").notNull(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.flag] })],
);
export type AccountFlagRow = typeof accountFlags.$inferSelect;

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    /**
     * OBSOLETA: ya no se lee ni se escribe (las asignaturas se quitaron de la app). Se conserva, con su
     * CHECK, para no migrar producción; se puede borrar en una migración aparte.
     */
    subject: text("subject"),
    title: text("title"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("chat_sessions_subject_check", sql`${t.subject} in ('mates', 'lengua', 'ciencias')`),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    role: text("role", { enum: MESSAGE_ROLES }).notNull(),
    content: text("content").notNull(),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    model: text("model"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_session_created_idx").on(t.sessionId, t.createdAt),
    check("messages_role_check", sql`${t.role} in ('user', 'assistant', 'system')`),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type ChatSessionRow = typeof chatSessions.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
