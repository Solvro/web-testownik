import { Anton, Space_Grotesk } from "next/font/google";

/** Big, bold display face for the headline numbers (the "Wrapped" look). */
export const wrappedDisplay = Anton({
  weight: "400",
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-wrapped-display",
});

/** Body / label face. */
export const wrappedSans = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-wrapped-sans",
});

/** Class string to apply on the Wrapped root so the CSS variables resolve. */
export const wrappedFontVariables = `${wrappedDisplay.variable} ${wrappedSans.variable}`;
