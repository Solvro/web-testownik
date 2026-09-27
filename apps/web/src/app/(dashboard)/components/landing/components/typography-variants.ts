import { cva } from "class-variance-authority";

export const monoLabelVariants = cva("font-landing-mono font-bold uppercase", {
  variants: {
    size: {
      "2xs": "text-[0.55rem] tracking-[0.08em]",
      xs: "text-[0.58rem] tracking-[0.08em]",
      sm: "text-[0.62rem] tracking-[0.08em]",
      md: "text-[0.66rem] tracking-[0.14em]",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      primary: "text-primary",
      subtle: "text-foreground/55",
    },
  },
  defaultVariants: {
    size: "sm",
    tone: "muted",
  },
});
