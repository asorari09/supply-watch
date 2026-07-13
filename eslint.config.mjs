import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { FlatCompat } from "@eslint/eslintrc";
import importPlugin from "eslint-plugin-import";
import tseslint from "typescript-eslint";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const restrictedTimeSyntax = [
  "error",
  {
    selector: "NewExpression[callee.name='Date']",
    message: "Use the injected RunContext clock instead of new Date().",
  },
  {
    selector:
      "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Use the injected RunContext clock instead of Date.now().",
  },
];

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...tseslint.configs.recommended,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "coverage/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "src/lib/db/database.types.ts",
    ],
  },
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
        },
      ],
      "no-restricted-syntax": restrictedTimeSyntax,
    },
  },
  {
    files: ["src/lib/runtime/**", "src/lib/adapters/**"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default config;
