import { solvro } from "@solvro/config/eslint";

export default await solvro({
  rules: {
    "jsx-a11y/anchor-is-valid": [
      "error",
      {
        components: ["Link"],
        specialLink: ["to"],
      },
    ],
  },
});
