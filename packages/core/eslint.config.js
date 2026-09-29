import { solvro } from "@solvro/config/eslint";

export default await solvro({
  rules: {
    // Core also runs on Hermes (React Native), which lacks Array#toSorted.
    // Sort copies instead: `[...items].sort()` or after `filter`/`map`.
    "unicorn/no-array-sort": "off",
  },
});
