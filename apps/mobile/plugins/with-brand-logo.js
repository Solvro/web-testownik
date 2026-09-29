const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("expo/config-plugins");

// The full Testownik logo as a vector image set with a dark variant, so native
// code can put it in the navigation bar: UIImage(named: "brand-logo").
module.exports = function withBrandLogo(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const source = path.join(config.modRequest.projectRoot, "assets/brand");
      const set = path.join(
        config.modRequest.platformProjectRoot,
        config.modRequest.projectName,
        "Images.xcassets",
        "brand-logo.imageset",
      );
      fs.mkdirSync(set, { recursive: true });
      for (const file of ["logo-full.svg", "logo-full-dark.svg"])
        fs.copyFileSync(path.join(source, file), path.join(set, file));
      fs.writeFileSync(
        path.join(set, "Contents.json"),
        JSON.stringify(
          {
            images: [
              { filename: "logo-full.svg", idiom: "universal" },
              {
                filename: "logo-full-dark.svg",
                idiom: "universal",
                appearances: [{ appearance: "luminosity", value: "dark" }],
              },
            ],
            info: { author: "xcode", version: 1 },
            properties: { "preserves-vector-representation": true },
          },
          null,
          2,
        ),
      );
      return config;
    },
  ]);
};
