import { chromium } from "playwright-core";
import sharp from "sharp";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
// Keep the still's specular highlights and anti-aliasing identical to the live
// Three.js scene. The production renderer intentionally caps at 1.35× in
// `scene/three/stage.ts`; capturing at 4× made the MacBook's thin metal edges
// look brighter during the loading-cover cross-fade.
const captureDpr = 1.35;
const viewport = { height: 1000, width: 1758 };
const referenceDpr = 4;
const outputScale = captureDpr / referenceDpr;
const outputCanvas = {
  height: Math.round(2068 * outputScale),
  width: Math.round(2914 * outputScale),
};
const outputPlacement = {
  height: Math.round(1432 * outputScale),
  left: Math.round(52 * outputScale),
  top: Math.round(346 * outputScale),
  width: Math.round(2686 * outputScale),
};

const themes = /** @type {const} */ (["light", "dark"]);

const screenshotClip = {
  height: 830,
  width: viewport.width - 320,
  x: 160,
  y: 120,
};

const screenshotStyle = `
  nextjs-portal,
  [data-testid*="devtools"],
  button[aria-label*="TanStack"],
  button[aria-label*="Next.js"] {
    display: none !important;
  }
`;

async function captureTransparentStack(page) {
  return page.screenshot({
    animations: "disabled",
    clip: screenshotClip,
    omitBackground: true,
    scale: "device",
    style: screenshotStyle,
    type: "png",
  });
}

async function captureTheme(page, theme) {
  const url = new URL(baseUrl);
  url.searchParams.set("landing", "true");
  url.searchParams.set("capture", "devices");
  url.searchParams.set("captureScale", String(captureDpr));
  url.searchParams.set("captureTheme", theme);

  await page.goto(url.href, {
    timeout: 120_000,
    waitUntil: "domcontentloaded",
  });
  await page.locator('[data-model-ready="true"]').waitFor({
    state: "attached",
    timeout: 120_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  // Let the loading cover finish fading and give both renderers two complete
  // frames at their final closed pose.
  await page.waitForTimeout(900);
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );

  const renderMetrics = await page
    .locator('[data-model-ready="true"] > canvas')
    .evaluate((canvas) => ({
      cssHeight: canvas.clientHeight,
      cssWidth: canvas.clientWidth,
      pixelHeight: canvas.height,
      pixelWidth: canvas.width,
    }));
  const effectiveDpr = renderMetrics.pixelWidth / renderMetrics.cssWidth;
  if (effectiveDpr < captureDpr - 0.05) {
    throw new Error(
      `Three.js rendered at ${effectiveDpr.toFixed(2)}× instead of ${captureDpr}×.`,
    );
  }

  const alphaSource = await captureTransparentStack(page);
  const screenshot = alphaSource;
  const sourceMetadata = await sharp(alphaSource).metadata();
  const sourceStats = await sharp(alphaSource).stats();

  if (!sourceMetadata.hasAlpha || sourceStats.isOpaque) {
    throw new Error(`${theme} source capture does not contain transparency`);
  }

  const transparentStack = await sharp(screenshot)
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
    .png()
    .toBuffer();
  const fittedStack = await sharp(transparentStack)
    .resize({
      fit: "fill",
      height: outputPlacement.height,
      width: outputPlacement.width,
    })
    .png()
    .toBuffer();
  const output = `public/models/testownik-device-stack-cover-${theme}-v8.webp`;

  await sharp({
    create: {
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
      height: outputCanvas.height,
      width: outputCanvas.width,
    },
  })
    .composite([
      {
        input: fittedStack,
        left: outputPlacement.left,
        top: outputPlacement.top,
      },
    ])
    .webp({ effort: 6, lossless: true })
    .toFile(output);

  const metadata = await sharp(output).metadata();
  if (!metadata.hasAlpha) {
    throw new Error(`${output} was written without an alpha channel.`);
  }

  return {
    dpr: effectiveDpr,
    output,
    source: await sharp(transparentStack).metadata(),
  };
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
});

try {
  const context = await browser.newContext({
    colorScheme: "light",
    deviceScaleFactor: captureDpr,
    viewport,
  });
  const page = await context.newPage();

  for (const theme of themes) {
    const result = await captureTheme(page, theme);
    console.log(
      `${theme}: ${result.output} · ${result.source.width}×${result.source.height} source · ${result.dpr.toFixed(2)}× DPR`,
    );
  }

  await context.close();
} finally {
  await browser.close();
}
