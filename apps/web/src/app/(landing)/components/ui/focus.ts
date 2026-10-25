/**
 * One focus treatment for every control on the landing page.
 *
 * An outline rather than a ring: it follows the element's border radius, needs
 * no offset colour, and survives the dark closing section where the `--ring`
 * token is nearly the same lightness as the background. `--primary` is vivid in
 * both themes, so the same class works everywhere on the page.
 */
export const FOCUS_RING =
  "focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2";
