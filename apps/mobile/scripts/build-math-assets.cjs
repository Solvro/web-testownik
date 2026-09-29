// Bundle KaTeX fonts so equations work without network access.
const fs = require("node:fs"),
  path = require("node:path");
const cssPath = require.resolve("katex/dist/katex.min.css");
let css = fs
  .readFileSync(cssPath, "utf8")
  .replace(/src:([^;]+);/g, (whole, sources) => {
    const woff = /url\(([^)]+\.woff2)\)/.exec(sources);
    if (!woff) return whole;
    const data = fs
      .readFileSync(path.join(path.dirname(cssPath), woff[1]))
      .toString("base64");
    return `src:url(data:font/woff2;base64,${data}) format("woff2");`;
  });
fs.writeFileSync("src/lib/math-style.json", JSON.stringify(css));
fs.copyFileSync(
  path.join(path.dirname(require.resolve("katex/package.json")), "LICENSE"),
  "src/lib/KATEX-LICENSE.txt",
);
