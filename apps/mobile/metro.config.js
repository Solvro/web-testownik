const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

// Expo detects the pnpm workspace root and watches packages/core automatically.
const config = getDefaultConfig(__dirname);

// Generated output is never part of the app bundle. Watching it makes Metro push
// an HMR "Refreshing..." to the app on every Next.js recompile or test run.
const ignored = [
  "../web/.next",
  "test-results",
  "playwright-report",
  ".local",
  "ios/build",
].map((dir) => path.resolve(__dirname, dir));
const escapeRegExp = (value) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
config.resolver.blockList = [
  ...[config.resolver.blockList].flat(),
  ...ignored.map((dir) => new RegExp(`^${escapeRegExp(dir)}(?:[/\\\\].*)?$`)),
];

module.exports = config;
