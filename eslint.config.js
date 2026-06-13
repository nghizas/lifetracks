import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "coverage", "design", "reference", "plan"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // core/ purity boundary — no React, DOM, Dexie, no reach into other src/ modules.
  // This is the lint-enforced rule the spec calls out (Architecture §Module layout).
  {
    files: ["src/core/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "react",
                "react-dom",
                "react/*",
                "react-dom/*",
                "dexie",
                "zustand",
                "zustand/*",
                "@/state/*",
                "@/storage/*",
                "@/ai/*",
                "@/timeline/*",
                "@/panels/*",
                "@/app/*",
              ],
              message:
                "core/ must remain pure: no React, DOM, Dexie, Zustand, or non-core imports.",
            },
          ],
        },
      ],
    },
  },
  // tests can use vitest globals
  {
    files: ["**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);
