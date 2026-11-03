/**
 * `peek` picks how the desktop TOC previews a section: `hero` is a static
 * still, since the live hero's canvases do not survive `cloneNode`; `top` and
 * `center` align a scaled DOM clone in the peek window.
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
    peek: "center",
  },
  {
    id: "footer",
    label: "Zacznij korzystać",
    navLabel: "Dołącz",
    peek: "center",
  },
] as const;

export type LandingSectionPeek = (typeof LANDING_SECTIONS)[number]["peek"];

export type LandingSectionId = (typeof LANDING_SECTIONS)[number]["id"];
