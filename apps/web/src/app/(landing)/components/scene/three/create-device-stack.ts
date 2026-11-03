import { Group, MathUtils, Object3D, Vector3 } from "three";
import type { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import {
  HERO_PROGRESS_EVENT,
  getHeroProgress,
  setHeroProgressOverride,
} from "../../hero-progress";
import type { ScreenDevice } from "../screen-frame-protocol";
import { createChoreography } from "./choreography";
import { disposeModels, loadDeviceModels } from "./models";
import type { DeviceModels } from "./models";
import {
  SATELLITE_RIG,
  SCREEN_PLACEMENT,
  anchorScreen,
  createScreen,
  screenFacing,
} from "./screens";
import { createStage } from "./stage";
import { smoothstep } from "./utils";
import type { WebGLUnavailableReason } from "./webgl-availability";

// The only entry point into three.js, imported dynamically to keep it off the
// initial bundle and away from phones.

const getCurrentScrollProgress = (): number =>
  MathUtils.clamp(getHeroProgress(), 0, 1);

/** Lets the live screens settle and the cover disappear before catch-up begins. */
const COVER_HANDOFF_MS = 320;
const CATCH_UP_THRESHOLD = 0.025;

type ProgressMode = "loading" | "catching-up" | "scroll";

export interface DeviceStackHosts {
  laptop: HTMLElement;
  tablet: HTMLElement;
  phone: HTMLElement;
}

export interface DeviceStackOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  hosts: DeviceStackHosts;
  screenLayerClassName: string;
  pixelRatio?: number;
  /** Aborting before the models resolve tears everything down instead. */
  signal: AbortSignal;
  /** Before the model loads, so the screens' documents load meanwhile. */
  onHostsAttached: () => void;
  onReady: () => void;
  /** Context creation failed, or a lost context did not recover. */
  onUnavailable: (reason: WebGLUnavailableReason) => void;
  onContextLost: () => void;
  onContextRestored: () => void;
}

/** A point in the page's client (viewport) coordinates. */
export interface ClientPoint {
  x: number;
  y: number;
}

export interface DeviceStack {
  dispose: () => void;
  /**
   * `x` and `y` are the screen iframe's client pixels. Writes the page point
   * to `out`; false if it is behind the camera.
   */
  projectScreenPoint: (
    device: ScreenDevice,
    x: number,
    y: number,
    out: ClientPoint,
  ) => boolean;
}

const INACTIVE_STACK: DeviceStack = {
  dispose() {
    // No renderer was created.
  },
  projectScreenPoint: () => false,
};

/** Written to the host only when they change, so stable screens see no DOM writes. */
interface ScreenState {
  host: HTMLElement;
  object: CSS3DObject;
  /** Facing range (dot product) over which the screen fades in. */
  fade: readonly [number, number];
  /** Also toggles `inert`, not only pointer events. */
  inert: boolean;
  opacity: string;
  interactive: boolean | null;
}

function screenState(
  host: HTMLElement,
  object: CSS3DObject,
  fade: readonly [number, number],
  inert = false,
): ScreenState {
  return { host, object, fade, inert, opacity: "", interactive: null };
}

function syncScreen(
  screen: ScreenState,
  visibility: number,
  interactive: boolean,
): void {
  const opacity = visibility.toFixed(3);
  if (opacity !== screen.opacity) {
    screen.host.style.opacity = opacity;
    screen.opacity = opacity;
  }
  if (interactive !== screen.interactive) {
    screen.host.style.pointerEvents = interactive ? "auto" : "none";
    if (screen.inert) {
      screen.host.inert = !interactive;
    }
    screen.interactive = interactive;
  }
}

/** See `DeviceStack`'s screen props. */
function isSurfaceReady(host: HTMLElement): boolean {
  return host.querySelector('[data-surface-ready="true"]') !== null;
}

