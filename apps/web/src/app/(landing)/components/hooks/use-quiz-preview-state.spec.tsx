import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MockInstance } from "vitest";

import { PhoneQuizSurface } from "@/app/(landing)/preview/product-surfaces";

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

function PhonePreview({
  syncChannel,
}: {
  syncChannel?: string;
}): React.JSX.Element {
  const session = useQuizPreviewState({ syncChannel });
  return (
    <PhoneQuizSurface
      session={session}
      standalone={syncChannel !== undefined}
    />
  );
}

/** The header's ☰; the quiz info card further down has its own. */
function headerMenu(): HTMLElement {
  return screen.getAllByRole("button", { name: "Więcej opcji quizu" })[0];
}

/**
 * The action row docked at the bottom of the phone screen. The question
 * card's own row is hidden by the screen's CSS, which the test DOM does not
 * apply, so queries for the quiz controls are scoped to the docked one.
 */
function dockedActions(container: ParentNode = document): HTMLElement {
  const row = container.querySelector<HTMLElement>("[data-phone-quiz-actions]");
  if (row === null) {
    throw new Error("missing docked action row");
  }
  return row;
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
    const actions = within(dockedActions());
    await user.click(
      actions.getByRole("button", { name: "Sprawdź odpowiedź" }),
    );
    expect(screen.getByText("Poprawna odpowiedź!")).toBeInTheDocument();
    expect(screen.getByText("72/119")).toBeInTheDocument();

    await user.click(actions.getByRole("button", { name: "Następne pytanie" }));
    expect(screen.getByText(/^Pytanie 97\./)).toBeInTheDocument();

    // Back shows the answer just given, checked; then returns.
    await user.click(
      actions.getByRole("button", { name: "Poprzednie pytanie" }),
    );
    expect(screen.getByText(/^Pytanie 83\./)).toBeInTheDocument();
    await user.click(actions.getByRole("button", { name: "Powrót do pytań" }));
    expect(screen.getByText(/^Pytanie 97\./)).toBeInTheDocument();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("hides the question card's own action row behind the docked one", () => {
    render(<PhonePreview />);

    const cardRow = document.querySelector("[data-slot=question-card-actions]");
    expect(cardRow).not.toBeNull();
    // The screen hides it with a variant on an ancestor, not a prop.
    let ancestor = cardRow?.parentElement ?? null;
    while (
      ancestor !== null &&
      !ancestor.classList.contains(
        "[&_[data-slot=question-card-actions]]:hidden",
      )
    ) {
      ancestor = ancestor.parentElement;
    }
    expect(ancestor).not.toBeNull();
    expect(dockedActions()).not.toContainElement(cardRow as HTMLElement);
  });

  it.each([false, true])(
    "lays out and mounts overlays inside the phone screen (standalone: %s)",
    async (standalone) => {
      const user = userEvent.setup();
      const { container } = render(
        <PhonePreview syncChannel={standalone ? "spec-layout" : undefined} />,
      );

      const sandbox = container.querySelector("[data-preview-sandbox]");
      expect(sandbox?.className).toContain(
        "[&_[data-slot=dialog-footer]]:flex-col-reverse",
      );
      await user.click(headerMenu());
      const menu = await screen.findByRole("menu");
      expect(sandbox).toContainElement(menu);
      await user.click(
        await screen.findByRole("menuitem", { name: "Udostępnij quiz" }),
      );
      expect(sandbox).toContainElement(await screen.findByRole("dialog"));
    },
  );

  it("opens the share dialog from fixtures without the clipboard or the API", async () => {
    const user = userEvent.setup();
    render(<PhonePreview />);

    await user.click(headerMenu());
    await user.click(
      await screen.findByRole("menuitem", { name: "Udostępnij quiz" }),
    );

    const layer = portalLayer();
    expect(await within(layer).findByText("Ola Nowak")).toBeInTheDocument();
    await user.click(
      within(layer).getAllByRole("button", { name: "Kopiuj link" })[0],
    );

    expect(
      await screen.findByText(/W aplikacji link trafi do schowka/),
    ).toBeInTheDocument();
    expect(writeText).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps settings in the preview and resets to zero", async () => {
    const user = userEvent.setup();
    render(<PhonePreview />);

    await user.click(headerMenu());
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

    await user.click(headerMenu());
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

  it.runIf(typeof BroadcastChannel !== "undefined")(
    "keeps two screens on one channel in step",
    async () => {
      const user = userEvent.setup();
      const first = render(<PhonePreview syncChannel="spec-sync" />);
      const second = render(<PhonePreview syncChannel="spec-sync" />);
      const left = within(first.container);
      const right = within(second.container);

      await user.click(
        left.getByRole("button", {
          name: /aktywne przypominanie i powtórki/,
        }),
      );
      await user.click(
        within(dockedActions(first.container)).getByRole("button", {
          name: "Sprawdź odpowiedź",
        }),
      );
      expect(left.getByText("Poprawna odpowiedź!")).toBeInTheDocument();
      expect(await right.findByText("Poprawna odpowiedź!")).toBeInTheDocument();
      expect(right.getByText("72/119")).toBeInTheDocument();

      // And back the other way.
      await user.click(
        within(dockedActions(second.container)).getByRole("button", {
          name: "Następne pytanie",
        }),
      );
      expect(await left.findByText(/^Pytanie 97\./)).toBeInTheDocument();

      // A screen that joins late adopts the session so far.
      const late = within(
        render(<PhonePreview syncChannel="spec-sync" />).container,
      );
      expect(await late.findByText(/^Pytanie 97\./)).toBeInTheDocument();
    },
  );
});
