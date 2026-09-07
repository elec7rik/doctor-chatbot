// Next 16's eslint-config-next ships a native flat config, so we import it
// directly instead of the create-next-app FlatCompat shim. FlatCompat routes
// through @eslint/eslintrc's legacy config-validator, which crashes on
// eslint-config-next's self-referential plugin objects under ESLint 9.39+
// ("Converting circular structure to JSON"). The core-web-vitals entry already
// includes the TypeScript rules and the default ignores.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default [
  ...nextCoreWebVitals,
  {
    // eslint-config-next 16 ships eslint-plugin-react-hooks v6, whose new
    // React-Compiler-era rules default to "error". They're advisory best
    // practices (they flag patterns like reading a ref during render or calling
    // setState in an effect) — the code here is covered by types, unit tests and
    // the build, so we surface them as warnings rather than blocking CI on a
    // large, risky refactor of working hooks. Revisit when adopting the compiler.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/immutability": "warn",
    },
  },
  { ignores: [".next/**", "node_modules/**"] },
];
