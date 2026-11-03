type Context = WebGLRenderingContext | WebGL2RenderingContext;

export interface LinkedProgram {
  program: WebGLProgram;
  vertexShader: WebGLShader;
  fragmentShader: WebGLShader;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

function compileShader(
  gl: Context,
  type: number,
  source: string,
  label: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (shader === null) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) !== true) {
    console.error(`${label} shader error:`, gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/**
 * Compiles and links a program, collecting its active uniforms. Returns null
 * after releasing every partial object when any step fails, so the caller can
 * fall back instead of drawing nothing.
 */
export function createProgram(
  gl: Context,
  vertexSource: string,
  fragmentSource: string,
  label: string,
): LinkedProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource, label);
  if (vertexShader === null) {
    return null;
  }
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentSource,
    label,
  );
  if (fragmentShader === null) {
    gl.deleteShader(vertexShader);
    return null;
  }
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) {
    console.error(`${label} program error:`, gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    return null;
  }

  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);
    const location =
      info === null ? null : gl.getUniformLocation(program, info.name);
    if (info !== null && location !== null) {
      uniforms[info.name] = location;
    }
  }
  return { program, vertexShader, fragmentShader, uniforms };
}

export function deleteProgram(gl: Context, linked: LinkedProgram): void {
  gl.deleteProgram(linked.program);
  gl.deleteShader(linked.vertexShader);
  gl.deleteShader(linked.fragmentShader);
}

/** A 1x1 transparent texture, clamped and linearly filtered. */
export function createContentTexture(
  gl: WebGL2RenderingContext,
  mipmaps: boolean,
): WebGLTexture {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    1,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    new Uint8Array([0, 0, 0, 0]),
  );
  if (mipmaps) {
    gl.generateMipmap(gl.TEXTURE_2D);
  }
  return texture;
}

/** A clip-space quad bound to attribute 0, drawn as a triangle strip. */
export function createFullscreenQuad(gl: WebGL2RenderingContext): WebGLBuffer {
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  return quad;
}

/**
 * Calls `onLost` when the browser drops the context. The effects then hand
 * over to their DOM fallback for good, so there is no restore handler.
 */
export function watchContextLoss(
  canvas: HTMLCanvasElement,
  onLost: () => void,
): () => void {
  const handleLost = (event: Event): void => {
    event.preventDefault();
    onLost();
  };
  canvas.addEventListener("webglcontextlost", handleLost);
  return () => {
    canvas.removeEventListener("webglcontextlost", handleLost);
  };
}

/** The device pixel ratio, capped at 2 to bound fill cost. */
export function cappedDevicePixelRatio(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

const canvasDimensionLimits = new WeakMap<Context, number>();

/** Keep the existing DPR budget, then account for browser pinch zoom. */
export function getCanvasPixelRatio(
  element: HTMLElement,
  context?: Context,
): number {
  const scale = window.visualViewport?.scale ?? 1;
  const requested = cappedDevicePixelRatio() * (scale || 1);
  const width = Math.max(element.clientWidth, 1);
  const height = Math.max(element.clientHeight, 1);
  let maxDimension = 8192;
  if (context !== undefined) {
    let limit = canvasDimensionLimits.get(context);
    if (limit === undefined) {
      limit = Math.min(
        maxDimension,
        context.getParameter(context.MAX_TEXTURE_SIZE) as number,
        context.getParameter(context.MAX_RENDERBUFFER_SIZE) as number,
      );
      canvasDimensionLimits.set(context, limit);
    }
    maxDimension = limit;
  }
  // Rendering the full element preserves its CSS position and native input
  // geometry while panning. Bound allocations when zooming large canvases.
  return Math.min(
    requested,
    maxDimension / Math.max(width, height),
    Math.sqrt(16_777_216 / (width * height)),
  );
}

/** Size `canvas`'s backing store to `element`'s CSS box times `ratio`. */
export function syncCanvasBackingSize(
  canvas: HTMLCanvasElement,
  element: HTMLElement,
  ratio: number,
): void {
  const width = Math.max(1, Math.round(element.clientWidth * ratio));
  const height = Math.max(1, Math.round(element.clientHeight * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

/** The share of the output's width the captured content covers. */
export function contentWidthRatio(
  content: HTMLElement,
  output: HTMLElement,
): number {
  return Math.min(
    1,
    Math.max(0.05, content.clientWidth / Math.max(output.clientWidth, 1)),
  );
}

/** Pinch zoom changes visualViewport without resizing the element's CSS box. */
export function createCanvasResizeObserver(onResize: () => void) {
  const viewport = window.visualViewport;
  let frame = 0;
  let disconnected = false;
  const schedule = (): void => {
    if (frame !== 0 || disconnected) {
      return;
    }
    frame = requestAnimationFrame(() => {
      frame = 0;
      onResize();
    });
  };
  const observer = new ResizeObserver(schedule);
  window.addEventListener("resize", schedule, { passive: true });
  viewport?.addEventListener("resize", schedule, { passive: true });
  return {
    observe(element: Element, options?: ResizeObserverOptions) {
      observer.observe(element, options);
    },
    unobserve(element: Element) {
      observer.unobserve(element);
    },
    disconnect() {
      disconnected = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      viewport?.removeEventListener("resize", schedule);
    },
  };
}

/** The element's viewport rect, refreshed on resize and scroll only. */
export function createRectCache(element: Element) {
  let current = element.getBoundingClientRect();

  const refresh = (): void => {
    current = element.getBoundingClientRect();
  };

  const observer = new ResizeObserver(refresh);
  observer.observe(element);
  window.addEventListener("resize", refresh, { passive: true });
  window.addEventListener("scroll", refresh, {
    capture: true,
    passive: true,
  });

  return {
    get current() {
      return current;
    },
    destroy() {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
    },
  };
}
