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
      "src/app/(landing)/canvasui/canvas-bubble.tsx",
      "src/app/(landing)/canvasui/Glass.tsx",
      "src/app/(landing)/canvasui/ParticleObject.tsx",
    ],
  },
);
