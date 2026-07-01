import { toast } from "sonner";

import { env } from "@/env";
import type { WrappedStoryData } from "@/types/wrapped";

import { personaForHour } from "./derived";
import { wrappedDisplay, wrappedSans } from "./fonts";
import { formatValue } from "./format";
import { createRng, isDark, withAlpha } from "./theme";
import type { DecorationName } from "./wrapped.config";

const WIDTH = 1080;
const HEIGHT = 1920;
const PAD = 96;
const OPENMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/hfg-gmuend/openmoji@15.0.0/color/svg/";
const SUMMER_SHARE_STICKERS = [
  { code: "2600", x: WIDTH - 122, y: 382, size: 152, rotation: 0.08 },
  { code: "1F3D6", x: 106, y: 600, size: 90, rotation: -0.22 },
  { code: "1F366", x: 94, y: 1642, size: 88, rotation: -0.18 },
  { code: "1F33A", x: 128, y: HEIGHT - 112, size: 70, rotation: -0.34 },
  { code: "1F334", x: WIDTH - 108, y: HEIGHT - 124, size: 150, rotation: 0.04 },
] as const;
const SUMMER_SHARE_SPARKLES = [
  { x: 388, y: 612, size: 38, rotation: -0.14 },
  { x: 558, y: 544, size: 32, rotation: 0.08 },
  { x: 828, y: 620, size: 30, rotation: 0.16 },
] as const;

/** Colours the share card is drawn with (matches the current theme). */
export interface ShareTheme {
  bg: string;
  fg: string;
  accent: string;
  danger: string;
  decoration: DecorationName;
  slideIndex: number;
}

interface Tile {
  value: string;
  label: string;
  highlight: boolean;
}

function summaryTiles(data: WrappedStoryData): Tile[] {
  const hours = Math.floor(data.study_time.total_minutes / 60);
  const persona = personaForHour(data.rhythm.peak_hour, {
    isGlobal: data.is_global === true,
  });
  if (data.is_global === true) {
    return [
      {
        value: `${String(hours)} godz`,
        label: "czasu nauki",
        highlight: false,
      },
      {
        value: formatValue(data.volume.total_answers, "int"),
        label: "pytań",
        highlight: true,
      },
      {
        value: `${String(data.accuracy.percent)}%`,
        label: "skuteczność",
        highlight: false,
      },
      {
        value: formatValue(data.volume.sessions, "int"),
        label: "sesji",
        highlight: true,
      },
      {
        value: persona.name,
        label: "rytm semestru",
        highlight: false,
      },
      {
        value: data.top_quizzes[0]?.name ?? "brak danych",
        label: "najdłuższy quiz",
        highlight: true,
      },
    ];
  }

  return [
    { value: `${String(hours)} godz`, label: "czasu nauki", highlight: false },
    {
      value: formatValue(data.volume.total_answers, "int"),
      label: "pytań",
      highlight: true,
    },
    {
      value: `${String(data.accuracy.percent)}%`,
      label: "skuteczność",
      highlight: false,
    },
    {
      value: formatValue(data.volume.sessions, "int"),
      label: "sesji",
      highlight: true,
    },
    {
      value: `top ${String(data.rank.top_percent)}%`,
      label: "najwytrwalszych",
      highlight: false,
    },
    { value: persona.name, label: "Twój typ", highlight: true },
  ];
}

function wrappedPath(data: WrappedStoryData): "/wrapped" | "/wrapped/global" {
  return data.is_global === true ? "/wrapped/global" : "/wrapped";
}

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  baseSize: number,
  family: string,
): void {
  let size = baseSize;
  context.font = `${String(size)}px ${family}`;
  while (context.measureText(text).width > maxWidth && size > 18) {
    size -= 2;
    context.font = `${String(size)}px ${family}`;
  }
  context.fillText(text, x, y);
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

function drawStar(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  alpha: number,
): void {
  context.save();
  context.translate(x, y);
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.beginPath();
  for (let index = 0; index < 8; index++) {
    const radius = index % 2 === 0 ? size : size * 0.34;
    const angle = -Math.PI / 2 + (index * Math.PI) / 4;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle) * radius;
    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }
  context.closePath();
  context.fill();
  context.restore();
}

