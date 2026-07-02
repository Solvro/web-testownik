"use client";

import { useQuery } from "@tanstack/react-query";
import { LogInIcon } from "lucide-react";
import Image from "next/image";
import { useContext, useRef, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import Logo from "@/assets/logo.svg";
import { Button, ButtonLink } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PermissionAction } from "@/lib/auth/permissions";
import { getWrappedService } from "@/services";
import { ACCOUNT_TYPE } from "@/types/user";

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
      <Spinner className="size-9 text-[#c6ff3a]" />
    </WrappedCard>
  );
}
function WrappedLogin({
  isGuest,
  isGlobal,
}: {
  isGuest: boolean;
  isGlobal: boolean;
}) {
  const redirectPath = `/wrapped${isGlobal ? "/global" : ""}`;
  const title = isGuest
    ? "Wrapped nie jest dostępne dla gości"
    : "Zaloguj się\n do Wrapped";
  const description = isGuest
    ? "Ta funkcja jest dostępna tylko dla zalogowanych kont. Zaloguj się żeby kontynuować."
    : isGlobal
      ? "Zaloguj się, żeby zobaczyć semestr całego Testownika w liczbach."
      : "Zaloguj się, żeby zobaczyć swoje semestralne podsumowanie w Testowniku.";

  return (
    <WrappedCard>
      <div
        aria-hidden
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "var(--radius-xl)",
          background: "#c6ff3a",
          color: "#15171c",
          display: "grid",
          placeItems: "center",
          boxShadow: "0 18px 55px -24px #c6ff3a",
        }}
      >
        {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
        <Image src={Logo} alt="Logo" className="h-9" />
      </div>
      <div style={{ display: "grid", gap: "10px", maxWidth: "34ch" }}>
        <p
          style={{
            margin: 0,
            color: "#c6ff3a",
            fontFamily: "var(--font-sans)",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: ".18em",
            textTransform: "uppercase",
          }}
        >
          Testownik Wrapped
        </p>
        <h1
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontSize: "clamp(34px, 9vw, 56px)",
            lineHeight: 0.98,
            textTransform: "uppercase",
            whiteSpace: "pre-wrap",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            margin: 0,
            color: "rgba(255,255,255,.72)",
            fontSize: "17px",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      </div>
      <ButtonLink
        href={`/login?redirect=${encodeURIComponent(redirectPath)}`}
        size="lg"
        className="mt-2 bg-[#c6ff3a] text-[#15171c] hover:bg-[#d7ff66]"
      >
        <LogInIcon />
        {isGuest ? "Przejdź do logowania" : "Zaloguj się"}
      </ButtonLink>
    </WrappedCard>
  );
}

export function WrappedExperience({ mode }: { mode: "user" | "global" }) {
  const { checkPermission, user } = useContext(AppContext);
  const canViewWrapped = checkPermission(PermissionAction.VIEW_WRAPPED);

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
    enabled: canViewWrapped,
    staleTime: 5 * 60 * 1000,
  });

  if (!canViewWrapped) {
    return (
      <WrappedLogin
        isGuest={user?.account_type === ACCOUNT_TYPE.GUEST}
        isGlobal={mode === "global"}
      />
    );
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
