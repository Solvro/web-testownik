import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  LegalDocumentKind,
  LegalDocumentVersionSummary,
  PendingLegalNotices,
} from "@testownik/core/legal/types";
import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppContext } from "@/app-context";
import type { AppContextType } from "@/app-context-type";
import { LegalNotice } from "@/components/legal/legal-notice";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({
  getPendingLegalNotices: vi.fn(),
  confirmLegalVersions: vi.fn(),
}));

const userService = {
  getPendingLegalNotices: mocks.getPendingLegalNotices,
  confirmLegalVersions: mocks.confirmLegalVersions,
};

vi.mock("next/navigation", () => ({ usePathname: () => "/quizzes" }));

vi.mock("@/services/client-services", () => ({
  servicesFor: () => ({ user: userService }),
  useServices: () => ({ user: userService }),
}));

function version(
  kind: LegalDocumentKind,
  effectiveFrom = "2026-01-15T12:00:00Z",
): LegalDocumentVersionSummary {
  return {
    id: `${kind}-id`,
    kind,
    version: 2,
    effective_from: effectiveFrom,
    requires_acceptance: kind === "terms",
    notify_users: kind === "privacy",
  };
}

function setup(pending: PendingLegalNotices) {
  mocks.getPendingLegalNotices.mockResolvedValue(pending);
  mocks.confirmLegalVersions.mockResolvedValue(null);
  const context = {
    user: { account_type: ACCOUNT_TYPE.STUDENT },
  } as unknown as AppContextType;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AppContext.Provider value={context}>
        <TooltipProvider>
          <LegalNotice />
        </TooltipProvider>
      </AppContext.Provider>
    </QueryClientProvider>,
  );
}

describe("LegalNotice", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("asks only for the terms when just they changed", async () => {
    setup({ terms: version("terms"), privacy: null });

    expect(
      await screen.findByText("Aktualizacja Regulaminu"),
    ).toBeInTheDocument();
    expect(screen.getByText(/akceptujesz go/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przeczytaj" })).toHaveAttribute(
      "href",
      "/terms/v/2",
    );
  });

  it("only informs about a privacy policy update", async () => {
    setup({ terms: null, privacy: version("privacy") });

    expect(
      await screen.findByText("Aktualizacja Polityki Prywatności"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/akceptujesz/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przeczytaj" })).toHaveAttribute(
      "href",
      "/privacy-policy/v/2",
    );
  });

  it("combines both updates and confirms them together", async () => {
    setup({ terms: version("terms"), privacy: version("privacy") });

    expect(
      await screen.findByText("Aktualizacja Regulaminu i Polityki Prywatności"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(
      screen.getByText(
        /^Od 15 stycznia 2026 r\. obowiązują nowy Regulamin i nowa Polityka Prywatności\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Regulamin" })).toHaveAttribute(
      "href",
      "/terms/v/2",
    );
    expect(
      screen.getByRole("link", { name: "Polityka Prywatności" }),
    ).toHaveAttribute("href", "/privacy-policy/v/2");

    await userEvent.click(screen.getByRole("button", { name: "Rozumiem" }));

    expect(mocks.confirmLegalVersions).toHaveBeenCalledWith([
      "terms-id",
      "privacy-id",
    ]);
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("gives both dates when the updates start on different days", async () => {
    setup({
      terms: version("terms"),
      privacy: version("privacy", "2026-01-10T12:00:00Z"),
    });

    expect(
      await screen.findByText(
        /^Od 15 stycznia 2026 r\. obowiązuje nowy Regulamin, a od 10 stycznia 2026 r\. obowiązuje nowa Polityka Prywatności\./,
      ),
    ).toBeInTheDocument();
  });

  it("stays hidden when nothing is pending", async () => {
    setup({ terms: null, privacy: null });

    await waitFor(() => {
      expect(mocks.getPendingLegalNotices).toHaveBeenCalled();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
