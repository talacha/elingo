import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SUBJECTS } from "@/lib/contracts/chat";

/**
 * Esquema de Neon (Postgres) en Drizzle. Fuente de verdad: tasks.md, sección 6.5.
 * El SQL versionado en drizzle/ se genera con `pnpm db:generate`; nunca se edita a mano.
 */
export const USER_ROLES = ["student", "parent", "admin"] as const;
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
    /**
     * Hash (scrypt, sal incluida) de la "palabra segura" del padre/madre -- ver
     * lib/auth/safeword.ts. Nunca se guarda en texto plano. null = no configurada.
     */
    safeWordHash: text("safe_word_hash"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
  },
  (t) => [check("users_role_check", sql`${t.role} in ('student', 'parent', 'admin')`)],
);

/**
 * Ajustes configurables en tiempo de ejecución desde /admin (p. ej. OPENROUTER_MODEL),
 * como capa opcional por encima del valor por defecto de la variable de entorno.
 * Ver lib/settings.ts.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    subject: text("subject", { enum: SUBJECTS }),
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
export type AppSettingRow = typeof appSettings.$inferSelect;
