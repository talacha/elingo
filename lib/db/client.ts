import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Cliente Drizzle sobre el driver HTTP de Neon: una petición HTTP por consulta, sin conexiones
 * persistentes. Es lo adecuado para Vercel Functions y para el endpoint de QStash (T-022).
 */
export function createDb(databaseUrl: string) {
  return drizzle({ client: neon(databaseUrl), schema });
}

export type Db = ReturnType<typeof createDb>;
