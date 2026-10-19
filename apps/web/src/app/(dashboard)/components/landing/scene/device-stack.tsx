"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

import { DESKTOP_STAGE_QUERY } from "../breakpoints";
import { MonoLabel } from "../components/typography";
import { laptopScreenRect } from "./laptop-framing";
import { DEVICE_COVER_CLASS, SCENE_CLASS } from "./scene-classes";
import { ScreenProjectionContext } from "./screen-projection";
import type { ProjectScreenPoint } from "./screen-projection";
import type {
  DeviceStackHosts,
  DeviceStack as DeviceStackInstance,
} from "./three/create-device-stack";

/**
 * The hero only mounts this component at `lg` and above, but the capture route
 * and a window resized below `lg` mid-load should not boot WebGL either.
 */
const MIN_SCENE_WIDTH = DESKTOP_STAGE_QUERY;

/**
 * React wrapper around the WebGL device stack.
 *
 * The component owns three things and nothing else: the canvas, the DOM hosts
 * the live UI is portalled into, and the still cover shown while the model
 * loads. All the three.js work lives in `three/create-device-stack.ts`, which
 * is imported dynamically so neither three nor the device models reach a
 * visitor who never sees the scene.
 *
 * The hosts are created imperatively because `CSS3DRenderer` reparents them
 * into its own layer; React only portals children into them.
 */
export function DeviceStack({
  className,
  coverOnly = false,
  pixelRatio,
  laptopContent,
  tabletContent,
  phoneContent,
}: {
  className?: string;
  /** Capture harness: hold the still cover and hide every live surface. */
  coverOnly?: boolean;
  pixelRatio?: number;
  /**
   * The live screens, mounted once CSS3DRenderer has attached their hosts.
   * Each must mark an element `data-surface-ready="true"` once it has
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
  const stackReference = useRef<DeviceStackInstance | null>(null);
  // Reads whichever stack is current; it only captures the ref, so the
  // compiler keeps it stable for the screens' effects.
  const projectScreenPoint: ProjectScreenPoint = (device, x, y, out) =>
    stackReference.current?.projectScreenPoint(device, x, y, out) ?? false;

  // The cover is a still of this very model, laid out by the same solver the
  // camera uses, so the hand-off to the live scene is a pure cross-fade with
  // nothing moving underneath it.
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
      const rect = laptopScreenRect(width, height);
      cover.style.left = `${(rect.left + rect.width / 2).toFixed(2)}px`;
      cover.style.top = `${rect.top.toFixed(2)}px`;
      cover.style.width = `${rect.width.toFixed(2)}px`;
      cover.style.height = `${rect.height.toFixed(2)}px`;
    };

    const observer = new ResizeObserver(place);
    observer.observe(container);
    place();
    return () => {
      observer.disconnect();
    };
  }, []);

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

    const boot = async (): Promise<void> => {
      try {
        const { createDeviceStack } =
          await import("./three/create-device-stack");
        stack = await createDeviceStack({
          canvas,
          container,
          hosts: screenHosts,
          screenLayerClassName: SCENE_CLASS.screenLayer,
          pixelRatio,
          signal: controller.signal,
          onHostsAttached: () => {
            setHosts(screenHosts);
          },
          onReady: () => {
            setIsReady(true);
          },
        });
        if (controller.signal.aborted) {
          stack.dispose();
        } else {
          stackReference.current = stack;
        }
      } catch (error) {
        console.error("Unable to build the hero device stack:", error);
        if (!controller.signal.aborted) {
          setHasFailed(true);
        }
      }
    };

    // Below `lg` the hero shows a CSS phone instead, so nothing here should
    // cost those viewports a WebGL context or a model download. Booting waits
    // until the viewport is wide enough and the hero is actually close.
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
      loadObserver.disconnect();
      wideEnough.removeEventListener("change", bootWhenPossible);
      stack?.dispose();
      stackReference.current = null;
      laptop.remove();
      tablet.remove();
      phone.remove();
    };
  }, [pixelRatio]);

  return (
    <div
      ref={containerReference}
      data-model-ready={isReady}
      data-model-failed={hasFailed}
      data-cover-only={coverOnly}
      className={cn(
        "group/stack @container-[size] absolute inset-0 transition-opacity duration-300",
        "data-[model-failed=true]:opacity-[0.34]",
        className,
      )}
    >
      {/*
       * The measured rect replaces the container-unit placement on mount,
       * before the model arrives. See DEVICE_COVER_CLASS.
       */}
      <div
        ref={coverReference}
        aria-hidden="true"
        className={cn(
          DEVICE_COVER_CLASS,
          "transition-opacity delay-150 duration-150",
          "group-data-[model-ready=true]/stack:opacity-0",
          "group-data-[cover-only=true]/stack:opacity-100!",
        )}
      />
      <canvas
        ref={canvasReference}
        aria-hidden="true"
        className="block size-full group-data-[cover-only=true]/stack:opacity-0"
      />
      {hosts === null ? null : (
        <ScreenProjectionContext value={projectScreenPoint}>
          {createPortal(laptopContent, hosts.laptop)}
          {createPortal(tabletContent, hosts.tablet)}
          {createPortal(phoneContent, hosts.phone)}
        </ScreenProjectionContext>
      )}
      {hasFailed ? (
        <MonoLabel
          aria-hidden="true"
          size="2xs"
          tone="subtle"
          className="absolute bottom-[17%] left-1/2 -translate-x-1/2 font-semibold"
        >
          MODEL NIEDOSTĘPNY
        </MonoLabel>
      ) : null}
    </div>
  );
}
