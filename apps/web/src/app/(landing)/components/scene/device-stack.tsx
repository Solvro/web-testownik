"use client";

import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { DESKTOP_STAGE_QUERY } from "../breakpoints";
import { placeDeviceCover } from "./device-cover-placement";
import { DEVICE_COVER_CLASS, SCENE_CLASS } from "./scene-classes";
import { ScreenProjectionContext } from "./screen-projection";
import type { ProjectScreenPoint } from "./screen-projection";
import type {
  DeviceStackHosts,
  DeviceStack as DeviceStackInstance,
} from "./three/create-device-stack";
import { heroWebGLRetryPolicy } from "./three/webgl-availability";
import type { WebGLUnavailableReason } from "./three/webgl-availability";

/**
 * The hero only mounts this component at `lg` and above, but the capture route
 * and a window resized below `lg` mid-load should not boot WebGL either.
 */
const MIN_SCENE_WIDTH = DESKTOP_STAGE_QUERY;

/**
 * Owns the canvas, the screen hosts and the loading cover; the three.js work
 * is imported dynamically from `three/create-device-stack.ts`. The hosts are
 * created imperatively because `CSS3DRenderer` reparents them into its layer.
 */
export function DeviceStack({
  coverOnly = false,
  pixelRatio,
  laptopContent,
  tabletContent,
  phoneContent,
  onUnavailable,
  onRestored,
  onReady,
}: {
  onUnavailable?: () => void;
  onRestored?: () => void;
  onReady?: () => void;
  /** Capture harness: hold the still cover and hide every live surface. */
  coverOnly?: boolean;
  pixelRatio?: number;
  /**
   * Each screen must mark an element `data-surface-ready="true"` once it has
   * painted; the cover stays up until all three have.
   */
  laptopContent: ReactNode;
  tabletContent: ReactNode;
  phoneContent: ReactNode;
}): React.JSX.Element {
  const containerReference = useRef<HTMLDivElement>(null);
  const canvasReference = useRef<HTMLCanvasElement>(null);
  const coverReference = useRef<HTMLDivElement>(null);
  const [hosts, setHosts] = useState<DeviceStackHosts | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [isContextLost, setIsContextLost] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const showOpenStill = hasFailed || isContextLost;
  const reportUnavailable = useEffectEvent(() => {
    onUnavailable?.();
  });
  const reportRestored = useEffectEvent(() => {
    onRestored?.();
  });
  const reportReady = useEffectEvent(() => {
    onReady?.();
  });
  const stackReference = useRef<DeviceStackInstance | null>(null);
  // Reads whichever stack is current; it only captures the ref, so the
  // compiler keeps it stable for the screens' effects.
  const projectScreenPoint: ProjectScreenPoint = (device, x, y, out) =>
    stackReference.current?.projectScreenPoint(device, x, y, out) ?? false;

  // Laid out by the camera's own solver, so the hand-off is a pure cross-fade.
  useLayoutEffect(() => {
    const container = containerReference.current;
    if (container === null) {
      return;
    }

    const place = (): void => {
      const cover = coverReference.current;
      const { width, height } = container.getBoundingClientRect();
      if (cover === null || width === 0 || height === 0) {
        return;
      }
      if (showOpenStill) {
        cover.removeAttribute("style");
        return;
      }
      placeDeviceCover(cover, width, height);
    };

    const observer = new ResizeObserver(place);
    observer.observe(container);
    place();
    return () => {
      observer.disconnect();
    };
  }, [showOpenStill]);

  useEffect(() => {
    const canvas = canvasReference.current;
    const container = containerReference.current;
    if (canvas === null || container === null) {
      return;
    }

    const laptop = document.createElement("div");
    laptop.className = SCENE_CLASS.laptopScreen;
    laptop.inert = true;
    const tablet = document.createElement("div");
    tablet.className = SCENE_CLASS.tabletScreen;
    const phone = document.createElement("div");
    phone.className = SCENE_CLASS.phoneScreen;
    const screenHosts: DeviceStackHosts = { laptop, tablet, phone };

    const controller = new AbortController();
    let stack: DeviceStackInstance | null = null;
    let failed = false;
    let canRetryOnRestore = false;
    const fallback = (reason: WebGLUnavailableReason): void => {
      if (failed || controller.signal.aborted) {
        return;
      }
      failed = true;
      canRetryOnRestore = reason === "context-timeout";
      if (heroWebGLRetryPolicy.recordFailure(reason)) {
        console.warn(
          "Hero device scene unavailable; showing a static preview.",
        );
      }
      setHosts(null);
      setIsReady(false);
      setHasFailed(true);
      reportUnavailable();
    };

    const boot = async (): Promise<void> => {
      if (!heroWebGLRetryPolicy.canAttempt()) {
        fallback("creation-failed");
        return;
      }
      try {
        // Inside the try: a broken module graph must end in the static
        // fallback, not a cover with no screens.
        const { createDeviceStack } =
          await import("./three/create-device-stack");
        controller.signal.throwIfAborted();
        stack = await createDeviceStack({
          canvas,
          container,
          hosts: screenHosts,
          screenLayerClassName: SCENE_CLASS.screenLayer,
          pixelRatio,
          signal: controller.signal,
          onUnavailable: fallback,
          onContextLost: () => {
            if (!failed && !controller.signal.aborted) {
              setIsContextLost(true);
            }
          },
          onContextRestored: () => {
            if (!failed && !controller.signal.aborted) {
              setIsContextLost(false);
            }
          },
          onHostsAttached: () => {
            if (failed || controller.signal.aborted) {
              return;
            }
            setHosts(screenHosts);
          },
          onReady: () => {
            if (!failed && !controller.signal.aborted) {
              setIsReady(true);
              // Also covers a fresh desktop mount after a mobile resize.
              reportRestored();
              reportReady();
            }
          },
        });
        if (controller.signal.aborted) {
          stack.dispose();
        } else {
          stackReference.current = stack;
        }
      } catch {
        // Context creation failures arrive through onUnavailable; anything
        // thrown is the chunk import or the model download and parse.
        fallback("asset-failed");
      }
    };

    // The expired stage has released its GPU resources and listeners. Keep
    // this one listener until unmount so a late browser restore can recreate
    // it, including if the original model download is still resolving.
    const retryAfterRestore = (): void => {
      if (!canRetryOnRestore || controller.signal.aborted) {
        return;
      }
      canRetryOnRestore = false;
      setHasFailed(false);
      setIsContextLost(false);
      setAttempt((value) => value + 1);
      reportRestored();
    };
    canvas.addEventListener("webglcontextrestored", retryAfterRestore);

    // Boot only once the viewport is wide enough and the hero is close.
    const wideEnough = window.matchMedia(MIN_SCENE_WIDTH);
    let hasBooted = false;
    let isNearHero = false;
    const bootWhenPossible = (): void => {
      if (hasBooted || !wideEnough.matches || !isNearHero) {
        return;
      }
      hasBooted = true;
      void boot();
    };

    const loadObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          return;
        }
        isNearHero = true;
        loadObserver.disconnect();
        bootWhenPossible();
      },
      { rootMargin: "120% 0px" },
    );
    loadObserver.observe(container);
    wideEnough.addEventListener("change", bootWhenPossible);

    return () => {
      controller.abort();
      canvas.removeEventListener("webglcontextrestored", retryAfterRestore);
      loadObserver.disconnect();
      wideEnough.removeEventListener("change", bootWhenPossible);
      stack?.dispose();
      stackReference.current = null;
      laptop.remove();
      tablet.remove();
      phone.remove();
    };
  }, [pixelRatio, attempt]);

  return (
    <div
      ref={containerReference}
      data-model-ready={isReady}
      data-model-failed={hasFailed}
      data-context-lost={isContextLost}
      data-cover-only={coverOnly}
      className={cn(
        "group/stack @container-[size] absolute inset-0 transition-opacity duration-300",
        // Pinned so scroll frames do not restyle the screens' hundreds of
        // elements, none of which read it.
        "[--landing-hero-progress:0]",
      )}
    >
      {/*
       * The measured rect replaces the container-unit placement on mount,
       * before the model arrives. See DEVICE_COVER_CLASS.
       */}
      <div
        ref={coverReference}
        data-device-cover=""
        aria-hidden="true"
        className={cn(
          showOpenStill
            ? "pointer-events-none absolute inset-x-0 top-[38%] bottom-[3%] z-1 bg-[url(/models/testownik-device-stack-open-light-v1.webp)] bg-contain bg-center bg-no-repeat dark:bg-[url(/models/testownik-device-stack-open-dark-v1.webp)]"
            : DEVICE_COVER_CLASS,
          // The delay lets the first live frames composite under the cover;
          // without it the screens blink through the hand-off.
          "transition-opacity delay-150 duration-150",
          "group-data-[model-ready=true]/stack:opacity-0",
          "group-data-[cover-only=true]/stack:opacity-100!",
          "group-data-[context-lost=true]/stack:opacity-100!",
        )}
      />
      <canvas
        ref={canvasReference}
        aria-hidden="true"
        className="block size-full group-data-[context-lost=true]/stack:opacity-0 group-data-[cover-only=true]/stack:opacity-0"
      />
      {hosts === null || hasFailed ? null : (
        <ScreenProjectionContext value={projectScreenPoint}>
          {createPortal(laptopContent, hosts.laptop)}
          {createPortal(tabletContent, hosts.tablet)}
          {createPortal(phoneContent, hosts.phone)}
        </ScreenProjectionContext>
      )}
    </div>
  );
}
