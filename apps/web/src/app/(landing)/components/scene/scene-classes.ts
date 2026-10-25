/**
 * Each screen host holds one iframe (`device-screen-frame.tsx`), a document of
 * its own, so nothing inside can paint, portal or scroll past the device. The
 * host's `pointer-events` and `inert` reach into the frame. `attachScreen`
 * gives each host an explicit native width and height, which is what makes
 * size containment safe; keep it here, outside the perspective ancestors.
 */
const SCREEN_HOST_CLASS =
  "bg-background pointer-events-auto overflow-hidden backface-hidden will-change-[transform,opacity] contain-size contain-layout contain-paint *:size-full";

/**
 * Classes for the DOM the device stack creates itself: the CSS3D layer and
 * the three screen hosts. The `lp-screen-*` names remain only as hooks for
 * the bezel, notch and Dynamic Island pseudo-elements in landing.css.
 */
export const SCENE_CLASS = {
  screenLayer: [
    "pointer-events-none absolute inset-0 z-3 overflow-hidden opacity-0 transition-opacity duration-150 ease-linear",
    "group-data-[model-ready=true]/stack:opacity-100 group-data-[cover-only=true]/stack:opacity-0!",
  ].join(" "),
  laptopScreen: `lp-screen-laptop ${SCREEN_HOST_CLASS}`,
  tabletScreen: `${SCREEN_HOST_CLASS} rounded-[16px] shadow-[inset_0_0_0_1px_rgb(0_0_0/38%)] transition-opacity duration-120 ease-linear`,
  phoneScreen: `lp-screen-phone ${SCREEN_HOST_CLASS} rounded-[64px] shadow-[inset_0_0_0_2px_rgb(0_0_0/48%)] transition-opacity duration-120 ease-linear`,
} as const satisfies Record<string, string>;

/**
 * The loading still of the closed device stack. The classes reproduce the
 * camera solver's box in CSS: the picture is one fixed camera at every stage
 * size (`frameLaptop`), so the box is a scale of the reference one, bound by
 * the stage's height on stages wider than `REFERENCE_ASPECT` and by its
 * width below, and its top sits a fixed share of its height above the
 * stage's middle. `placeDeviceCover` writes the same rectangle in pixels on
 * the client. Shared by `DeviceStack` and the hero's pre-mount placeholder.
 * Needs an `@container-[size]` parent.
 *
 * A background image rather than an <img>: below `lg` the placeholder is
 * `display: none`, and a hidden element does not fetch its background.
 * Regenerate both files with `pnpm capture:device-stack` whenever the closed
 * pose, the field of view or the framing constants change.
 */
export const DEVICE_COVER_CLASS = [
  "pointer-events-none absolute top-[calc(50%-0.2148*min(63.41cqh,45.55cqw))] left-1/2 z-1 h-[min(63.41cqh,45.55cqw)] w-[min(89.34cqh,64.18cqw)] -translate-x-1/2",
  "bg-[url(/models/testownik-device-stack-closed-light-v1.webp)] bg-size-[100%_100%]",
  "dark:bg-[url(/models/testownik-device-stack-closed-dark-v1.webp)]",
].join(" ");
