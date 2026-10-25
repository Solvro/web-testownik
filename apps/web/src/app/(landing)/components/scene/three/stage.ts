import {
  ACESFilmicToneMapping,
  DirectionalLight,
  HemisphereLight,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from "three";
import { CSS3DRenderer } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import { CAMERA_FOV } from "../laptop-framing";
import {
  CONTEXT_RESTORE_MS,
  nextWebGLAvailability,
  tryWebGLContext,
} from "./webgl-availability";
import type { WebGLAvailability } from "./webgl-availability";

/** Above this the extra pixels cost more than they show on a 3D product shot. */
const MAX_PIXEL_RATIO = 1.35;

export interface Stage {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  cssRenderer: CSS3DRenderer;
  setSize: (width: number, height: number) => void;
  render: () => void;
  isAvailable: () => boolean;
  dispose: () => void;
}

/**
 * The WebGL scene and the CSS3D layer that renders the live UI, driven by one
 * shared camera. The DOM screens are real objects in this scene graph rather
 * than flat overlays, which is what makes them inherit the hinge rotation and
 * the perspective for free.
 */
export function createStage({
  canvas,
  container,
  pixelRatio,
  screenLayerClassName,
  onUnavailable,
  onRestored,
  onLost,
}: {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  /** Forced device pixel ratio, used by the capture harness. */
  pixelRatio?: number;
  screenLayerClassName: string;
  onUnavailable: () => void;
  onRestored: () => void;
  onLost: () => void;
}): Stage | null {
  // Three.js logs errors before throwing when it cannot create a context.
  // Acquire it ourselves and pass the same context and attributes through.
  const attributes: WebGLContextAttributes = {
    alpha: true,
    antialias: true,
    depth: true,
    stencil: false,
    premultipliedAlpha: true,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false,
  };
  const context = tryWebGLContext(() =>
    canvas.getContext("webgl2", attributes),
  );
  if (context === null) {
    return null;
  }

  const scene = new Scene();
  const camera = new PerspectiveCamera(CAMERA_FOV, 1, 0.1, 400);
  // Both renderers would otherwise walk the whole scene graph again on every
  // render. The choreography updates its world matrices once per frame.
  scene.matrixWorldAutoUpdate = false;

  const renderer = new WebGLRenderer({
    canvas,
    context,
    ...attributes,
  });
  renderer.setClearColor(0x00_00_00, 0);
  renderer.setPixelRatio(
    pixelRatio ?? Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO),
  );
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;

  const cssRenderer = new CSS3DRenderer();
  cssRenderer.domElement.className = screenLayerClassName;
  container.append(cssRenderer.domElement);

  scene.add(new HemisphereLight(0xf4_f7_ff, 0x10_13_1a, 1.9));

  const keyLight = new DirectionalLight(0xff_ff_ff, 2.1);
  keyLight.position.set(-18, 34, 28);
  scene.add(keyLight);

  const rimLight = new DirectionalLight(0x7b_a3_ff, 1.4);
  rimLight.position.set(24, 14, -22);
  scene.add(rimLight);

  let availability: WebGLAvailability = "available";
  let disposed = false;
  let restoreTimer: ReturnType<typeof setTimeout> | undefined;
  const onContextLost = (event: Event): void => {
    event.preventDefault();
    availability = nextWebGLAvailability(availability, "lost");
    cssRenderer.domElement.style.visibility = "hidden";
    onLost();
    clearTimeout(restoreTimer);
    restoreTimer = setTimeout(() => {
      availability = nextWebGLAvailability(availability, "timeout");
      if (availability === "expired") {
        onUnavailable();
      }
    }, CONTEXT_RESTORE_MS);
  };
  const onContextRestored = (): void => {
    clearTimeout(restoreTimer);
    availability = nextWebGLAvailability(availability, "restored");
    if (availability === "available") {
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
      cssRenderer.domElement.style.visibility = "";
      onRestored();
    }
  };
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  return {
    scene,
    camera,
    renderer,
    cssRenderer,
    setSize(width, height) {
      renderer.setSize(width, height, false);
      cssRenderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    isAvailable: () => availability === "available",
    render() {
      if (availability !== "available") {
        return;
      }
      renderer.render(scene, camera);
      cssRenderer.render(scene, camera);
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      clearTimeout(restoreTimer);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      renderer.dispose();
      cssRenderer.domElement.remove();
    },
  };
}
