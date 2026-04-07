"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      return;
    }
    if (process.env.NEXT_PUBLIC_ENABLE_SW === "false") {
      return;
    }
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch((error: unknown) => {
          console.error("Service Worker registration failed:", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);
    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  return null;
}
