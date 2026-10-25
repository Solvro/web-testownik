/*
 * Every dimension that differs between the hero header and the compact bar
 * is a hero value minus a shrink scaled by `--lp-nav-t` (0 in the hero, 1
 * once settled), so the two variants are pixel-identical at 0. The property
 * is registered in landing.css, so flipping it transitions every dimension
 * together. The compact bar's dock needs the hero height for its settle
 * range, hence a module of its own.
 */
export const NAV_VARIABLES =
  "[--lp-nav-hero-h:4.5rem] [--lp-nav-shrink:0.5rem] sm:[--lp-nav-hero-h:5.3rem] sm:[--lp-nav-shrink:1.3rem]";
