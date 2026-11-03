"use client";

// Adapted from https://canvasui.dev/docs/components/peel (reverse hover and focus).
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import {
  createHtmlInCanvasCapture,
  supportsHtmlInCanvas,
  useClientCapability,
} from "./runtime/html-in-canvas";
import {
  contentWidthRatio,
  createCanvasResizeObserver,
  createContentTexture,
  createProgram,
  createRectCache,
  deleteProgram,
  getCanvasPixelRatio,
  syncCanvasBackingSize,
  watchContextLoss,
} from "./runtime/webgl";

export type PeelSide = "left" | "right" | "top" | "bottom";

export type PeelMode = "cursor" | "hover";

export interface PeelOptions {
  /** Rest curled; flatten while hovered or focused. */
  reverse?: boolean;
  /** Concentrate the bottom peel at the right corner. */
  corner?: boolean;
  /** Edge the content peels from. */
  side?: PeelSide;
  /** How the peel is driven. "cursor" peels progressively as the pointer nears the edge, "hover" peels fully when the pointer enters the zone. */
  mode?: PeelMode;
  /** How many CSS pixels of the under layer are exposed at full peel. */
  reveal?: number;
  /** Width of the strip along the chosen edge that drives the peel, in CSS pixels. */
  zone?: number;
  /** Radius of the curl in CSS pixels. Smaller values fold sharper. */
  curl?: number;
  /** Extra lift at the middle of the peeling edge in CSS pixels. Negative values bow the sheet inwards. */
  bow?: number;
  /** Strength of the curl shading on the lifted sheet (0 to 1). */
  shade?: number;
  /** Strength of the shine along the peeling edge that follows the cursor (0 to 1). */
  shine?: number;
  /** Distance from the edge at which the shine starts to appear, in CSS pixels. 0 uses the full container span. */
  shineDistance?: number;
  /** Shine color as RGB in the 0 to 1 range, or "auto" to follow the page theme: light shine on dark backgrounds, dark shine on light ones. Re-resolves on theme changes. */
  shineColor?: [number, number, number] | "auto";
  /** How many CSS pixels the peeled edge bulges toward the cursor. */
  bulge?: number;
  /** Perspective focal length in CSS pixels. Lower values exaggerate the 3D depth. */
  perspective?: number;
  /** Seconds the peel takes to settle. Higher feels more damped. */
  smoothing?: number;
}

export interface PeelElements {
  /** Canvas with layoutsubtree that hosts the HTML content. */
  source: HTMLCanvasElement;
  /** The element inside the source canvas that gets captured. */
  content: HTMLElement;
  /** Canvas the WebGL effect renders to. */
  output: HTMLCanvasElement;
  /** Element revealed underneath the peel. Kept hidden until the first capture is ready. */
  under?: HTMLElement;
  /** Called once if the browser drops the WebGL context; rendering stops. */
  onContextLost?: () => void;
}

export interface PeelInstance {
  /** Update effect options live. */
  setOptions: (options: PeelOptions) => void;
  /** Re-read canvas size. Call when the element is resized. */
  resize: () => void;
  /** Stop the loop and release all GPU resources. */
  destroy: () => void;
}

const DEFAULTS: Required<PeelOptions> = {
  reverse: false,
  corner: false,
  side: "left",
  mode: "cursor",
  reveal: 250,
  zone: 200,
  curl: 300,
  bow: 75,
  shade: 0.25,
  shine: 1,
  shineDistance: 1200,
  shineColor: "auto",
  bulge: 50,
  perspective: 2000,
  smoothing: 0.3,
};

const SIDE_INDEX: Record<PeelSide, number> = {
  left: 0,
  right: 1,
  top: 2,
  bottom: 3,
};

const SHEET_VERT = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aGrid;
uniform vec2 uRes;
uniform float uSide;
uniform float uPeel;
uniform float uCorner;
uniform float uReveal;
uniform float uCurl;
uniform float uBow;
uniform float uFocal;
uniform float uZone;
uniform float uBulge;
uniform vec2 uPointer;
out vec2 vUv;
out float vShade;
out vec2 vSide;

const float PI = 3.1415926;

