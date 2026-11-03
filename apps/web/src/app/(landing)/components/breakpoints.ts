/** Tailwind's default responsive breakpoints, for browser APIs used from JS. */
export const BREAKPOINT = { lg: 1024 } as const;

/** Switches between the 3D and the phone hero. Keep in step with `lg:` in `sections/hero*`. */
export const DESKTOP_STAGE_QUERY = `(min-width: ${String(BREAKPOINT.lg)}px)`;

/** Widths the 3D hero changes shape at, independent of page layout. */
export const SCENE_WIDTH = { satellites: 1280 } as const;
