import { Group, MathUtils } from "three";
import type { CSS3DObject } from "three/examples/jsm/renderers/CSS3DRenderer.js";

import { HERO_PROGRESS_EVENT, readHeroProgress } from "../../hero-progress";
import { SATELLITE_POSES, createChoreography } from "./choreography";
import { createTabletContactShadow } from "./contact-shadow";
import {
  DISPLAY_ASSEMBLY_NAME,
  disposeModels,
  loadDeviceModels,
  takeLaptopPanel,
} from "./models";
import {
  attachLaptopScreen,
  attachSatelliteScreen,
  poseForMeasurement,
  screenFacing,
} from "./screens";
import { createStage } from "./stage";

/**
 * Builds the hero's device stack and runs it until disposed.
 *
 * Everything three.js lives behind this one entry point, which the React
 * wrapper imports dynamically — that is what keeps three, the loaders and the
 * 6 MB of USDZ off the initial bundle and away from phones entirely.
 */

/** Synthetic pivot the lid is re-parented onto, measured from the model. */
const HINGE_POSITION = { x: 0, y: -0.09, z: -10.78 } as const;

/**
 * Logical widths of the DOM surfaces mapped onto each display. Heights follow
 * from the real mesh aspect ratio, so nothing ever letterboxes in the bezel.
 */
const SCREEN_WIDTH_PX = { laptop: 940, tablet: 720, phone: 390 } as const;

/** On-screen width of each satellite in scene units. */
const SATELLITE_WIDTH = { tablet: 15.2, phone: 7.8 } as const;

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
}

