import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // ───────────────────────────────────────────────────
  // Rule overrides for Midnight SDK integration code.
  // The SDK's TypeScript typings are incomplete, so
  // `any` is unavoidable in provider/wallet wiring.
  // ───────────────────────────────────────────────────
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/ban-ts-comment": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      // React Hooks v7 Compiler rules — setState in useEffect is standard
      // for client-side initialization in Next.js App Router.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/invariant": "warn",
      "react-hooks/immutability": "warn",
      // Unescaped quotes in JSX label text render correctly.
      "react/no-unescaped-entities": "warn",
    },
  },
]);

export default eslintConfig;
