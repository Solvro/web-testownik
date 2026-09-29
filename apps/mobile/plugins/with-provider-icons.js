const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

// AI provider logos as template image sets, so SwiftUI draws them like SF Symbols
// (label-colored, adapting to dark mode) in menus: Image(assetName: "provider-…").
module.exports = function withProviderIcons(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const source = path.join(
        config.modRequest.projectRoot,
        "assets/providers",
      );
      const catalog = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        "Images.xcassets",
      );
      for (const file of fs.readdirSync(source)) {
        if (!file.endsWith(".svg")) continue;
        const set = path.join(
          catalog,
          `${path.basename(file, ".svg")}.imageset`,
        );
        fs.mkdirSync(set, { recursive: true });
        fs.copyFileSync(path.join(source, file), path.join(set, file));
        fs.writeFileSync(
          path.join(set, "Contents.json"),
          JSON.stringify(
            {
              images: [{ filename: file, idiom: "universal" }],
              info: { author: "xcode", version: 1 },
              properties: {
                "preserves-vector-representation": true,
                "template-rendering-intent": "template",
              },
            },
            null,
            2,
          ),
        );
      }
      return config;
    },
  ]);
};