async function loadCanvasImage(
  source: string,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      resolve(null);
    }, 2500);

    image.crossOrigin = "anonymous";
    image.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve(image);
    });
    image.addEventListener("error", () => {
      window.clearTimeout(timeout);
      resolve(null);
    });
    image.src = source;
  });
}

function drawImageSticker(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  size: number,
  rotation: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.shadowColor = "rgba(0,0,0,.16)";
  context.shadowBlur = 16;
  context.shadowOffsetY = 8;
  context.drawImage(image, -size / 2, -size / 2, size, size);
  context.restore();
}

function drawSummerFallback(
  context: CanvasRenderingContext2D,
  theme: ShareTheme,
): void {
  const outline = "#0b0d12";
  const yellow = isDark(theme.bg) ? theme.accent : "#ffe14d";

  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = outline;
  context.lineWidth = 7;

  // Sun, low left.
  context.save();
  context.translate(170, HEIGHT - 210);
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI * 2) / 12;
    context.beginPath();
    context.moveTo(Math.cos(angle) * 58, Math.sin(angle) * 58);
    context.lineTo(Math.cos(angle) * 86, Math.sin(angle) * 86);
    context.stroke();
  }
  context.fillStyle = yellow;
  context.beginPath();
  context.arc(0, 0, 54, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  // Flower, upper left.
  context.save();
  context.translate(160, 650);
  context.fillStyle = "#ff8fb0";
  for (let index = 0; index < 5; index++) {
    const angle = (index * Math.PI * 2) / 5;
    context.save();
    context.rotate(angle);
    context.beginPath();
    context.ellipse(0, -34, 18, 30, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.restore();
  }
  context.fillStyle = "#ffe14d";
  context.beginPath();
  context.arc(0, 0, 20, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();

  // Drink, low right.
  context.save();
  context.translate(WIDTH - 170, HEIGHT - 315);
  context.rotate(-0.12);
  context.fillStyle = withAlpha("#ffd23f", 0.84);
  context.beginPath();
  context.moveTo(-44, -48);
  context.lineTo(44, -48);
  context.lineTo(24, 58);
  context.lineTo(-24, 58);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(0, 58);
  context.lineTo(0, 106);
  context.moveTo(-42, 106);
  context.lineTo(42, 106);
  context.stroke();
  context.restore();

  context.restore();
}

async function drawSummerShareDecorations(
  context: CanvasRenderingContext2D,
  theme: ShareTheme,
): Promise<void> {
  const images = await Promise.all(
    SUMMER_SHARE_STICKERS.map(async (sticker) => {
      return loadCanvasImage(`${OPENMOJI_BASE}${sticker.code}.svg`);
    }),
  );

  context.save();
  let drewAny = false;
  for (const [index, image] of images.entries()) {
    if (image === null) {
      continue;
    }
    const sticker = SUMMER_SHARE_STICKERS[index];
    drawImageSticker(
      context,
      image,
      sticker.x,
      sticker.y,
      sticker.size,
      sticker.rotation,
    );
    drewAny = true;
  }

  const sparkleImages = await Promise.all(
    SUMMER_SHARE_SPARKLES.map(async () => {
      return loadCanvasImage(`${OPENMOJI_BASE}2728.svg`);
    }),
  );
  for (const [index, image] of sparkleImages.entries()) {
    if (image === null) {
      continue;
    }
    const sparkle = SUMMER_SHARE_SPARKLES[index];
    drawImageSticker(
      context,
      image,
      sparkle.x,
      sparkle.y,
      sparkle.size,
      sparkle.rotation,
    );
    drewAny = true;
  }
  context.restore();

  if (!drewAny) {
    drawSummerFallback(context, theme);
  }
}

async function drawShareDecorations(
  context: CanvasRenderingContext2D,
  theme: ShareTheme,
): Promise<void> {
  if (theme.decoration === "none") {
    return;
  }
  if (theme.decoration === "summer") {
    await drawSummerShareDecorations(context, theme);
    return;
  }

  const rng = createRng(theme.slideIndex * 1297 + 191);
  const colors = [
    theme.accent,
    theme.fg,
    theme.danger,
    "#19d3da",
    "#ffb020",
    "#7b2dff",
  ];

  context.save();

  switch (theme.decoration) {
    case "sparks": {
      for (let index = 0; index < 24; index++) {
        drawStar(
          context,
          rng() * WIDTH,
          rng() * HEIGHT,
          10 + rng() * 22,
          theme.accent,
          0.08 + rng() * 0.16,
        );
      }
      break;
    }
    case "confetti": {
      for (let index = 0; index < 42; index++) {
        context.save();
        context.translate(rng() * WIDTH, rng() * HEIGHT);
        context.rotate(rng() * Math.PI);
        context.globalAlpha = 0.28 + rng() * 0.22;
        context.fillStyle =
          colors[Math.floor(rng() * colors.length)] ?? theme.accent;
        roundRect(context, -7, -16, 14, 32, 3);
        context.fill();
        context.restore();
      }
      break;
    }
    case "lines": {
      context.strokeStyle = withAlpha(theme.fg, 0.18);
      context.lineWidth = 12;
      for (let index = 0; index < 9; index++) {
        context.beginPath();
        context.ellipse(
          rng() < 0.5 ? 80 : WIDTH - 80,
          rng() < 0.5 ? 120 : HEIGHT - 180,
          120 + index * 38,
          72 + index * 24,
          rng() * Math.PI,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }
      for (let index = 0; index < 16; index++) {
        context.fillStyle =
          rng() < 0.42 ? theme.danger : withAlpha(theme.fg, 0.34);
        context.beginPath();
        context.arc(
          WIDTH * (0.62 + rng() * 0.34),
          HEIGHT * (0.72 + rng() * 0.18),
          8 + rng() * 16,
          0,
          Math.PI * 2,
        );
        context.fill();
      }
      break;
    }
    case "wrapped":
    case "blobs": {
      const blobColors =
        theme.decoration === "wrapped"
          ? [theme.danger, theme.accent, "#19d3da", "#7b2dff"]
          : [theme.accent, theme.fg, theme.danger];
      for (let index = 0; index < 5; index++) {
        const x = rng() * WIDTH;
        const y = rng() * HEIGHT;
        const radius = 180 + rng() * 220;
        const color = blobColors[index % blobColors.length] ?? theme.accent;
        const gradient = context.createRadialGradient(x, y, 20, x, y, radius);
        gradient.addColorStop(0, withAlpha(color, 0.18));
        gradient.addColorStop(1, withAlpha(color, 0));
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      break;
    }
  }

  context.restore();
}

/** Render the shareable summary card to a PNG blob, in the given theme. */
export async function generateShareImage(
  data: WrappedStoryData,
  theme: ShareTheme,
): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (context === null) {
    return null;
  }

  const display = wrappedDisplay.style.fontFamily;
  const sans = wrappedSans.style.fontFamily;
  try {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load(`96px ${display}`),
      document.fonts.load(`600 36px ${sans}`),
    ]);
  } catch {
    // proceed with whatever is available
  }

  const { bg, fg, accent } = theme;
  const muted = withAlpha(fg, 0.55);
  const onAccent = isDark(accent) ? "#ffffff" : "#15171c";

  // Background.
  context.fillStyle = bg;
  context.fillRect(0, 0, WIDTH, HEIGHT);
  await drawShareDecorations(context, theme);

  // Header.
  context.textBaseline = "alphabetic";
  context.fillStyle = accent;
  context.font = `700 34px ${sans}`;
  context.fillText(`TESTOWNIK · WRAPPED ${data.season.year_label}`, PAD, 180);

  // Title.
  context.fillStyle = fg;
  context.font = `150px ${display}`;
  context.fillText("TAKI BYŁ", PAD, 360);
  context.fillText(
    data.is_global === true ? "TESTOWNIK" : "MÓJ SEMESTR",
    PAD,
    500,
  );

  // Stats grid (2 cols × 3 rows).
  const gridTop = 660;
  const gap = 26;
  const tileW = (WIDTH - PAD * 2 - gap) / 2;
  const tileH = 300;
  const tiles = summaryTiles(data);
  for (const [index, tile] of tiles.entries()) {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = PAD + col * (tileW + gap);
    const y = gridTop + row * (tileH + gap);

    context.strokeStyle = withAlpha(fg, 0.18);
    context.lineWidth = 2;
    roundRect(context, x, y, tileW, tileH, 28);
    context.stroke();

    context.fillStyle = tile.highlight ? accent : fg;
    fitText(context, tile.value, x + 36, y + 150, tileW - 72, 96, display);

    context.fillStyle = muted;
    context.font = `500 32px ${sans}`;
    context.fillText(tile.label.toUpperCase(), x + 38, y + 210);
  }

  // Footer link pill.
  const host = env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "").replace(
    /\/$/,
    "",
  );
  const link = `${host}${wrappedPath(data)}`;
  context.font = `700 38px ${sans}`;
  const pillW = context.measureText(link).width + 96;
  const pillH = 92;
  const pillX = (WIDTH - pillW) / 2;
  const pillY = HEIGHT - PAD - pillH;
  context.fillStyle = accent;
  roundRect(context, pillX, pillY, pillW, pillH, pillH / 2);
  context.fill();
  context.fillStyle = onAccent;
  context.textAlign = "center";
  context.fillText(link, WIDTH / 2, pillY + 60);
  context.textAlign = "left";

  return new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/png");
    } catch {
      resolve(null);
    }
  });
}

