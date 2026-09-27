"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useRef, useState } from "react";

import { useIsCompactViewport } from "../hooks/use-prefers-reduced-motion";
import { wordmarkDark } from "../logos";

const ParticleObject = dynamic(
  async () =>
    import("@/components/canvasui/ParticleObject").then(
      (module) => module.ParticleObject,
    ),
  { ssr: false },
);

const CANVAS_STYLE = { width: "100%", height: "100%" };
const DESKTOP_LOGO_ASPECT = 3.4;
const DESKTOP_LOGO_MAX_WIDTH = 82 * 16;
const DESKTOP_LOGO_WIDTH_RATIO = 0.92;
const DESKTOP_SCENE_SCALE = 15.2;
const COMPACT_LOGO_ASPECT = 2.2;
const COMPACT_LOGO_WIDTH_RATIO = 0.94;
const COMPACT_SCENE_SCALE = 10.4;
const DESKTOP_FULL_CANVAS_PROJECTION_COMPENSATION = 4 / 3;

function sceneScaleForCanvas(
  width: number,
  height: number,
  compact: boolean,
): number {
  const logoWidth = compact
    ? width * COMPACT_LOGO_WIDTH_RATIO
    : Math.min(width * DESKTOP_LOGO_WIDTH_RATIO, DESKTOP_LOGO_MAX_WIDTH);
  const logoHeight =
    logoWidth / (compact ? COMPACT_LOGO_ASPECT : DESKTOP_LOGO_ASPECT);
  const originalScale = compact ? COMPACT_SCENE_SCALE : DESKTOP_SCENE_SCALE;

  // ParticleObject projects scene units relative to canvas height. Scaling by
  // the old logo-box height keeps the wordmark the same visual size while the
  // canvas itself grows to cover the entire section.
  return (
    originalScale *
    (logoHeight / Math.max(height, 1)) *
    (compact ? 1 : DESKTOP_FULL_CANVAS_PROJECTION_COMPENSATION)
  );
}

/**
 * The closing wordmark, rendered as a single particle simulation — the icon and
 * the lettering are one object, with no conventional logo underneath.
 *
 * An empty `color` keeps the asset's own per-pixel colours, so the icon stays
 * brand blue and the lettering stays white instead of both flattening to one
 * tint. The WebGL chunk is only requested once the section is nearly in view,
 * which keeps it off the hero's critical path.
 */
export function ParticleLogo({
  className,
}: {
  className?: string;
}): React.JSX.Element {
  const isCompact = useIsCompactViewport();
  const containerReference = useRef<HTMLDivElement | null>(null);
  const [sceneScale, setSceneScale] = useState(
    isCompact ? COMPACT_SCENE_SCALE : DESKTOP_SCENE_SCALE,
  );
  const [inView, setInView] = useState(false);

  useLayoutEffect(() => {
    const container = containerReference.current;
    if (container === null) {
      return;
    }

    const updateScale = (): void => {
      const { width, height } = container.getBoundingClientRect();
      setSceneScale(sceneScaleForCanvas(width, height, isCompact));
    };

    const resizeObserver = new ResizeObserver(updateScale);
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          visibilityObserver.disconnect();
        }
      },
      { rootMargin: "320px" },
    );

    resizeObserver.observe(container);
    visibilityObserver.observe(container);
    updateScale();

    return () => {
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
    };
  }, [isCompact]);

  return (
    <div ref={containerReference} className={className} aria-hidden="true">
      {inView ? (
        <ParticleObject
          src={wordmarkDark.src}
          style={CANVAS_STYLE}
          count={isCompact ? 9000 : 22_000}
          radius={80}
          drift={0.2}
          scale={sceneScale}
          floatIntensity={0.2}
          rotationIntensity={0.2}
          floatSpeed={1.25}
          autoRotate={false}
          fov={10}
          cameraDistance={32}
        />
      ) : null}
    </div>
  );
}
