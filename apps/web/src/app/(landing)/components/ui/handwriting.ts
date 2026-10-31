import { Caveat } from "next/font/google";

const caveat = Caveat({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  preload: false,
});

export const handwritingClassName = caveat.className;
