/**
 * Single source of truth for the Testownik Wrapped story.
 *
 * Everything you'd want to retune is hardcoded here:
 *  - which slides appear and in what order        → `SLIDES`
 *  - per-slide auto-advance timing                → `SLIDES[].duration` / `DEFAULT_DURATION`
 *  - colour palettes (themes)                     → `PALETTES`
 *  - the default look                             → `WRAPPED_DEFAULTS`
 *  - the logo easter-egg                          → `LOGO_EASTER_EGG_CLICKS`
 *
 * To add a slide: write a component, register it in `slides/index.tsx`, then add
 * its id to `SLIDES`. To reorder: move the entry. To hide one: remove it (or give
 * it an `enabled` predicate). No player/orchestration changes required.
 *
 * Whether the story is shown at all (vs. the empty state) and whether the
 * "creator impact" slide appears are derived from the API response, not config.
 */
import type { WrappedData } from "@/types/wrapped";

export type SlideId =
  | "intro"
  | "time"
  | "volume"
  | "accuracy"
  | "rhythm"
  | "top"
  | "hardest"
  | "creator"
  | "rank"
  | "outro";

export const PALETTE_NAMES = [
  "wrapped",
  "summer",
  "neon",
  "indigo",
  "pastel",
] as const;
export type PaletteName = (typeof PALETTE_NAMES)[number];

export const DECORATION_NAMES = [
  "none",
  "summer",
  "wrapped",
  "lines",
  "confetti",
  "sparks",
  "blobs",
] as const;
export type DecorationName = (typeof DECORATION_NAMES)[number];

export const PROGRESS_NAMES = ["dots", "bars", "numbers", "none"] as const;
export type ProgressStyle = (typeof PROGRESS_NAMES)[number];

export interface Palette {
  accent: string;
  /** Accent used on dark backgrounds (where `fg` would clash). */
  hlDark: string;
  danger: string;
  /** Per-slide background, cycled by slide index. */
  pop: string[];
  /** Per-slide foreground, cycled by slide index (parallel to `pop`). */
  fg: string[];
}

export const PALETTES: Record<PaletteName, Palette> = {
  wrapped: {
    accent: "#ff3d8b",
    hlDark: "#c6ff3a",
    danger: "#ff5147",
    pop: [
      "#15171c",
      "#ff5147",
      "#c6ff3a",
      "#19d3da",
      "#ffb020",
      "#ff3d8b",
      "#c6ff3a",
      "#ff5147",
      "#19d3da",
      "#15171c",
    ],
    fg: [
      "#ffffff",
      "#ffffff",
      "#15171c",
      "#15171c",
      "#15171c",
      "#ffffff",
      "#15171c",
      "#ffffff",
      "#15171c",
      "#ffffff",
    ],
  },
  summer: {
    accent: "#ff4d6d",
    hlDark: "#ffd23f",
    danger: "#ff5d3c",
    pop: [
      "#0a3d4d",
      "#ff7a4d",
      "#ffd23f",
      "#16c0b0",
      "#ff5d8f",
      "#ffd23f",
      "#16c0b0",
      "#ff7a4d",
      "#3aa0ff",
      "#0a3d4d",
    ],
    fg: [
      "#ffe9c7",
      "#15171c",
      "#15171c",
      "#06231f",
      "#15171c",
      "#15171c",
      "#06231f",
      "#15171c",
      "#07263f",
      "#ffe9c7",
    ],
  },
  neon: {
    accent: "#ff2d8b",
    hlDark: "#c6ff3a",
    danger: "#ff2d8b",
    pop: [
      "#0b0014",
      "#c6ff3a",
      "#ff2d8b",
      "#7b2dff",
      "#19d3da",
      "#c6ff3a",
      "#ff2d8b",
      "#7b2dff",
      "#19d3da",
      "#0b0014",
    ],
    fg: [
      "#c6ff3a",
      "#0b0014",
      "#ffffff",
      "#ffffff",
      "#0b0014",
      "#0b0014",
      "#ffffff",
      "#ffffff",
      "#0b0014",
      "#c6ff3a",
    ],
  },
  indigo: {
    accent: "#2f6fd6",
    hlDark: "#9db8e8",
    danger: "#e23a4a",
    pop: [
      "#192941",
      "#5278B9",
      "#37548C",
      "#e8eef7",
      "#5278B9",
      "#37548C",
      "#192941",
      "#5278B9",
      "#37548C",
      "#192941",
    ],
    fg: [
      "#e8eef7",
      "#ffffff",
      "#ffffff",
      "#192941",
      "#ffffff",
      "#ffffff",
      "#e8eef7",
      "#ffffff",
      "#ffffff",
      "#e8eef7",
    ],
  },
  pastel: {
    accent: "#ff7aa0",
    hlDark: "#ffb3c1",
    danger: "#ff7aa0",
    pop: [
      "#2b2440",
      "#ffb3c1",
      "#a0e8d8",
      "#ffe0a3",
      "#b8c6ff",
      "#ffb3c1",
      "#a0e8d8",
      "#ffe0a3",
      "#b8c6ff",
      "#2b2440",
    ],
    fg: [
      "#ffe0a3",
      "#2b2440",
      "#1f3b34",
      "#3d2f10",
      "#1d2742",
      "#2b2440",
      "#1f3b34",
      "#3d2f10",
      "#1d2742",
      "#ffe0a3",
    ],
  },
};

