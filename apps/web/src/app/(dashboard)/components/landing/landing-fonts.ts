import { IBM_Plex_Mono, Unbounded } from "next/font/google";

/**
 * The landing page is the only surface that uses these two families, so they
 * are loaded here rather than in the root layout. Both are exposed as CSS
 * variables and mapped to the `font-landing` / `font-landing-mono` utilities
 * in landing-theme.css; the variables only exist on the landing subtree.
 */

const unbounded = Unbounded({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-unbounded",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const landingFontVariables = `${unbounded.variable} ${plexMono.variable}`;
