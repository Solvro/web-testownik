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

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../hooks/use-prefers-reduced-motion", () => ({
  useIsDesktopViewport: () => true,
  usePrefersReducedMotion: () => true,
}));
vi.mock("../components/hero-bubble", () => ({
  HeroBubble: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("./hero-phone", () => ({ HeroPhone: () => null }));
vi.mock("./landing-nav", () => ({ LandingNav: () => <header /> }));
vi.mock("../scene/device-scene", () => ({
  DeviceScene: ({
    onUnavailable,
    onRestored,
  }: {
    onUnavailable: () => void;
    onRestored: () => void;
  }) => (
    <>
      <button onClick={onUnavailable}>Fail WebGL</button>
      <button onClick={onRestored}>Restore WebGL</button>
    </>
  ),
}));

function Harness(): React.JSX.Element {
  const reference = useRef<HTMLElement>(null);
  return (
    <Hero heroReference={reference} isStarting={false} onStart={vi.fn()} />
  );
}

afterEach(() => {
  cleanup();
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

  fireEvent.click(screen.getByRole("button", { name: "Restore WebGL" }));
  expect(hero).toHaveAttribute("data-hero-static", "false");
  expect(hero).toHaveClass("lg:min-h-[190rem]");
  expect(copy).toHaveAttribute("data-hero-progress");
  expect(copy?.style.getPropertyValue("--landing-hero-progress")).toBe("1");
  expect(screen.getByText("PRZEWIŃ")).toBeInTheDocument();
});
