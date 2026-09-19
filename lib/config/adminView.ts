import type { AdminConfigResponse } from "@/lib/contracts/admin";
import { getEnv } from "@/lib/env";
import { describeConfig } from "./effective";
import { getGlobalFlags } from "./flags";
import { FLAGS } from "./registry";
import { getConfigRows } from "./store";

/** Vista completa de la config para /admin: parámetros efectivos + flags globales. */
export async function buildAdminConfigResponse(): Promise<AdminConfigResponse> {
  const [rows, globalFlags] = await Promise.all([getConfigRows(), getGlobalFlags()]);
  const { provider, activeModel, params } = describeConfig(getEnv(), rows);
  return {
    provider,
    activeModel,
    params,
    flags: FLAGS.map((f) => ({
      key: f.key,
      label: f.label,
      description: f.description,
      ui: f.ui,
      enabled: globalFlags[f.key],
    })),
  };
}
