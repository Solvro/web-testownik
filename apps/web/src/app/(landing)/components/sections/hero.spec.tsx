import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useRef } from "react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { HERO_PROGRESS_EVENT, publishHeroProgress } from "../hero-progress";
import { Hero } from "./hero";

const viewport = vi.hoisted(() => ({ isDesktop: true }));

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../hooks/use-prefers-reduced-motion", () => ({
  useIsDesktopViewport: () => viewport.isDesktop,
  usePrefersReducedMotion: () => true,
}));
vi.mock("../ui/hero-bubble", () => ({
  HeroBubble: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./hero-phone", () => ({ HeroPhone: () => null }));
vi.mock("../scene/device-scene", () => ({
  DeviceScene: ({
    onUnavailable,
    onRestored,
    onReady,
  }: {
    onUnavailable: () => void;
    onRestored: () => void;
    onReady: () => void;
  }) => (
    <>
      <button onClick={onUnavailable}>Fail WebGL</button>
      <button onClick={onRestored}>Restore WebGL</button>
      <button onClick={onReady}>Stack ready</button>
    </>
  ),
}));

function Harness(): React.JSX.Element {
  const reference = useRef<HTMLElement>(null);
  return <Hero heroReference={reference} />;
}

afterEach(() => {
  cleanup();
  viewport.isDesktop = true;
  publishHeroProgress(0);
});

it("replaces the reduced-motion runway with visible static copy and stops progress", async () => {
  const view = render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: "Fail WebGL" }));
  const hero = view.container.querySelector("#start");
  const copy = screen.getByRole("heading", { level: 1 }).parentElement;
  expect(hero).toHaveAttribute("data-hero-static", "true");
  expect(hero).toHaveClass("lg:h-[100svh]");
  expect(hero).not.toHaveClass("lg:min-h-[190rem]");
  expect(hero?.querySelectorAll("[data-hero-progress]")).toHaveLength(0);
  expect(copy?.style.opacity).toBe("");
  expect(copy?.style.transform).toBe("");
  expect(copy?.style.getPropertyValue("--landing-hero-progress")).toBe("");
  expect(screen.queryByText("PRZEWIŃ")).not.toBeInTheDocument();

  const listener = vi.fn();
  window.addEventListener(HERO_PROGRESS_EVENT, listener);
  try {
    await act(async () => {
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(listener).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener(HERO_PROGRESS_EVENT, listener);
  }

  const scene = screen.getByRole("button", {
    name: "Restore WebGL",
    hidden: true,
  }).parentElement;
  expect(scene).toHaveAttribute("aria-hidden", "true");
  expect(scene).toHaveClass("invisible", "pointer-events-none");
  expect(scene).not.toHaveClass("hidden");
  fireEvent.click(
    screen.getByRole("button", { name: "Restore WebGL", hidden: true }),
  );
  expect(hero).toHaveAttribute("data-hero-static", "false");
  expect(hero).toHaveClass("lg:min-h-[190rem]");
  expect(copy).toHaveAttribute("data-hero-progress");
  expect(screen.getByText("PRZEWIŃ")).toBeInTheDocument();
  // The stack is loading again: the copy holds the closed pose, whatever the
  // (reduced-motion, pinned) progress says, until the scene is ready.
  expect(copy?.style.getPropertyValue("--landing-hero-progress")).toBe("0");
  expect(hero).toHaveAttribute("data-hero-ready", "false");
  fireEvent.click(screen.getByRole("button", { name: "Stack ready" }));
  expect(hero).toHaveAttribute("data-hero-ready", "true");
  expect(copy?.style.getPropertyValue("--landing-hero-progress")).toBe("1");
});

it("resets the static fallback when the desktop stage remounts", async () => {
  const view = render(<Harness />);
  fireEvent.click(await screen.findByRole("button", { name: "Fail WebGL" }));
  expect(view.container.querySelector("#start")).toHaveAttribute(
    "data-hero-static",
    "true",
  );
  viewport.isDesktop = false;
  view.rerender(<Harness />);
  expect(
    screen.queryByRole("button", { name: "Fail WebGL", hidden: true }),
  ).not.toBeInTheDocument();
  viewport.isDesktop = true;
  view.rerender(<Harness />);
  await screen.findByRole("button", { name: "Fail WebGL" });
  expect(view.container.querySelector("#start")).toHaveAttribute(
    "data-hero-static",
    "false",
  );
});
