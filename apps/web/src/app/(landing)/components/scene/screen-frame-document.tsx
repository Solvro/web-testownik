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
 * Tells the page once it has painted, so the loading cover hands over without
 * a blank screen.
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

    // The pointer position the page needs back; see `screen-frame-input.ts`.
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
         * Next.js draws its dev indicator into every document; keep it off
         * the screens and their captured loading covers.
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
