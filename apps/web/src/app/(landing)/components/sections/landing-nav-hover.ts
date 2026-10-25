/** What the pointer (or focus) is on in the header; mirrored into the Bubble's copy. */
export interface NavHover {
  /** The hovered section link's href; the underline sits under it. */
  link: string | null;
  /** Where the underline last was, so it fades out in place. */
  underline: { left: number; width: number } | null;
  control: "toggle" | "start" | null;
}

export const NAV_HOVER_NONE: NavHover = {
  link: null,
  underline: null,
  control: null,
};
