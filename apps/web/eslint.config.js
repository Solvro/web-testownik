import { solvro } from "@solvro/config/eslint";

export default await solvro({
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
    // html-in-canvas marks the captured subtree on the canvas element.
    "react/no-unknown-property": ["error", { ignore: ["tw", "layoutsubtree"] }],
  },
});
