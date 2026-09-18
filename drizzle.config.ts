import { defineConfig } from "drizzle-kit";

// Fuera de Next (db:generate, db:migrate) nadie carga .env.local: lo hacemos aquí si existe.
// Node >= 21; no pisa variables ya definidas en el entorno.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Sin .env.local se usa el entorno del proceso (CI, Vercel).
}

const databaseUrl = process.env.DATABASE_URL;
const needsDatabase = process.argv.some((arg) =>
  ["migrate", "push", "pull", "studio"].includes(arg),
);
if (needsDatabase && !databaseUrl) {
  throw new Error(
    "DATABASE_URL no definida: exporta la variable o trae la del proyecto con `vercel env pull .env.local`.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: databaseUrl ?? "" },
});