void main () {
  vUv = aGrid;
  vec2 p = aGrid * uRes;
  float crossLen = (uSide < 1.5) ? uRes.y : uRes.x;
  float u; float v;
  if (uSide < 0.5) { u = p.x; v = p.y; }
  else if (uSide < 1.5) { u = uRes.x - p.x; v = p.y; }
  else if (uSide < 2.5) { u = p.y; v = p.x; }
  else { u = uRes.y - p.y; v = p.x; }

  float corner = mix(1.0, smoothstep(0.15, 1.0, v / max(crossLen, 1.0)), uCorner);
  float A = clamp(uPeel, 0.0, 1.0) * corner;
  float f = A * uReveal;
  float R = max(uCurl * A, 0.001);
  float c0 = f + R;

  float dvB = (uPointer.y - v) / max(crossLen * 0.28, 1.0);
  float prox = clamp(1.0 - uPointer.x / max(c0 + uZone, 1.0), 0.0, 1.0);
  float c = c0 + uBulge * A * prox * prox * exp(-dvB * dvB);

  float x = u;
  float z = 0.0;
  float sh = 0.0;
  if (A > 0.001 && u < c) {
    float theta = (c - u) / R;
    if (theta <= PI) {
      x = c - R * sin(theta);
      z = R * (1.0 - cos(theta));
    } else {
      x = c + (theta - PI) * R;
      z = 2.0 * R;
    }
    sh = sin(clamp(theta, 0.0, PI));
  }
  z += uBow * A * sin(PI * v / max(crossLen, 1.0)) * clamp(z / max(R, 1.0), 0.0, 1.5);
  z = clamp(z, -uFocal * 0.2, uFocal * 0.45);
  vShade = sh * smoothstep(0.0, 0.08, A);
  vSide = vec2(u, v);

  vec2 q;
  if (uSide < 0.5) q = vec2(x, v);
  else if (uSide < 1.5) q = vec2(uRes.x - x, v);
  else if (uSide < 2.5) q = vec2(v, x);
  else q = vec2(v, uRes.y - x);

  vec2 ndc = (q / uRes) * 2.0 - 1.0;
  ndc.y = -ndc.y;
  float w = (uFocal - z) / uFocal;
  gl_Position = vec4(ndc, -z / uFocal, w);
}`;

const SHEET_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
in float vShade;
in vec2 vSide;
out vec4 outColor;
uniform sampler2D uContent;
uniform float uShade;
uniform float uMaxX;
uniform float uShine;
uniform vec3 uShineColor;
uniform float uCross;
uniform float uSpan;
uniform vec2 uPointer;

void main () {
  vec2 uv = clamp(vUv, vec2(0.001), vec2(uMaxX - 0.001, 0.999));
  vec4 tex = texture(uContent, uv);
  float sh = 1.0 - clamp(uShade, 0.0, 1.0) * 0.7 * pow(max(vShade, 0.0), 1.3);
  float du = max(vSide.x, 0.0);
  float line = exp(-du / 2.5) + exp(-du / 18.0) * 0.25;
  float dv = (vSide.y - uPointer.y) / max(uCross * 0.45, 1.0);
  float prox = clamp(1.0 - uPointer.x / max(uSpan, 1.0), 0.0, 1.0);
  float shine = uShine * line * exp(-dv * dv) * prox * prox;
  vec3 rgb = mix(tex.rgb * sh, uShineColor, clamp(shine, 0.0, 1.0));
  outColor = vec4(rgb * tex.a, tex.a);
}`;

const SEG = 96;

/**
 * The peel needs html-in-canvas and a hovering pointer, and is pure motion, so
 * it also stays off when reduced motion is requested.
 */
