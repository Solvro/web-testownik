/**
 * `peek` picks how the desktop TOC previews a section:
 * - `hero`: a dedicated static still (copy + device cover). The live hero is
 *   a WebGL canvas, CSS3D screens and an html-in-canvas Bubble, none of which
 *   survive `cloneNode`.
 * - `top` / `center`: a scaled DOM clone, aligned to the section's top or
 *   vertical centre inside the peek window.
 */
export const LANDING_SECTIONS = [
  { id: "start", label: "Na początek", navLabel: "Start", peek: "hero" },
  {
    id: "features",
    label: "Zobacz w praktyce",
    navLabel: "Produkt",
    peek: "top",
  },
  { id: "faq", label: "Pytania i odpowiedzi", navLabel: "FAQ", peek: "top" },
  { id: "story", label: "Nasza historia", navLabel: "Historia", peek: "top" },
  { id: "team", label: "Poznaj zespół", navLabel: "Zespół", peek: "top" },
  {
    id: "perks",
    label: "Zniżki dla studentów",
    navLabel: "Zniżki",
    peek: "top",
  },
  {
    id: "footer",
    label: "Zacznij korzystać",
    navLabel: "Dołącz",
    peek: "center",
  },
] as const;

export type LandingSectionPeek = (typeof LANDING_SECTIONS)[number]["peek"];