export async function createDeviceStack({
  canvas,
  container,
  hosts,
  screenLayerClassName,
  pixelRatio,
  signal,
  onHostsAttached,
  onReady,
  onUnavailable,
  onContextLost,
  onContextRestored,
}: DeviceStackOptions): Promise<DeviceStack> {
  let failed = false;
  const hasFailed = (): boolean => failed;
  let disposeStack = INACTIVE_STACK.dispose;
  const unavailable = (reason: WebGLUnavailableReason): void => {
    if (failed || signal.aborted) {
      return;
    }
    failed = true;
    disposeStack();
    onUnavailable(reason);
  };
  const createdStage = createStage({
    canvas,
    container,
    pixelRatio,
    screenLayerClassName,
    onUnavailable: () => {
      unavailable("context-timeout");
    },
    onLost: onContextLost,
    onRestored: () => {
      onContextRestored();
      schedule();
    },
  });
  if (createdStage === null) {
    unavailable("creation-failed");
    return INACTIVE_STACK;
  }
  const stage = createdStage;
  disposeStack = stage.dispose;
  const { scene, camera } = stage;

  let disposed = false;
  let frame = 0;
  let readinessFrame = 0;
  let isVisible = false;
  let progressMode: ProgressMode = "loading";
  let catchUpStartsAt = 0;
  let catchUpDuration = 0;
  // Kept from the resize observer so a frame never forces layout to read it.
  let width = 1;
  let height = 1;

  // The hosts go into the (still transparent) CSS3D layer now, so the iframes
  // load in parallel with the model.
  const screenHolder = new Object3D();
  scene.add(screenHolder);
  const laptopScreen = createScreen(
    screenHolder,
    hosts.laptop,
    SCREEN_PLACEMENT.laptop,
  );
  const tabletScreen = createScreen(
    screenHolder,
    hosts.tablet,
    SCREEN_PLACEMENT.tablet,
  );
  const phoneScreen = createScreen(
    screenHolder,
    hosts.phone,
    SCREEN_PLACEMENT.phone,
  );
  const initial = canvas.getBoundingClientRect();
  stage.setSize(
    Math.max(1, Math.round(initial.width)),
    Math.max(1, Math.round(initial.height)),
  );
  stage.cssRenderer.render(scene, camera);
  // Portal content must mount only after CSS3DRenderer has connected and sized
  // its hosts, so each screen's iframe starts at its final size.
  onHostsAttached();

  let models: DeviceModels;
  try {
    models = await loadDeviceModels(signal);
  } catch (error) {
    stage.dispose();
    // An aborted download is the hero unmounting, not a failure.
    if (signal.aborted || hasFailed()) {
      return { dispose: stage.dispose, projectScreenPoint: () => false };
    }
    throw error;
  }

  const teardown = (): void => {
    if (disposed) {
      return;
    }
    disposed = true;
    setHeroProgressOverride(null);
    if (frame !== 0) {
      window.cancelAnimationFrame(frame);
    }
    if (readinessFrame !== 0) {
      window.cancelAnimationFrame(readinessFrame);
    }
    disposeModels(models);
    stage.dispose();
  };

  // The models can take seconds to arrive; the hero may be long gone by then.
  if (signal.aborted || hasFailed()) {
    teardown();
    return { dispose: teardown, projectScreenPoint: () => false };
  }

  scene.add(models.laptop.root);
  anchorScreen(models.laptop.display, laptopScreen);

  const tabletRig = new Group();
  const phoneRig = new Group();
  for (const [rig, device, name] of [
    [tabletRig, models.tablet, "tablet"],
    [phoneRig, models.phone, "phone"],
  ] as const) {
    device.root.position.fromArray(SATELLITE_RIG[name].rootPosition);
    rig.add(device.root);
    scene.add(rig);
  }
  anchorScreen(models.tablet.display, tabletScreen);
  anchorScreen(models.phone.display, phoneScreen);
  scene.remove(screenHolder);

  const choreography = createChoreography({
    camera,
    laptop: models.laptop.root,
    lidPivot: models.laptop.hinge,
    scene,
    tablet: { rig: tabletRig, placement: SATELLITE_RIG.tablet },
    phone: { rig: phoneRig, placement: SATELLITE_RIG.phone },
  });

  const laptop = screenState(hosts.laptop, laptopScreen, [0, 0.1], true);
  const satellites = [
    screenState(hosts.tablet, tabletScreen, [0.04, 0.2]),
    screenState(hosts.phone, phoneScreen, [0.04, 0.2]),
  ];

  const progressForFrame = (): number => {
    const target = getCurrentScrollProgress();
    if (progressMode === "loading") {
      return 0;
    }
    if (progressMode === "scroll") {
      return target;
    }

    const elapsed = performance.now() - catchUpStartsAt;
    if (elapsed <= 0) {
      return 0;
    }

    const time = MathUtils.clamp(elapsed / catchUpDuration, 0, 1);
    if (time >= 1) {
      progressMode = "scroll";
      return target;
    }

    // Cover most of the distance early, then meet the current (possibly still
    // moving) scroll target without snapping on the final frame.
    const easedTime = 1 - (1 - time) ** 3;
    return target * easedTime;
  };

  function render(): void {
    frame = 0;
    if (disposed || !stage.isAvailable()) {
      return;
    }

    const progress = progressForFrame();
    // The copy and badges follow the devices through loading and catch-up.
    setHeroProgressOverride(progressMode === "scroll" ? null : progress);
    const { opening } = choreography.apply(progress, width, height);

    // A fade on facing alone would switch the screen on within a dozen
    // degrees of hinge travel, so facing only gates the back of the lid and
    // the ramp follows the lid opening.
    const laptopVisibility = Math.min(
      screenFacing(laptop.object, camera, ...laptop.fade),
      smoothstep(0.1, 0.5, opening),
    );
    // For the first half of the hinge travel the panel is still behind the
    // lid; inert stops controls firing through a closed MacBook.
    syncScreen(
      laptop,
      laptopVisibility,
      progressMode === "scroll" && opening > 0.25 && laptopVisibility > 0.5,
    );
    for (const satellite of satellites) {
      const visibility = screenFacing(
        satellite.object,
        camera,
        ...satellite.fade,
      );
      syncScreen(satellite, visibility, visibility > 0.88);
    }

    stage.render();

    if (progressMode === "catching-up") {
      schedule();
    }
  }

  function schedule(): void {
    if (!disposed && frame === 0 && isVisible) {
      frame = window.requestAnimationFrame(render);
    }
  }

  const resize = (nextWidth: number, nextHeight: number): void => {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    stage.setSize(Math.round(width), Math.round(height));
    render();
  };

  const visibilityObserver = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) {
        schedule();
      }
    },
    { rootMargin: "10%" },
  );
  visibilityObserver.observe(container);

  const resizeObserver = new ResizeObserver(([entry]) => {
    resize(entry.contentRect.width, entry.contentRect.height);
  });
  resizeObserver.observe(canvas);
  window.addEventListener(HERO_PROGRESS_EVENT, schedule);

  isVisible = true;
  resize(initial.width, initial.height);

  // The cover waits for every screen's `data-surface-ready`, so it never
  // hands over to a blank screen.
  let stableSurfaceFrames = 0;

  const revealWhenSurfacesAreStable = (): void => {
    const surfacesReady =
      stage.isAvailable() &&
      isSurfaceReady(hosts.laptop) &&
      isSurfaceReady(hosts.tablet) &&
      isSurfaceReady(hosts.phone);
    // Nothing new to draw until the frames are in, so poll without rendering.
    if (surfacesReady) {
      render();
    }
    stableSurfaceFrames = surfacesReady ? stableSurfaceFrames + 1 : 0;

    if (stableSurfaceFrames >= 2) {
      readinessFrame = 0;
      if (!disposed) {
        const targetProgress = getCurrentScrollProgress();
        const shouldCatchUp =
          targetProgress > CATCH_UP_THRESHOLD &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (shouldCatchUp) {
          progressMode = "catching-up";
          catchUpStartsAt = performance.now() + COVER_HANDOFF_MS;
          catchUpDuration = MathUtils.lerp(650, 1050, targetProgress);
        } else {
          progressMode = "scroll";
        }

        // The live scene is still at progress zero, exactly beneath the cover.
        // Start its short fade now; delayed catch-up begins once it is gone.
        render();
        onReady();
        schedule();
      }
      return;
    }

    if (!disposed) {
      readinessFrame = window.requestAnimationFrame(
        revealWhenSurfacesAreStable,
      );
    }
  };

  readinessFrame = window.requestAnimationFrame(revealWhenSurfacesAreStable);

  const screenObjects = {
    laptop: laptopScreen,
    tablet: tabletScreen,
    phone: phoneScreen,
  } as const;
  const projected = new Vector3();

  /**
   * CSS3DRenderer centres each host on its object's origin with +y up and
   * scales it in scene units per CSS pixel, so a host pixel is a point on the
   * object's local z = 0 plane.
   */
  const projectScreenPoint: DeviceStack["projectScreenPoint"] = (
    device,
    x,
    y,
    out,
  ) => {
    const placement = SCREEN_PLACEMENT[device];
    projected
      .set(x - placement.width / 2, placement.height / 2 - y, 0)
      .applyMatrix4(screenObjects[device].matrixWorld)
      .project(camera);
    if (projected.z > 1) {
      return false;
    }
    const rect = canvas.getBoundingClientRect();
    out.x = rect.left + ((projected.x + 1) / 2) * rect.width;
    out.y = rect.top + ((1 - projected.y) / 2) * rect.height;
    return true;
  };

  disposeStack = (): void => {
    visibilityObserver.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener(HERO_PROGRESS_EVENT, schedule);
    teardown();
  };
  return { projectScreenPoint, dispose: disposeStack };
}
