import { chromium } from "playwright-core";
import sharp from "sharp";

const baseUrl = process.env.CAPTURE_BASE_URL ?? "http://localhost:3000";
// Keep the still's specular highlights and anti-aliasing identical to the live
// Three.js scene. The production renderer intentionally caps at 1.35× in
// `scene/three/stage.ts`; capturing at 4× made the MacBook's thin metal edges
// look brighter during the loading-cover cross-fade.
const captureDpr = 1.35;
const openPose = process.env.CAPTURE_POSE === "open";
// Decimal byte budget for both poses: <= 60 KB per file. Keep alpha lossless
// and preserve the capture geometry for the live handover. Lossless or
// near-lossless RGB makes the closed covers several times too large.
const webpOptions = {
  alphaQuality: 100,
  effort: 6,
  quality: openPose ? 82 : 90,
  smartSubsample: true,
};
const outputBudget = 60_000;

async function writeWebp(image, output) {
  const { size } = await image.webp(webpOptions).toFile(output);
  if (size > outputBudget) {
    throw new Error(
      `${output} is ${size} bytes (budget ${outputBudget}); review encoding quality before shipping.`,
    );
  }
}
const viewport = { height: 1000, width: 1758 };

const themes = /** @type {const} */ (["light", "dark"]);

// The closed cover is cropped from the whole viewport to the cover's own box
// (see `coverCrop`); the open still is trimmed to its silhouette.
const screenshotClip = openPose
  ? { x: 0, y: 85, width: viewport.width, height: viewport.height - 85 }
  : { x: 0, y: 0, width: viewport.width, height: viewport.height };

const screenshotStyle = `
  nextjs-portal,
  [data-testid*="devtools"],
  .tsqd-open-btn-container,
  button[aria-label*="TanStack" i],
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
  if (openPose) {
    url.searchParams.set("captureProgress", "1");
  }

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
  await page.waitForTimeout(openPose ? 2600 : 900);
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
  const sourceMetadata = await sharp(alphaSource).metadata();
  const sourceStats = await sharp(alphaSource).stats();

  if (!sourceMetadata.hasAlpha || sourceStats.isOpaque) {
    throw new Error(`${theme} source capture does not contain transparency`);
  }

  if (openPose) {
    const transparentStack = await sharp(alphaSource)
      .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
      .png()
      .toBuffer();
    const output = `public/models/testownik-device-stack-open-${theme}-v1.webp`;
    await writeWebp(
      sharp(transparentStack).resize({
        width: 1600,
        height: 1136,
        fit: "inside",
      }),
      output,
    );
    return {
      dpr: effectiveDpr,
      output,
      source: await sharp(transparentStack).metadata(),
    };
  }
  const crop = await coverCrop(page, effectiveDpr, sourceMetadata);
  const coverStill = await sharp(alphaSource).extract(crop).png().toBuffer();
  await assertTransparentBorder(coverStill, theme);
  const output = `public/models/testownik-device-stack-closed-${theme}-v1.webp`;
  await writeWebp(sharp(coverStill), output);

  const metadata = await sharp(output).metadata();
  if (!metadata.hasAlpha) {
    throw new Error(`${output} was written without an alpha channel.`);
  }

  return {
    dpr: effectiveDpr,
    output,
    source: await sharp(coverStill).metadata(),
  };
}

/**
 * `DeviceStack` stretches the cover over the box `laptopScreenRect` solves for
 * the stage, so the still must be exactly that box of the live render: no
 * trim, no resize. The camera distance is bound by the frame's height at every
 * desktop aspect, so the render is the same picture at every viewport, only
 * scaled with that box.
 */
async function coverCrop(page, dpr, sourceMetadata) {
  const box = await page.locator("[data-device-cover]").boundingBox();
  if (box === null) {
    throw new Error("The device cover is not laid out.");
  }
  const left = Math.round(box.x * dpr);
  const top = Math.round(box.y * dpr);
  const crop = {
    left,
    top,
    width: Math.round((box.x + box.width) * dpr) - left,
    height: Math.round((box.y + box.height) * dpr) - top,
  };
  if (
    crop.left < 0 ||
    crop.top < 0 ||
    crop.left + crop.width > sourceMetadata.width ||
    crop.top + crop.height > sourceMetadata.height
  ) {
    throw new Error(
      `The cover box ${JSON.stringify(box)} does not fit the capture viewport.`,
    );
  }
  return crop;
}

/** A silhouette touching the crop's edge would be cut off in the cover. */
async function assertTransparentBorder(image, theme) {
  const { data, info } = await sharp(image)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const alpha = (x, y) => data[(y * info.width + x) * info.channels + 3];
  for (let x = 0; x < info.width; x += 1) {
    if (alpha(x, 0) > 0 || alpha(x, info.height - 1) > 0) {
      throw new Error(`${theme} device stack overflows the cover box.`);
    }
  }
  for (let y = 0; y < info.height; y += 1) {
    if (alpha(0, y) > 0 || alpha(info.width - 1, y) > 0) {
      throw new Error(`${theme} device stack overflows the cover box.`);
    }
  }
}

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
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
