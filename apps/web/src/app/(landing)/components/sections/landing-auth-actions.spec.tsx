import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Finale } from "./finale";
import { LandingNav } from "./landing-nav";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("../ui/particle-logo", () => ({ ParticleLogo: () => null }));

afterEach(() => {
  cleanup();
});

describe("LandingNav", () => {
  it("offers guests the guest start and no login or join links", () => {
    render(
      <LandingNav
        isAuthenticated={false}
        isStarting={false}
        onStart={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Zacznij" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Zaloguj" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Dołącz" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Zmień motyw" })).toBeNull();
  });

  it("links signed-in visitors straight to their quizzes", () => {
    render(<LandingNav isAuthenticated isStarting={false} onStart={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Otwórz Testownik" }),
    ).toHaveAttribute("href", "/quizzes");
    expect(screen.queryByRole("button", { name: "Zacznij" })).toBeNull();
  });
});

describe("Finale", () => {
  it("offers guests login and the guest start", () => {
    render(
      <Finale isAuthenticated={false} isStarting={false} onStart={vi.fn()} />,
    );
    expect(screen.getByRole("link", { name: "Zaloguj się" })).toHaveAttribute(
      "href",
      "/login?redirect=%2Fquizzes",
    );
    expect(
      screen.getByRole("button", { name: "Zacznij jako gość" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Otwórz Testownik" })).toBeNull();
  });

  it("gives signed-in visitors a single way back to the app", () => {
    render(<Finale isAuthenticated isStarting={false} onStart={vi.fn()} />);
    expect(
      screen.getByRole("link", { name: "Otwórz Testownik" }),
    ).toHaveAttribute("href", "/quizzes");
    expect(screen.queryByRole("link", { name: "Zaloguj się" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Zacznij jako gość" }),
    ).toBeNull();
  });
});
