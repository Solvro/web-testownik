export const SCENE_CLASS = {
  deviceGlass: "lp-device-glass",
  screenLayer: "lp-screen-layer",
  laptopScreen: "lp-screen-laptop",
  tabletScreen: "lp-screen-tablet",
  phoneScreen: "lp-screen-phone",
} as const satisfies Record<string, string>;

/**
 * The loading still of the closed device stack, placed in container-height
 * units so the server-rendered position already agrees with the camera
 * solver. Shared by `DeviceStack` and the hero's pre-mount placeholder so the
 * hand-off between them is pixel-identical. Needs an `@container-[size]` parent.
 *
 * A background image rather than an <img>: below `lg` the placeholder is
 * `display: none`, and a hidden element does not fetch its background.
 * Regenerate both files with `pnpm capture:device-stack` whenever the closed
 * pose, the field of view or the framing constants change.
 */
export const DEVICE_COVER_CLASS = [
  "pointer-events-none absolute top-[36.38%] left-1/2 z-1 h-[63.42%] w-[89.35cqh] -translate-x-1/2",
  "bg-[url(/models/testownik-device-stack-cover-light-v8.webp)] bg-size-[100%_100%]",
  "dark:bg-[url(/models/testownik-device-stack-cover-dark-v8.webp)]",
].join(" ");