export function supportsPeel(): boolean {
  return (
    supportsHtmlInCanvas() &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createPeel(
  elements: PeelElements,
  options: PeelOptions = {},
): PeelInstance | null {
  const config = { ...DEFAULTS, ...options };
  const { source, content, output, under, onContextLost } = elements;

  const context = output.getContext("webgl2", {
    alpha: true,
    depth: true,
    stencil: false,
    antialias: true,
    premultipliedAlpha: true,
  });
  if (context === null || context.isContextLost()) {
    return null;
  }
  const gl = context;

  const linked = createProgram(gl, SHEET_VERT, SHEET_FRAG, "Peel");
  if (linked === null) {
    return null;
  }
  const sheet = linked;

  const capture = createHtmlInCanvasCapture(source, content);

  let wake = () => {};
  let lost = false;

  const gridVerts = new Float32Array((SEG + 1) * (SEG + 1) * 2);
  for (let y = 0; y <= SEG; y++) {
    for (let x = 0; x <= SEG; x++) {
      const i = (y * (SEG + 1) + x) * 2;
      gridVerts[i] = x / SEG;
      gridVerts[i + 1] = y / SEG;
    }
  }
  const gridIndices = new Uint32Array(SEG * SEG * 6);
  let offset = 0;
  for (let y = 0; y < SEG; y++) {
    for (let x = 0; x < SEG; x++) {
      const a = y * (SEG + 1) + x;
      const b = a + 1;
      const c = a + SEG + 1;
      const d = c + 1;
      gridIndices[offset++] = a;
      gridIndices[offset++] = c;
      gridIndices[offset++] = b;
      gridIndices[offset++] = b;
      gridIndices[offset++] = c;
      gridIndices[offset++] = d;
    }
  }

  const sheetVao = gl.createVertexArray();
  gl.bindVertexArray(sheetVao);
  const gridBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, gridVerts, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, gridIndices, gl.STATIC_DRAW);
  gl.bindVertexArray(null);

  const contentTexture = createContentTexture(gl, false);

  let contentMaxX = 1;
  let hasTexture = false;

  if (under && capture) under.style.visibility = "hidden";

  capture?.setOnPaint(() => {
    if (lost) return;
    try {
      capture.reset();
      capture.draw();
      gl.bindTexture(gl.TEXTURE_2D, contentTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
      capture.reset();
      hasTexture = true;
      wake();
    } catch {}
  });

  function syncCanvasSize() {
    const dpr = getCanvasPixelRatio(output, gl);
    syncCanvasBackingSize(output, output, dpr);
    contentMaxX = contentWidthRatio(content, output);
    if (capture) {
      syncCanvasBackingSize(source, source, dpr);
      capture.requestPaint();
    }
  }

  const peel = { a: config.reverse ? 1 : 0, target: config.reverse ? 1 : 0 };
  const FAR = 1e4;
  const pointer = { u: FAR, v: 0, su: FAR, sv: 0 };

  let shineRgb: [number, number, number] = [1, 1, 1];
  const probe = document.createElement("canvas");
  probe.width = probe.height = 1;
  const probeCtx = probe.getContext("2d", { willReadFrequently: true });

  function syncShineColor() {
    if (config.shineColor !== "auto") {
      shineRgb = config.shineColor;
      return;
    }
    let luminance = 1;
    if (probeCtx) {
      let el: Element | null = content;
      while (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== "transparent") {
          probeCtx.clearRect(0, 0, 1, 1);
          probeCtx.fillStyle = bg;
          probeCtx.fillRect(0, 0, 1, 1);
          const [r, g, b, a] = probeCtx.getImageData(0, 0, 1, 1).data;
          if (a > 0) {
            luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
            break;
          }
        }
        el = el.parentElement;
      }
    }
    shineRgb = luminance > 0.5 ? [0, 0, 0] : [1, 1, 1];
  }

  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reducedMotion = motionQuery.matches;

  syncCanvasSize();
  syncShineColor();

  function render() {
    if (under && hasTexture && under.style.visibility === "hidden") {
      under.style.visibility = "";
    }
    const w = Math.max(output.clientWidth, 1);
    const h = Math.max(output.clientHeight, 1);
    const side = SIDE_INDEX[config.side] ?? 0;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, output.width, output.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(sheet.program);
    gl.bindVertexArray(sheetVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, contentTexture);
    gl.uniform1i(sheet.uniforms.uContent, 0);
    gl.uniform2f(sheet.uniforms.uRes, w, h);
    gl.uniform1f(sheet.uniforms.uSide, side);
    gl.uniform1f(sheet.uniforms.uPeel, peel.a);
    gl.uniform1f(sheet.uniforms.uCorner, config.corner ? 1 : 0);
    gl.uniform1f(sheet.uniforms.uReveal, Math.max(config.reveal, 0));
    gl.uniform1f(sheet.uniforms.uCurl, Math.max(config.curl, 1));
    gl.uniform1f(sheet.uniforms.uBow, config.bow);
    gl.uniform1f(sheet.uniforms.uFocal, Math.max(config.perspective, 200));
    gl.uniform1f(sheet.uniforms.uShade, config.shade);
    gl.uniform1f(sheet.uniforms.uZone, Math.max(config.zone, 1));
    gl.uniform1f(sheet.uniforms.uBulge, Math.max(config.bulge, 0));
    gl.uniform1f(sheet.uniforms.uShine, Math.max(config.shine, 0));
    gl.uniform3f(
      sheet.uniforms.uShineColor,
      shineRgb[0],
      shineRgb[1],
      shineRgb[2],
    );
    gl.uniform1f(sheet.uniforms.uCross, side < 1.5 ? h : w);
    gl.uniform1f(
      sheet.uniforms.uSpan,
      config.shineDistance > 0 ? config.shineDistance : side < 1.5 ? w : h,
    );
    gl.uniform2f(sheet.uniforms.uPointer, pointer.su, pointer.sv);
    gl.uniform1f(sheet.uniforms.uMaxX, contentMaxX);
    gl.drawElements(gl.TRIANGLES, gridIndices.length, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  }

  function syncContentEvents() {
    const A = peel.a;
    const R = Math.max(config.curl * A, 0.001);
    const c = A * config.reveal + R + Math.max(config.bulge, 0) * A;
    const tailEnd = Math.max(c, 2 * c - Math.PI * R);
    const blocked = A > 0.02 && pointer.u < tailEnd;
    const next = blocked ? "none" : "auto";
    if (content.style.pointerEvents !== next) {
      content.style.pointerEvents = next;
    }
  }

  const listenTarget = output.parentElement ?? output;

  let raf = 0;
  let lastTime = performance.now();
  let destroyed = false;
  let running = false;
  let visible = true;

  function updateTarget() {
    if (config.reverse) {
      peel.target =
        pointer.u < FAR || listenTarget.matches(":focus-within") ? 0 : 1;
      return;
    }
    if (config.mode === "hover") {
      const open = peel.target > 0.5;
      const limit = open ? peel.a * config.reveal + config.zone : config.zone;
      peel.target = pointer.u < limit ? 1 : 0;
      return;
    }
    const span = Math.max(config.zone + peel.a * config.reveal, 1);
    peel.target = Math.min(1, Math.max(0, 1 - pointer.u / span));
  }

  function frame(now: number) {
    if (destroyed) return;
    if (!visible) {
      running = false;
      return;
    }
    const delta = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    const tau = Math.max(config.smoothing, 1e-4);
    const k = reducedMotion ? 1 : 1 - Math.exp(-delta / tau);
    const kp = reducedMotion ? 1 : 1 - Math.exp(-delta / (tau * 0.45));
    pointer.su += (pointer.u - pointer.su) * kp;
    pointer.sv += (pointer.v - pointer.sv) * kp;
    updateTarget();
    peel.a += (peel.target - peel.a) * k;
    syncContentEvents();
    render();
    const settle = 0.5 / Math.max(config.reveal + config.curl, 1);
    if (
      Math.abs(peel.target - peel.a) < settle &&
      Math.abs(pointer.u - pointer.su) < 0.5 &&
      Math.abs(pointer.v - pointer.sv) < 0.5
    ) {
      peel.a = peel.target;
      pointer.su = pointer.u;
      pointer.sv = pointer.v;
      running = false;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || lost || running || !visible) return;
    running = true;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }

  wake = start;
  start();

  const stopWatchingContext = watchContextLoss(output, () => {
    lost = true;
    running = false;
    cancelAnimationFrame(raf);
    onContextLost?.();
  });

  function onMotionChange() {
    reducedMotion = motionQuery.matches;
    start();
  }
  motionQuery.addEventListener("change", onMotionChange);

  let themeTimer = 0;
  function onThemeShift() {
    syncShineColor();
    start();
    window.clearTimeout(themeTimer);
    themeTimer = window.setTimeout(() => {
      syncShineColor();
      start();
    }, 300);
  }

  const themeObserver = new MutationObserver(onThemeShift);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme"],
  });
  const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
  schemeQuery.addEventListener("change", onThemeShift);

  const observer = createCanvasResizeObserver(() => {
    syncCanvasSize();
    start();
  });
  observer.observe(output);
  observer.observe(content);

  const intersection = new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1]?.isIntersecting ?? true;
    if (visible) start();
  });
  intersection.observe(output);

  function sideDistance(x: number, y: number, rect: DOMRect): number {
    if (config.side === "right") return rect.width - x;
    if (config.side === "top") return y;
    if (config.side === "bottom") return rect.height - y;
    return x;
  }

  const rectCache = createRectCache(output);

  function onPointerMove(event: PointerEvent) {
    if (!capture) return;
    const rect = rectCache.current;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointer.u = sideDistance(x, y, rect);
    pointer.v = config.side === "top" || config.side === "bottom" ? x : y;
    updateTarget();
    start();
  }

  function onPointerLeave() {
    pointer.u = FAR;
    updateTarget();
    start();
  }

  function onFocusChange() {
    updateTarget();
    start();
  }

  listenTarget.addEventListener("focusin", onFocusChange);
  listenTarget.addEventListener("focusout", onFocusChange);
  listenTarget.addEventListener("pointerenter", onPointerMove, {
    passive: true,
  });
  listenTarget.addEventListener("pointermove", onPointerMove, {
    passive: true,
  });
  listenTarget.addEventListener("pointerleave", onPointerLeave, {
    passive: true,
  });

  return {
    setOptions(next) {
      if (
        !Object.entries(next).some(
          ([key, value]) => config[key as keyof PeelOptions] !== value,
        )
      )
        return;
      Object.assign(config, next);
      syncShineColor();
      start();
    },
    resize() {
      syncCanvasSize();
      start();
    },
    destroy() {
      destroyed = true;
      rectCache.destroy();
      cancelAnimationFrame(raf);
      stopWatchingContext();
      observer.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      schemeQuery.removeEventListener("change", onThemeShift);
      window.clearTimeout(themeTimer);
      motionQuery.removeEventListener("change", onMotionChange);
      listenTarget.removeEventListener("focusin", onFocusChange);
      listenTarget.removeEventListener("focusout", onFocusChange);
      listenTarget.removeEventListener("pointerenter", onPointerMove);
      listenTarget.removeEventListener("pointermove", onPointerMove);
      listenTarget.removeEventListener("pointerleave", onPointerLeave);
      content.style.pointerEvents = "";
      if (under) under.style.visibility = "";
      gl.deleteTexture(contentTexture);
      deleteProgram(gl, sheet);
      gl.deleteBuffer(gridBuffer);
      gl.deleteBuffer(indexBuffer);
      gl.deleteVertexArray(sheetVao);
      capture?.setOnPaint(null);
    },
  };
}

