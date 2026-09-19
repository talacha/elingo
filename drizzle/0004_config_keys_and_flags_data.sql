-- Datos (no esquema): claves de config en snake_case y flags por cuenta.
-- 1) Las claves de /admin pasan de nombres de env var a los del registro (lib/config/registry.ts).
UPDATE "app_config" SET "key" = 'ai_provider' WHERE "key" = 'AI_PROVIDER' AND NOT EXISTS (SELECT 1 FROM "app_config" WHERE "key" = 'ai_provider');--> statement-breakpoint
UPDATE "app_config" SET "key" = 'anthropic_model' WHERE "key" = 'ANTHROPIC_MODEL' AND NOT EXISTS (SELECT 1 FROM "app_config" WHERE "key" = 'anthropic_model');--> statement-breakpoint
UPDATE "app_config" SET "key" = 'base_model' WHERE "key" = 'OPENROUTER_MODEL' AND NOT EXISTS (SELECT 1 FROM "app_config" WHERE "key" = 'base_model');--> statement-breakpoint
-- 2) Los interruptores de /parents (users.allow_images / allow_voice) pasan a ser feature flags por
--    cuenta. Solo se copian los que estaban desactivados: sin fila, la cuenta sigue al valor global.
INSERT INTO "account_flags" ("user_id", "flag", "enabled", "updated_by") SELECT "id", 'image_mode', false, 'migration' FROM "users" WHERE "allow_images" = false ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "account_flags" ("user_id", "flag", "enabled", "updated_by") SELECT "id", 'voice_mode', false, 'migration' FROM "users" WHERE "allow_voice" = false ON CONFLICT DO NOTHING;
