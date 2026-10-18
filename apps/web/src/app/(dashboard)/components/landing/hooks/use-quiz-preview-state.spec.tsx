import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { PhoneQuizSurface } from "@/components/testownik-preview/product-surfaces";

import { useQuizPreviewState } from "./use-quiz-preview-state";

// Next.js ships the canary React with `ViewTransition`; the test runner uses
// the stable build, which does not have it yet.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    ViewTransition:
      actual.ViewTransition ??
      (({ children }: { children: React.ReactNode }): React.ReactNode =>
        children),
  };
});

function PhonePreview(): React.JSX.Element {
  const session = useQuizPreviewState();
  return <PhoneQuizSurface session={session} />;
}

function portalLayer(): HTMLElement {
  const layer = document.querySelector<HTMLElement>("[data-preview-portal]");
  if (layer === null) {
    throw new Error("missing portal layer");
  }
  return layer;
}

describe("phone quiz preview", () => {
  const writeText = vi.fn(async () => {
    // Never reached.
  });
  let fetchSpy: MockInstance<typeof fetch>;

  beforeEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    writeText.mockClear();
  });

  it("runs a multi-question session and moves the progress", async () => {
    const user = userEvent.setup();
    render(<PhonePreview />);

    expect(screen.getByText("71/119")).toBeInTheDocument();
    expect(screen.getByText(/^Pytanie 83\./)).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /aktywne przypominanie i powtórki/ }),
    );
    await user.click(screen.getByRole("button", { name: "Sprawdź odpowiedź" }));
    expect(screen.getByText("Poprawna odpowiedź!")).toBeInTheDocument();
    expect(screen.getByText("72/119")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Następne pytanie" }));
    expect(screen.getByText(/^Pytanie 97\./)).toBeInTheDocument();

    // Back (an icon button with a tooltip) shows the answer just given,
    // checked; then returns.
    const back = document.querySelector("button:has(svg.lucide-undo-2)");
    expect(back).not.toBeNull();
    await user.click(back as HTMLElement);
    expect(screen.getByText(/^Pytanie 83\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Powrót do pytań" }));
    expect(screen.getByText(/^Pytanie 97\./)).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens the share dialog from fixtures without the clipboard or the API", async () => {
    const user = userEvent.setup();
    render(<PhonePreview />);

    await user.click(
      screen.getByRole("button", { name: "Więcej opcji quizu" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Udostępnij quiz" }),
    );

    const layer = portalLayer();
    expect(await within(layer).findByText("Ola Nowak")).toBeInTheDocument();
    await user.click(
      within(layer).getAllByRole("button", { name: "Kopiuj link" })[0],
    );

    expect(
      await screen.findByText(/w aplikacji link trafi do schowka/),
    ).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps settings in the preview and resets to zero", async () => {
    const user = userEvent.setup();
    render(<PhonePreview />);

    await user.click(
      screen.getByRole("button", { name: "Więcej opcji quizu" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Ustawienia" }),
    );
    const layer = portalLayer();
    expect(
      await within(layer).findByText("Ustawienia quizów"),
    ).toBeInTheDocument();
    // One more repetition per question: fewer questions count as mastered.
    await user.click(
      within(layer).getAllByRole("button", {
        name: "Zwiększ liczbę powtórzeń",
      })[0],
    );
    await waitFor(() => {
      expect(screen.getByText("69/119")).toBeInTheDocument();
    });
    await user.keyboard("{Escape}");

    await user.click(
      screen.getByRole("button", { name: "Więcej opcji quizu" }),
    );
    await user.click(
      await screen.findByRole("menuitem", { name: "Resetuj postęp" }),
    );
    expect(screen.getByText("0/119")).toBeInTheDocument();

    // The debounced settings write lands in the preview services.
    await new Promise((resolve) => {
      setTimeout(resolve, 700);
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