export interface PeelProps extends PeelOptions {
  /** The content that peels away. */
  children: ReactNode;
  /** Native HTML above the sheet, excluded from canvas capture. */
  overlay?: ReactNode;
  /** The content revealed underneath the peel. */
  under?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Peel({
  children,
  overlay,
  under,
  className,
  style,
  ...options
}: PeelProps) {
  const sourceRef = useRef<HTMLCanvasElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLCanvasElement>(null);
  const underRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PeelInstance | null>(null);
  const [initialOptions] = useState(options);
  const [failed, setFailed] = useState(false);

  const supported = useClientCapability(supportsPeel);
  const native = supported && !failed;

  useEffect(() => {
    const source = sourceRef.current;
    const content = contentRef.current;
    const output = outputRef.current;
    // The fallback is plain DOM: no context, shaders or listeners.
    if (!native || !source || !content || !output) return;
    let active = true;
    // A failed or lost context is final.
    const fail = () => {
      if (active) setFailed(true);
    };
    instanceRef.current = createPeel(
      {
        source,
        content,
        output,
        under: underRef.current ?? undefined,
        onContextLost: fail,
      },
      initialOptions,
    );
    if (!instanceRef.current) fail();
    return () => {
      active = false;
      instanceRef.current?.destroy();
      instanceRef.current = null;
    };
  }, [initialOptions, native]);

  useEffect(() => {
    instanceRef.current?.setOptions(options);
  });

  return (
    <div
      className={className}
      data-peel-native={native}
      style={{ position: "relative", ...style }}
    >
      {native ? (
        <div
          ref={underRef}
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            visibility: "hidden",
          }}
        >
          {under}
        </div>
      ) : null}
      <canvas
        ref={sourceRef}
        // @ts-expect-error experimental html-in-canvas attribute
        layoutsubtree="true"
        suppressHydrationWarning
        style={
          native
            ? {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
              }
            : { display: "none" }
        }
      >
        {native ? (
          <div
            ref={contentRef}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              overflow: "hidden",
              pointerEvents: "auto",
            }}
          >
            {children}
          </div>
        ) : null}
      </canvas>
      {!native ? (
        <div
          ref={contentRef}
          style={{
            position: overlay ? "absolute" : "relative",
            inset: overlay ? 0 : undefined,
            width: "100%",
            height: "100%",
            overflow: "hidden",
          }}
        >
          {children}
        </div>
      ) : null}
      <canvas
        ref={outputRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
      {overlay}
    </div>
  );
}

export default Peel;