export interface DeviceStack {
  dispose: () => void;
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
}: DeviceStackOptions): Promise<DeviceStack> {
  const stage = createStage({
    canvas,
    container,
    pixelRatio,
    screenLayerClassName,
  });
  const { scene, camera } = stage;

  let disposed = false;
  let frame = 0;
  let readinessFrame = 0;
  let isVisible = false;
  let progressMode: ProgressMode = "loading";
  let catchUpStartsAt = 0;
  let catchUpDuration = 0;

  const models = await loadDeviceModels();
  const teardown = (): void => {
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
  if (signal.aborted) {
    teardown();
    return { dispose: teardown };
  }

  // --- Laptop -------------------------------------------------------------
  const displayAssembly = models.laptop.getObjectByName(DISPLAY_ASSEMBLY_NAME);
  const displayParent = displayAssembly?.parent;
  if (displayAssembly === undefined || displayParent == null) {
    teardown();
    throw new Error("The MacBook display assembly could not be located.");
  }

  const panel = takeLaptopPanel(displayAssembly);

  const lidPivot = new Group();
  lidPivot.name = "TestownikMacBookHinge";
  lidPivot.position.set(HINGE_POSITION.x, HINGE_POSITION.y, HINGE_POSITION.z);
  displayParent.add(lidPivot);
  lidPivot.attach(displayAssembly);
  scene.add(models.laptop);

  // Pose the model exactly as the finished hero shows it, so that "faces the
  // camera" and "points up" are meaningful tests while the panel is measured.
  lidPivot.rotation.x = 0;
  models.laptop.rotation.set(0, 0, 0);
  scene.updateMatrixWorld(true);
  poseForMeasurement(camera);

  const laptopScreen: CSS3DObject | null =
    panel === null
      ? null
      : attachLaptopScreen({
          panel,
          host: hosts.laptop,
          camera,
          logicalWidth: SCREEN_WIDTH_PX.laptop,
        });

  // --- Satellites ---------------------------------------------------------
  const tabletRig = new Group();
  const tablet = attachSatelliteScreen({
    scene,
    root: models.tablet,
    rig: tabletRig,
    host: hosts.tablet,
    logicalWidth: SCREEN_WIDTH_PX.tablet,
    targetWidth: SATELLITE_WIDTH.tablet,
    restPosition: SATELLITE_POSES.tablet.open,
    orientation: "landscape",
  });

  const contactShadow = createTabletContactShadow({
    tablet: models.tablet,
    screenObject: tablet.object,
    screenHeightPx: Number.parseFloat(hosts.tablet.style.height),
  });

  const phoneRig = new Group();
  const phone = attachSatelliteScreen({
    scene,
    root: models.phone,
    rig: phoneRig,
    host: hosts.phone,
    logicalWidth: SCREEN_WIDTH_PX.phone,
    targetWidth: SATELLITE_WIDTH.phone,
    restPosition: SATELLITE_POSES.phone.open,
    orientation: "portrait",
  });

  const choreography = createChoreography({
    scene,
    camera,
    laptop: models.laptop,
    lidPivot,
    tablet: { rig: tabletRig, attachment: tablet },
    phone: { rig: phoneRig, attachment: phone },
    contactShadow,
  });

  // --- Frame loop ---------------------------------------------------------
  const currentScrollProgress = (): number =>
    MathUtils.clamp(readHeroProgress(canvas), 0, 1);

  const progressForFrame = (): number => {
    const target = currentScrollProgress();
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
    if (disposed) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const progress = progressForFrame();
    const { opening } = choreography.apply(
      progress,
      bounds.width,
      bounds.height,
    );

    if (laptopScreen !== null) {
      const visibility = screenFacing(laptopScreen, camera, 0.06, 0.26);
      hosts.laptop.style.opacity = visibility.toFixed(3);
      // Facing the camera is not enough: for the first half of the hinge travel
      // the panel is still physically behind the lid. Keeping the host inert
      // stops controls firing "through" a closed MacBook.
      const isInteractive =
        progressMode === "scroll" && opening > 0.25 && visibility > 0.5;
      hosts.laptop.style.pointerEvents = isInteractive ? "auto" : "none";
      hosts.laptop.inert = !isInteractive;
    }

    for (const { object, host } of [
      { object: tablet.object, host: hosts.tablet },
      { object: phone.object, host: hosts.phone },
    ]) {
      const visibility = screenFacing(object, camera, 0.04, 0.2);
      host.style.opacity = visibility.toFixed(3);
      host.style.pointerEvents = visibility > 0.88 ? "auto" : "none";
    }

    stage.render();

    if (progressMode === "catching-up") {
      schedule();
    }
  }

  function schedule(): void {
    if (frame === 0 && isVisible) {
      frame = window.requestAnimationFrame(render);
    }
  }

  const resize = (): void => {
    const bounds = canvas.getBoundingClientRect();
    stage.setSize(
      Math.max(1, Math.round(bounds.width)),
      Math.max(1, Math.round(bounds.height)),
    );
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

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener(HERO_PROGRESS_EVENT, schedule);

  isVisible = true;
  resize();

  // Portal content must mount only after CSS3DRenderer has connected and sized
  // its hosts. ResponsiveContainer otherwise observes a detached 0 × 0 node.
  onHostsAttached();

  const getSurfaceSignature = (): string | null => {
    if (
      hosts.laptop.childElementCount === 0 ||
      hosts.phone.childElementCount === 0
    ) {
      return null;
    }

    const charts = [
      ...hosts.tablet.querySelectorAll<SVGSVGElement>("svg.recharts-surface"),
    ];
    if (charts.length !== 4) {
      return null;
    }

    const chartSignatures = charts.map((chart) => {
      const responsiveContainer = chart.closest<HTMLElement>(
        ".recharts-responsive-container",
      );
      if (responsiveContainer === null) {
        return null;
      }

      const containerWidth = responsiveContainer.clientWidth;
      const containerHeight = responsiveContainer.clientHeight;
      const { width: renderedWidth, height: renderedHeight } =
        chart.viewBox.baseVal;
      const hasFinalDimensions =
        containerWidth > 0 &&
        containerHeight > 0 &&
        Math.abs(renderedWidth - containerWidth) <= 1 &&
        Math.abs(renderedHeight - containerHeight) <= 1;
      const hasChartGeometry =
        chart.querySelectorAll(
          ".recharts-layer path, .recharts-layer rect, .recharts-layer polygon",
        ).length > 0;

      if (!hasFinalDimensions || !hasChartGeometry) {
        return null;
      }

      return `${String(containerWidth)}x${String(containerHeight)}:${chart.innerHTML}`;
    });

    return chartSignatures.includes(null) ? null : chartSignatures.join("|");
  };

  // Recharts initially paints at its fallback 320 × 200 size and then responds
  // to the real card measurement. A fixed two-frame delay can expose that
  // intermediate layout. Reveal only after the complete, correctly measured
  // SVG output is unchanged across two composited frames.
  let previousSurfaceSignature: string | null = null;
  let stableSurfaceFrames = 0;

  const revealWhenSurfacesAreStable = (): void => {
    render();

    const signature = getSurfaceSignature();
    if (signature !== null && signature === previousSurfaceSignature) {
      stableSurfaceFrames += 1;
    } else {
      stableSurfaceFrames = 0;
    }
    previousSurfaceSignature = signature;

    if (stableSurfaceFrames >= 2) {
      readinessFrame = 0;
      if (!disposed) {
        const targetProgress = currentScrollProgress();
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

  return {
    dispose() {
      visibilityObserver.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener(HERO_PROGRESS_EVENT, schedule);
      teardown();
    },
  };
}
