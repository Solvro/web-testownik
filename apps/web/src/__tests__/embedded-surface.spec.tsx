import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FocusModeOnboardingDialog } from "@/components/quiz/focus-mode-onboarding-dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  EmbeddedSurfaceContext,
  isEventForSurface,
} from "@/components/ui/portal-container";
import type { EmbeddedSurface } from "@/components/ui/portal-container";

/**
 * Base UI renders this full-viewport pointer blocker only for fully modal
 * overlays, the ones that also lock the page's scroll.
 */
function fullyModalBlocker(): Element | null {
  return document.querySelector(
    '[role="presentation"][data-base-ui-inert]:not([data-slot])',
  );
}

function isPageScrollLocked(): boolean {
  const { documentElement: html, body } = document;
  return html.style.overflowY === "hidden" || body.style.overflowY === "hidden";
}

afterEach(async () => {
  cleanup();
  document.body.replaceChildren();
  // Base UI releases the scroll lock on a timeout after the overlay unmounts.
  await waitFor(() => {
    expect(isPageScrollLocked()).toBe(false);
  });
});

function makeSurface(
  modal?: EmbeddedSurface["modal"],
): EmbeddedSurface & { root: HTMLElement; portalContainer: HTMLElement } {
  const root = document.createElement("div");
  const portalContainer = document.createElement("div");
  document.body.append(root, portalContainer);
  return { root, portalContainer, modal };
}

function renderIn(surface: EmbeddedSurface | null, node: ReactNode) {
  return render(
    <EmbeddedSurfaceContext value={surface}>{node}</EmbeddedSurfaceContext>,
  );
}

function openDialog(props: { modal?: boolean | "trap-focus" } = {}) {
  return (
    <Dialog open {...props}>
      <DialogContent>
        <DialogTitle>Okno</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe("dialogs in an embedded surface", () => {
  it("are fully modal and portal to the body outside a surface", async () => {
    renderIn(null, openDialog());
    const dialog = await screen.findByRole("dialog");
    expect(dialog.parentElement?.closest("body")).toBe(document.body);
    expect(fullyModalBlocker()).not.toBeNull();
    await waitFor(() => {
      expect(isPageScrollLocked()).toBe(true);
    });
  });

  it("take the surface's modality and mount in its container", async () => {
    const surface = makeSurface("trap-focus");
    renderIn(surface, openDialog());
    const dialog = await screen.findByRole("dialog");
    expect(surface.portalContainer).toContainElement(dialog);
    expect(fullyModalBlocker()).toBeNull();
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    // A lock would be applied on a timeout too; give it the chance.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(isPageScrollLocked()).toBe(false);
  });

  it("keep the default modality in a surface without a policy", async () => {
    const surface = makeSurface();
    renderIn(surface, openDialog());
    const dialog = await screen.findByRole("dialog");
    expect(surface.portalContainer).toContainElement(dialog);
    expect(fullyModalBlocker()).not.toBeNull();
  });

  it("let an explicit modal prop win over the surface", async () => {
    renderIn(makeSurface("trap-focus"), openDialog({ modal: true }));
    await screen.findByRole("dialog");
    expect(fullyModalBlocker()).not.toBeNull();
  });
});

describe("alert dialogs in an embedded surface", () => {
  function openAlertDialog() {
    return (
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Na pewno?</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  it("are fully modal outside a surface", async () => {
    renderIn(null, openAlertDialog());
    await screen.findByRole("alertdialog");
    expect(fullyModalBlocker()).not.toBeNull();
  });

  it("follow the surface's modality and stay alert dialogs", async () => {
    const surface = makeSurface("trap-focus");
    renderIn(surface, openAlertDialog());
    const dialog = await screen.findByRole("alertdialog");
    expect(surface.portalContainer).toContainElement(dialog);
    expect(fullyModalBlocker()).toBeNull();
  });
});

describe("focus-mode onboarding in an embedded surface", () => {
  it("keeps focus in the surface without locking the page's scroll", async () => {
    const surface = makeSurface("trap-focus");
    renderIn(
      surface,
      <FocusModeOnboardingDialog
        open
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        onConfirmAndHide={vi.fn()}
      />,
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Czym jest tryb skupienia?",
    });
    expect(surface.portalContainer).toContainElement(dialog);
    await waitFor(() => {
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(isPageScrollLocked()).toBe(false);
    expect(fullyModalBlocker()).toBeNull();
  });
});

describe("menus in an embedded surface", () => {
  function openMenu() {
    return (
      <DropdownMenu open>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Pozycja</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it("are modal outside a surface", async () => {
    renderIn(null, openMenu());
    await screen.findByRole("menu");
    expect(fullyModalBlocker()).not.toBeNull();
  });

  it("treat a trap-focus surface as non-modal", async () => {
    const surface = makeSurface("trap-focus");
    renderIn(surface, openMenu());
    const menu = await screen.findByRole("menu");
    expect(surface.portalContainer).toContainElement(menu);
    expect(fullyModalBlocker()).toBeNull();
  });
});

describe("isEventForSurface", () => {
  it("accepts every event outside a surface", () => {
    const event = new KeyboardEvent("keydown");
    expect(isEventForSurface(null, event)).toBe(true);
  });

  it("accepts only events from the surface or its overlays", () => {
    const surface = makeSurface();
    const outside = document.createElement("button");
    document.body.append(outside);
    const inOverlay = document.createElement("button");
    surface.portalContainer.append(inOverlay);

    const dispatchFrom = (target: HTMLElement) => {
      let result: boolean | undefined;
      target.addEventListener("keydown", (event) => {
        result = isEventForSurface(surface, event);
      });
      target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
      return result;
    };

    expect(dispatchFrom(surface.root)).toBe(true);
    expect(dispatchFrom(inOverlay)).toBe(true);
    expect(dispatchFrom(outside)).toBe(false);
  });
});
