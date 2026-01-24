import { solvro } from "@solvro/config/eslint";

export default await solvro({
  rules: {
    "react-refresh/only-export-components": [
      "warn",
      {
        allowExportNames: ["metadata", "viewport"],
      },
    ],
  },
});
