"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

let setup: Promise<(typeof import("@formbricks/js"))["default"]> | undefined;

async function loadFormbricks() {
  setup ??= import("@formbricks/js").then(async ({ default: formbricks }) => {
    await formbricks.setup({
      environmentId: "cmkylmmsh0009s4017ostyze7",
      appUrl: "https://formbricks.b.solvro.pl",
    });
    return formbricks;
  });
  return setup;
}

export function FormbricksProvider() {
  const pathname = usePathname();
  const searchParameters = useSearchParams();

  useEffect(() => {
    let cancelled = false;
    let started = false;
    const initialize = (): void => {
      if (started) {
        return;
      }
      started = true;
      void loadFormbricks().then((formbricks) => {
        if (!cancelled) {
          void formbricks.registerRouteChange();
        }
      });
    };

    // The landing needs no survey until the visitor starts interacting, or
    // until the page has been idle for a while. Once loaded (a visitor coming
    // back from an app route), routes register straight away.
    let idle = 0;
    let fallback = 0;
    if (pathname === "/" && setup === undefined) {
      window.addEventListener("pointerdown", initialize, {
        once: true,
        passive: true,
      });
      window.addEventListener("keydown", initialize, { once: true });
      if ("requestIdleCallback" in window) {
        idle = window.requestIdleCallback(initialize, { timeout: 8000 });
      }
      fallback = window.setTimeout(initialize, 10_000);
    } else {
      initialize();
    }

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", initialize);
      window.removeEventListener("keydown", initialize);
      if (idle !== 0) {
        window.cancelIdleCallback(idle);
      }
      window.clearTimeout(fallback);
    };
  }, [pathname, searchParameters]);

  return null;
}
