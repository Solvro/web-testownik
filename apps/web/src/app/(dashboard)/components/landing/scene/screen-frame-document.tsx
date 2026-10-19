"use client";

import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

import { useQuizPreviewState } from "../hooks/use-quiz-preview-state";
import {
  DeviceLaptopScreen,
  DevicePhoneScreen,
  DeviceTabletScreen,
} from "./device-screen-content";
import { forwardScreenInput } from "./screen-frame-input";
import {
  SCREEN_FRAME_SOURCE,
  parseScreenFrameMessage,
} from "./screen-frame-protocol";
import type {
  ScreenDevice,
  ScreenFrameRequest,
  ScreenReadyMessage,
  ScreenTheme,
} from "./screen-frame-protocol";

function QuizScreen({
  device,
  channel,
}: {
  device: Exclude<ScreenDevice, "tablet">;
  channel: string | undefined;
}): React.JSX.Element {
  const session = useQuizPreviewState({ syncChannel: channel });
  return device === "laptop" ? (
    <DeviceLaptopScreen session={session} />
  ) : (
    <DevicePhoneScreen session={session} />
  );
}

/**
 * The document inside one device-screen iframe of the desktop hero.
 *
 * The page picks the theme in the URL and posts changes afterwards; the screen
 * tells the page once it has painted, which is what lets the loading cover
 * hand over to the live scene without a blank screen in between.
 */
export function ScreenFrameDocument({
  request,
}: {
  request: ScreenFrameRequest;
}): React.JSX.Element {
  const { device, channel } = request;
  const [theme, setTheme] = useState<ScreenTheme>(request.theme);

  useEffect(() => {
    if (window.parent === window) {
      return;
    }
    const onMessage = (event: MessageEvent<unknown>): void => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      ) {
        return;
      }
      const message = parseScreenFrameMessage(event.data);
      if (message?.type === "theme") {
        setTheme(message.theme);
      }
    };
    window.addEventListener("message", onMessage);

    // Wheel and pointer input the page needs back; see `screen-frame-input.ts`.
    // The root must not chain the wheel natively as well.
    const root = document.documentElement;
    root.style.overscrollBehavior = "none";
    const stopForwarding = forwardScreenInput();

    // Two frames: the first commits the screen, the second has painted it.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        window.parent.postMessage(
          {
            source: SCREEN_FRAME_SOURCE,
            type: "ready",
            device,
          } satisfies ScreenReadyMessage,
          window.location.origin,
        );
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("message", onMessage);
      stopForwarding();
      root.style.overscrollBehavior = "";
    };
  }, [device]);

  return (
    <ThemeProvider
      attribute="class"
      forcedTheme={theme}
      disableTransitionOnChange
    >
      <TooltipProvider delay={0}>
        {/*
         * In development Next.js draws its indicator into every document;
         * on a device screen it would sit on the drawing (and in the
         * captured loading covers). The page keeps its own.
         */}
        {process.env.NODE_ENV === "development" ? (
          <style>{"nextjs-portal{display:none!important}"}</style>
        ) : null}
        <div
          data-landing-screen={device}
          className="bg-background text-foreground h-dvh w-full overflow-hidden"
        >
          {device === "tablet" ? (
            <DeviceTabletScreen />
          ) : (
            <QuizScreen device={device} channel={channel} />
          )}
        </div>
      </TooltipProvider>
    </ThemeProvider>
  );
}
