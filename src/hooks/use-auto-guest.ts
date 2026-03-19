"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import type { JWTPayload } from "@/lib/auth/types";

const GUEST_EXCLUDED_ROUTES = [
  "/",
  "/login",
  "/auth",
  "/login-otp",
  "/privacy-policy",
];

export function useAutoGuest(user: JWTPayload | null) {
  const pathname = usePathname();
  const router = useRouter();
  const creatingRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (user !== null || creatingRef.current) {
      return;
    }

    if (
      GUEST_EXCLUDED_ROUTES.some(
        (route) =>
          pathname === route ||
          (route !== "/" && pathname.startsWith(`${route}/`)),
      )
    ) {
      return;
    }

    creatingRef.current = true;

    void (async () => {
      try {
        const response = await fetch("/auth/guest/create", {
          method: "POST",
        });

        if (!response.ok) {
          const loginUrl = new URL("/login", window.location.origin);
          loginUrl.searchParams.set("redirect", pathname);
          router.replace(loginUrl.toString());
        }
      } catch {
        const loginUrl = new URL("/login", window.location.origin);
        loginUrl.searchParams.set("redirect", pathname);
        router.replace(loginUrl.toString());
      } finally {
        creatingRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- We only want to run this effect when the pathname changes, not when the user changes
  }, [pathname]);
}
