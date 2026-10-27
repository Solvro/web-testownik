/** Tailwind's default responsive breakpoints, for browser APIs used from JS. */
export const BREAKPOINT = { lg: 1024, xl: 1280 } as const;

/**
 * The single switch between the two heroes. At and above `lg` the page gets
 * the sticky 3D stage (Bubble, WebGL device stack, scroll progress); below it,
 * the CSS-only phone. Keep in step with the `lg:` utilities in `sections/hero*`.
 */
export const DESKTOP_STAGE_QUERY = `(min-width: ${String(BREAKPOINT.lg)}px)`;

/** Widths the 3D hero changes shape at, independent of page layout. */
export const SCENE_WIDTH = { satellites: 1280 } as const;
