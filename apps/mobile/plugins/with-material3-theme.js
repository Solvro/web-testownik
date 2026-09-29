const fs = require("fs");
const path = require("path");
const {
  AndroidConfig,
  withDangerousMod,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidStyles,
} = require("expo/config-plugins");

// Material 3 roles generated from the brand seed #3B7FE7 (SchemeTonalSpot),
// matching src/lib/theme.android.ts and every <Host seedColor>.
const palette = {
  light: {
    m3_primary: "#435E91",
    m3_on_primary: "#FFFFFF",
    m3_secondary_container: "#DAE2F9",
    m3_surface: "#F9F9FF",
    m3_on_surface: "#1A1B20",
    m3_on_surface_variant: "#44474E",
    m3_surface_container: "#EDEDF4",
    m3_surface_container_high: "#E8E7EE",
    m3_outline: "#74777F",
    m3_error: "#BA1A1A",
  },
  dark: {
    m3_primary: "#ACC7FF",
    m3_on_primary: "#0E2F60",
    m3_secondary_container: "#3F4759",
    m3_surface: "#111318",
    m3_on_surface: "#E2E2E9",
    m3_on_surface_variant: "#C4C6D0",
    m3_surface_container: "#1E2025",
    m3_surface_container_high: "#282A2F",
    m3_outline: "#8E9099",
    m3_error: "#FFB4AB",
  },
};

const themeItems = {
  colorPrimary: "m3_primary",
  colorOnPrimary: "m3_on_primary",
  colorSecondaryContainer: "m3_secondary_container",
  colorSurface: "m3_surface",
  colorOnSurface: "m3_on_surface",
  colorOnSurfaceVariant: "m3_on_surface_variant",
  colorSurfaceContainer: "m3_surface_container",
  colorSurfaceContainerHigh: "m3_surface_container_high",
  colorOutline: "m3_outline",
  colorError: "m3_error",
};

// React Native's Alert uses the AppCompat AlertDialog builder, which does not
// install the Material shape background MaterialAlertDialogBuilder would; give
// the dialog window the Material 3 container (28dp corners, surface container
// high, 24dp side insets) directly.
const dialogBackground = `<?xml version="1.0" encoding="utf-8"?>
<inset xmlns:android="http://schemas.android.com/apk/res/android"
    android:insetLeft="24dp"
    android:insetRight="24dp"
    android:insetTop="80dp"
    android:insetBottom="80dp">
  <shape android:shape="rectangle">
    <corners android:radius="28dp" />
    <solid android:color="@color/m3_surface_container_high" />
  </shape>
</inset>
`;

const setColors = (colors, values) => {
  for (const [name, value] of Object.entries(values))
    colors = AndroidConfig.Colors.assignColorValue(colors, { name, value });
  return colors;
};

// Base the Android activity theme on Material 3 so platform dialogs (Alert),
// popup menus and pickers use Material 3 shapes, type and colors instead of
// the legacy AppCompat look. The Material library ships with @expo/ui.
module.exports = function withMaterial3Theme(config) {
  config = withDangerousMod(config, [
    "android",
    (config) => {
      const dir = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/res/drawable",
      );
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, "m3_dialog_background.xml"),
        dialogBackground,
      );
      return config;
    },
  ]);
  config = withAndroidColors(config, (config) => {
    config.modResults = setColors(config.modResults, palette.light);
    return config;
  });
  config = withAndroidColorsNight(config, (config) => {
    config.modResults = setColors(config.modResults, palette.dark);
    return config;
  });
  return withAndroidStyles(config, (config) => {
    const styles = config.modResults.resources.style ?? [];
    const app = styles.find((style) => style.$.name === "AppTheme");
    if (!app) return config;
    app.$.parent = "Theme.Material3.DayNight.NoActionBar";
    app.item = (app.item ?? []).filter((item) => !(item.$.name in themeItems));
    for (const [name, color] of Object.entries(themeItems))
      app.item.push({ $: { name }, _: `@color/${color}` });
    app.item = app.item.filter(
      (item) => !/alertDialogTheme$/.test(item.$.name),
    );
    app.item.push(
      { $: { name: "alertDialogTheme" }, _: "@style/Theme.App.AlertDialog" },
      {
        $: { name: "android:alertDialogTheme" },
        _: "@style/Theme.App.AlertDialog",
      },
    );
    config.modResults.resources.style = [
      ...styles.filter((style) => style.$.name !== "Theme.App.AlertDialog"),
      {
        $: {
          name: "Theme.App.AlertDialog",
          parent: "ThemeOverlay.Material3.MaterialAlertDialog",
        },
        item: [
          {
            $: { name: "android:windowBackground" },
            _: "@drawable/m3_dialog_background",
          },
        ],
      },
    ];
    return config;
  });
};
