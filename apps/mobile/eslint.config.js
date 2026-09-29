const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  {
    ignores: [
      "dist/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "test-results/**",
      "src/lib/math-style.json",
    ],
  },
  { rules: { "import/no-unresolved": "off" } },
]);
