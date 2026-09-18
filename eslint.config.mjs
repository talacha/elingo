import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    // Worktrees de agentes y de otras herramientas, nunca parte del proyecto
    ".claude/**",
    ".kilo/**",
    "tmp-scaffold/**",
  ]),
]);

export default eslintConfig;
