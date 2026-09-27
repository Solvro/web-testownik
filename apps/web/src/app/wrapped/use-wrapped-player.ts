"use client";

import { useEffect, useRef, useState } from "react";

/** Pointer held shorter than this counts as a tap (navigate), not a pause. */
const TAP_MS = 240;

function nowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function clampIndex(index: number, count: number): number {
  const max = Math.max(0, count - 1);
  return Math.max(0, Math.min(max, index));
}

const INTERACTIVE_KEYBOARD_TARGET =
  'a[href], button, input, select, textarea, [contenteditable="true"], [role="button"], [role="checkbox"], [role="combobox"], [role="radio"], [role="searchbox"], [role="switch"], [role="textbox"]';

function hasInteractiveKeyboardTarget(event: KeyboardEvent): boolean {
  return event.composedPath().some((target) => {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return (
      target.isContentEditable || target.matches(INTERACTIVE_KEYBOARD_TARGET)
    );
  });
}

interface UseWrappedPlayerOptions {
  count: number;
  getDuration: (index: number) => number;
}

interface HoldHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

export interface WrappedPlayer {
  idx: number;
  count: number;
  /** Whether the user has interacted yet (autoplay waits for the first tap). */
  started: boolean;
  /** Attach to the stage element — receives the live `--wr-progress` var. */
  stageRef: React.RefObject<HTMLDivElement | null>;
  next: () => void;
  prev: () => void;
  goto: (index: number) => void;
  /** Tap/hold handlers for the left (back) zone. */
  leftHold: HoldHandlers;
  /** Tap/hold handlers for the right (forward) zone. */
  rightHold: HoldHandlers;
}

/**
 * Story-player state machine: drives auto-advance, the progress fill, hold-to-pause,
 * tap-to-navigate and keyboard control. Autoplay only kicks in after the first user
 * interaction, so the intro slide waits for a tap. Progress is written imperatively
 * to a CSS variable so per-frame updates never re-render the slides.
 *
 * (React Compiler memoizes the callbacks below — no manual `useCallback` needed.)
 */
export function useWrappedPlayer({
  count,
  getDuration,
}: UseWrappedPlayerOptions): WrappedPlayer {
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const visibleIndex = clampIndex(index, count);

  // Mutable timing state, kept out of React to avoid per-frame renders.
  const timing = useRef({
    slideStart: 0,
    paused: false,
    pauseAt: 0,
    advancing: false,
    holdStart: 0,
    started: false,
  });

  // Latest values for the rAF loop to read without re-subscribing.
  const live = useRef({ idx: visibleIndex, count, getDuration });
  live.current = { idx: visibleIndex, count, getDuration };

  const markStarted = () => {
    if (!timing.current.started) {
      timing.current.started = true;
      setStarted(true);
    }
  };

  const goto = (target: number) => {
    markStarted();
    setIndex((current) => {
      const clamped = clampIndex(target, live.current.count);
      return clamped === current ? current : clamped;
    });
  };

  const next = () => {
    goto(live.current.idx + 1);
  };

  const previous = () => {
    goto(live.current.idx - 1);
  };

  // Latest nav handlers, so the lifetime effects below can run once (empty deps)
  // without going stale.
  const handlers = useRef({ next, previous });
  handlers.current = { next, previous };

  // Reset timing whenever the slide changes.
  useEffect(() => {
    const t = timing.current;
    t.slideStart = nowMs();
    t.pauseAt = 0;
    t.paused = false;
    t.advancing = false;
    const stage = stageRef.current;
    if (stage !== null) {
      stage.style.setProperty("--wr-progress", "0");
      stage.style.setProperty("--wr-index", String(visibleIndex));
    }
  }, [visibleIndex]);

  // Single rAF loop for the lifetime of the player.
  useEffect(() => {
    let raf = 0;
    const setProgress = (pf: number) => {
      stageRef.current?.style.setProperty("--wr-progress", String(pf));
    };
    const tick = () => {
      const t = timing.current;
      const { idx: current, count: n, getDuration: dur } = live.current;
      if (!t.paused) {
        const isLast = current >= n - 1;
        const canAdvance = t.started && !isLast;
        if (canAdvance && !t.advancing) {
          const pf = Math.min(1, (nowMs() - t.slideStart) / dur(current));
          setProgress(pf);
          if (pf >= 1) {
            t.advancing = true;
            handlers.current.next();
          }
        } else {
          // Not started yet → empty; last/started → full.
          setProgress(t.started ? 1 : 0);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // Keyboard control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        hasInteractiveKeyboardTarget(event) ||
        document.querySelector('[role="dialog"]') !== null
      ) {
        return;
      }

      if (
        event.key === "ArrowRight" ||
        event.key === " " ||
        event.key === "Spacebar"
      ) {
        event.preventDefault();
        handlers.current.next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlers.current.previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const pause = () => {
    const t = timing.current;
    if (!t.paused) {
      t.paused = true;
      t.pauseAt = nowMs();
    }
  };

  const resume = () => {
    const t = timing.current;
    if (t.paused) {
      const pausedAt = t.pauseAt === 0 ? nowMs() : t.pauseAt;
      t.slideStart += nowMs() - pausedAt;
      t.paused = false;
    }
  };

  const makeHold = (onTap: () => void): HoldHandlers => ({
    onPointerDown: () => {
      timing.current.holdStart = nowMs();
      pause();
    },
    onPointerUp: () => {
      const held = nowMs() - timing.current.holdStart;
      resume();
      if (held < TAP_MS) {
        onTap();
      }
    },
    onPointerLeave: resume,
    onPointerCancel: resume,
  });

  return {
    idx: visibleIndex,
    count,
    started,
    stageRef,
    next,
    prev: previous,
    goto,
    leftHold: makeHold(previous),
    rightHold: makeHold(next),
  };
}
