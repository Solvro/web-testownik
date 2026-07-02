"use client";

import { useQuery } from "@tanstack/react-query";
import { useContext, useRef, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { LoginPrompt } from "@/components/login-prompt";
import { Button } from "@/components/ui/button";
import { getWrappedService } from "@/services";

import { wrappedFontVariables } from "../fonts";
import type { WrappedSettings } from "../wrapped.config";
import {
  LOGO_EASTER_EGG_CLICKS,
  LOGO_EASTER_EGG_WINDOW_MS,
  WRAPPED_DEFAULTS,
  pickRandomSettings,
} from "../wrapped.config";
import "../wrapped.css";
import { WrappedStory } from "./wrapped-story";

function WrappedFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className={`wrapped-root ${wrappedFontVariables}`}>{children}</div>
  );
}

function WrappedCard({ children }: { children: React.ReactNode }) {
  return (
    <WrappedFrame>
      <div className="wrapped-shell-wrap">
        <div
          className="wrapped-shell"
          style={{
            minHeight: "min(760px, calc(100dvh - 6.5rem))",
            borderRadius: "18px",
            background: "#15171c",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            padding: "40px",
            textAlign: "center",
            color: "#fff",
            fontFamily: "var(--font-sans)",
          }}
        >
          {children}
        </div>
      </div>
    </WrappedFrame>
  );
}

function WrappedLoading() {
  return (
    <WrappedCard>
      <span
        aria-hidden
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "50%",
          border: "3px solid rgba(255,255,255,.2)",
          borderTopColor: "#c6ff3a",
          animation: "wr-spin .8s linear infinite",
        }}
      />
    </WrappedCard>
  );
}

export function WrappedExperience({ mode }: { mode: "user" | "global" }) {
  const { isAuthenticated } = useContext(AppContext);

  // Theme settings: defaults < easter-egg (temporary React state).
  const [easterSettings, setEasterSettings] =
    useState<Partial<WrappedSettings> | null>(null);
  const settings: WrappedSettings = {
    ...WRAPPED_DEFAULTS,
    ...easterSettings,
  };

  // Logo easter egg: 5 quick clicks → random theme (not persisted).
  const clicks = useRef({ count: 0, last: 0 });
  const onLogoClick = () => {
    const now = Date.now();
    const info = clicks.current;
    if (now - info.last > LOGO_EASTER_EGG_WINDOW_MS) {
      info.count = 0;
    }
    info.count += 1;
    info.last = now;
    if (info.count >= LOGO_EASTER_EGG_CLICKS) {
      info.count = 0;
      const random = pickRandomSettings();
      setEasterSettings(random);
      toast.success(
        `Nowy motyw: ${random.palette} · ${random.decoration} · ${random.progress} ✨`,
      );
    }
  };

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["wrapped", mode],
    queryFn: async () =>
      mode === "global"
        ? getWrappedService().getGlobalWrapped()
        : getWrappedService().getWrapped(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  if (!isAuthenticated) {
    return <LoginPrompt />;
  }

  if (isPending) {
    return <WrappedLoading />;
  }

  if (error !== null) {
    const isUnavailable =
      error instanceof Error &&
      (error.message.includes("Wrapped is not available") ||
        error.message.includes("(404)"));

    if (isUnavailable) {
      return (
        <WrappedCard>
          <p style={{ fontSize: "18px", opacity: 0.85 }}>
            Testownik Wrapped jest obecnie niedostępny.
          </p>
        </WrappedCard>
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">Nie udało się wczytać Wrapped.</p>
        <Button
          onClick={() => {
            void refetch();
          }}
        >
          Spróbuj ponownie
        </Button>
      </div>
    );
  }

  return (
    <WrappedFrame>
      <WrappedStory data={data} settings={settings} onLogoClick={onLogoClick} />
    </WrappedFrame>
  );
}