export interface SlideConfig {
  id: SlideId;
  /** Auto-advance duration in ms. Falls back to `DEFAULT_DURATION`. */
  duration?: number;
  /** Optional gate (derived from API data). When false the slide is skipped. */
  enabled?: (data: WrappedData) => boolean;
}

/** Time (ms) a slide stays on screen before auto-advancing. */
export const DEFAULT_DURATION = 8200;

/**
 * Ordered story. Reorder / add / remove freely.
 * The `creator` slide only appears when the API returns creator-impact data.
 */
export const SLIDES: SlideConfig[] = [
  { id: "intro", duration: 5200 },
  { id: "time" },
  { id: "volume" },
  { id: "accuracy" },
  { id: "rhythm" },
  { id: "top", duration: 10_500 },
  {
    id: "hardest",
    duration: 9800,
    enabled: (data) => data.hardest_question != null,
  },
  {
    id: "creator",
    enabled: (data) => data.is_global !== true && data.creator_impact != null,
  },
  { id: "rank", enabled: (data) => data.is_global !== true },
  { id: "outro" },
];

/** Duration (ms) of the entrance / count-up animation on each slide. */
export const ENTER_MS = 1100;

/** Outro call-to-action targets. */
export const GITHUB_URL = "https://github.com/Solvro/web-testownik";
/** Formbricks action fired when the user opts into the survey. */
export const FORMBRICKS_SURVEY_ACTION = "wrapped_survey";

export interface WrappedSettings {
  palette: PaletteName;
  decoration: DecorationName;
  progress: ProgressStyle;
}

export const WRAPPED_DEFAULTS: WrappedSettings = {
  palette: "wrapped",
  decoration: "summer",
  progress: "bars",
};

// --- Logo easter egg -------------------------------------------------------

/** Clicks on the logo (in a row) that trigger a random theme. */
export const LOGO_EASTER_EGG_CLICKS = 5;
/** Max gap (ms) between clicks for them to count as "in a row". */
export const LOGO_EASTER_EGG_WINDOW_MS = 600;

function randomFrom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Pick a random, visible theme combination for the easter egg. It lives in
 * React state only — deliberately not persisted, so it resets on reload.
 */
export function pickRandomSettings(): WrappedSettings {
  return {
    palette: randomFrom(PALETTE_NAMES),
    decoration: randomFrom(DECORATION_NAMES.filter((d) => d !== "none")),
    progress: randomFrom(PROGRESS_NAMES.filter((p) => p !== "none")),
  };
}

/** The visible, ordered slides for the given API data. */
export function resolveSlides(data: WrappedData): SlideConfig[] {
  return SLIDES.filter((slide) => slide.enabled?.(data) ?? true);
}
