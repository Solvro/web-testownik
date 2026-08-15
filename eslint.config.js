import { solvro } from "@solvro/config/eslint";

export default await solvro(
  {
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        {
          allowExportNames: [
            "metadata",
            "generateMetadata",
            "viewport",
            "size",
            "contentType",
          ],
        },
      ],
      "react/no-unknown-property": ["error", { ignore: ["tw"] }],
    },
  },
  {
    ignores: [
      "src/components/canvasui/canvas-bubble.tsx",
      "src/components/canvasui/Glass.tsx",
      "src/components/canvasui/ParticleObject.tsx",
    ],
  },
);
