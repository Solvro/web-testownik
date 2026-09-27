import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile({
  hydrationSafe = false,
}: { hydrationSafe?: boolean } = {}) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(() => {
    if (typeof window === "undefined" || hydrationSafe) {
      return;
    }
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useLayoutEffect(() => {
    const mql = window.matchMedia(
      `(max-width: ${String(MOBILE_BREAKPOINT - 1)}px)`,
    );
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    hydrationSafe && onChange();
    return () => {
      mql.removeEventListener("change", onChange);
    };
  }, [hydrationSafe]);

  return Boolean(isMobile);
}
