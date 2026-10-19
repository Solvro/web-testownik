import { Group, MathUtils, Vector3 } from "three";
import type { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import { HERO_PROGRESS_EVENT, getHeroProgress } from "../../hero-progress";
import type { ScreenDevice } from "../screen-frame-protocol";
import { createChoreography } from "./choreography";
import { disposeModels, loadDeviceModels } from "./models";
import type { DeviceModels } from "./models";
import {
  SATELLITE_RIG,
  SCREEN_PLACEMENT,
  attachScreen,
  screenFacing,
} from "./screens";
import { createStage } from "./stage";
import { smoothstep } from "./utils";

/**
 * Builds the hero's device stack and runs it until disposed.
 *
 * Everything three.js lives behind this one entry point, which the React
 * wrapper imports dynamically — that is what keeps three, the loaders and the
 * device model downloads off the initial bundle and away from phones entirely.
 */

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
  /** Class applied to the CSS3D layer the renderer creates. */
  screenLayerClassName: string;
  pixelRatio?: number;
  /** Aborting before the models resolve tears everything down instead. */
  signal: AbortSignal;
  /** Called after CSS3DRenderer has attached and sized the portal hosts. */
  onHostsAttached: () => void;
  /** Called once the live surfaces have settled and been composited. */
  onReady: () => void;
  /** Context creation failed, or a lost context did not recover. */
  onUnavailable: () => void;
}

/** A point in the page's client (viewport) coordinates. */
export interface ClientPoint {
  x: number;
  y: number;
}

export interface DeviceStack {
  dispose: () => void;
  /**
   * Where a point on a live screen, in that screen's own CSS pixels (its
   * iframe's client coordinates), is on the page as currently rendered.
   * Writes it to `out` and returns false if it is behind the camera.
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

/**
 * One live screen's visibility rules. Opacity and interactivity are written to
 * the host only when they change, so a scroll frame does not touch the DOM of
 * a screen whose state is stable.
 */
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
}: DeviceStackOptions): Promise<DeviceStack> {
  let failed = false;
  const hasFailed = (): boolean => failed;
  let disposeStack = INACTIVE_STACK.dispose;
  const unavailable = (): void => {
    if (failed || signal.aborted) {
      return;
    }
    failed = true;
    disposeStack();
    onUnavailable();
  };
  const createdStage = createStage({
    canvas,
    container,
    pixelRatio,
    screenLayerClassName,
    onUnavailable: unavailable,
    onRestored: () => {
      schedule();
    },
  });
  if (createdStage === null) {
    unavailable();
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

  // --- Devices ------------------------------------------------------------
  scene.add(models.laptop.root);
  const laptopScreen = attachScreen(
    models.laptop.display,
    hosts.laptop,
    SCREEN_PLACEMENT.laptop,
  );

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
  const tabletScreen = attachScreen(
    models.tablet.display,
    hosts.tablet,
    SCREEN_PLACEMENT.tablet,
  );
  const phoneScreen = attachScreen(
    models.phone.display,
    hosts.phone,
    SCREEN_PLACEMENT.phone,
  );

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

  // --- Frame loop ---------------------------------------------------------
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

    const { opening } = choreography.apply(progressForFrame(), width, height);

    // The panel is edge-on to the camera when it first faces it, where the
    // facing value grows about one unit per radian, so a fade on facing
    // alone switches the screen on within a dozen degrees of hinge travel.
    // The facing test only gates the back of the lid; the ramp itself
    // follows the lid opening, over a third of its travel.
    const laptopVisibility = Math.min(
      screenFacing(laptop.object, camera, ...laptop.fade),
      smoothstep(0.3, 0.64, opening),
    );
    // Facing the camera is not enough: for the first half of the hinge travel
    // the panel is still physically behind the lid. Keeping the host inert
    // stops controls firing "through" a closed MacBook.
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

  // Nothing renders while the hero is off-screen, which is most of the page
  // for a visitor who scrolls past it.
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
  const initial = canvas.getBoundingClientRect();
  resize(initial.width, initial.height);

  // Portal content must mount only after CSS3DRenderer has connected and sized
  // its hosts, so each screen's iframe starts at its final size.
  onHostsAttached();

  // The screens are iframes that load on their own; each marks itself
  // `data-surface-ready` once it has painted (the iPad with its still
  // preview — its charts load after interaction). The cover waits for all
  // three, so it never hands over to a blank screen.
  let stableSurfaceFrames = 0;

  const revealWhenSurfacesAreStable = (): void => {
    const surfacesReady =
      stage.isAvailable() &&
      isSurfaceReady(hosts.laptop) &&
      isSurfaceReady(hosts.tablet) &&
      isSurfaceReady(hosts.phone);
    // Loading the frames takes a while; the scene has nothing new to draw
    // until they are in, so the wait is a cheap poll rather than a render.
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

  // --- Screen → page projection ------------------------------------------
  const screenObjects = {
    laptop: laptopScreen,
    tablet: tabletScreen,
    phone: phoneScreen,
  } as const;
  const projected = new Vector3();

  /**
   * CSS3DRenderer centres each host on its object's origin with +y up, and
   * the object's scale is scene units per CSS pixel, so a host pixel is a
   * point on the object's local z = 0 plane. The world matrices are the ones
   * the last frame rendered with.
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
