export const SCENE_CLASS = {
  deviceGlass: "lp-device-glass",
  screenLayer: "lp-screen-layer",
  laptopScreen: "lp-screen-laptop",
  tabletScreen: "lp-screen-tablet",
  phoneScreen: "lp-screen-phone",
} as const satisfies Record<string, string>;