function shareText(data: WrappedStoryData): string {
  const hours = Math.floor(data.study_time.total_minutes / 60);
  if (data.is_global === true) {
    return (
      `Testownik Wrapped: ${String(hours)} godz nauki i ` +
      `${formatValue(data.volume.total_answers, "int")} pytań.`
    );
  }

  return (
    `Mój Testownik Wrapped: ${String(hours)} godz nauki, ` +
    `${formatValue(data.volume.total_answers, "int")} pytań.` +
    `Top ${String(data.rank.top_percent)}%!`
  );
}

/**
 * Share the Wrapped summary. The link is included in the text (not as a
 * separate `url` field) so targets receive the same caption/link payload in
 * both native and fallback flows.
 */
export async function shareWrapped(
  data: WrappedStoryData,
  theme: ShareTheme,
): Promise<void> {
  const url = `${env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}${wrappedPath(data)}`;
  const text = shareText(data);
  const textWithLink = `${text} ${url}`;
  const blob = await generateShareImage(data, theme);

  const nav = navigator as unknown as {
    share?: (data?: ShareData) => Promise<void>;
    canShare?: (data?: ShareData) => boolean;
  };

  if (blob !== null) {
    const file = new File([blob], "testownik-wrapped.png", {
      type: "image/png",
    });
    const shareData: ShareData = {
      files: [file],
      text: textWithLink,
      title: "Testownik Wrapped",
    };
    if (nav.canShare?.(shareData) === true && typeof nav.share === "function") {
      try {
        await nav.share(shareData);
        return;
      } catch {
        // Native share may reject after the target handled/cancelled the file.
        // Do not fall through, or we risk creating a duplicate image/link.
        return;
      }
    }
    downloadBlob(blob, "testownik-wrapped.png");
    void copyLink(textWithLink);
    toast.success("Zapisano obrazek — link do Wrapped skopiowany!");
    return;
  }

  if (typeof nav.share === "function") {
    try {
      await nav.share({ text: textWithLink, title: "Testownik Wrapped" });
      return;
    } catch {
      // fall through
    }
  }
  void copyLink(textWithLink);
  toast.success("Link do Wrapped skopiowany!");
}

function downloadBlob(blob: Blob, filename: string): void {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

async function copyLink(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // clipboard unavailable — best effort
  }
}
