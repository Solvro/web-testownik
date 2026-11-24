"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LegalDocumentVersionSummary,
  PendingLegalNotices,
} from "@testownik/core/legal/types";
import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import { ScrollTextIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useContext } from "react";

import { AppContext } from "@/app-context";
import { NoticeDismissButton } from "@/components/compact-notice";
import { Button, ButtonLink } from "@/components/ui/button";
import { servicesFor, useServices } from "@/services/client-services";

import { LEGAL_PAGES, formatLegalDate } from "./legal-pages";

const PENDING_QUERY_KEY = ["legal-pending"];
const NOTHING_PENDING: PendingLegalNotices = { terms: null, privacy: null };

function startsIn(
  version: LegalDocumentVersionSummary,
  { plural = false } = {},
): string {
  const date = formatLegalDate(version.effective_from);
  const upcoming = new Date(version.effective_from) > new Date();
  const verb = upcoming
    ? plural
      ? "będą obowiązywać"
      : "będzie obowiązywać"
    : plural
      ? "obowiązują"
      : "obowiązuje";
  return `od ${date} ${verb}`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function versionPath(version: LegalDocumentVersionSummary): string {
  return `${LEGAL_PAGES[version.kind].path}/v/${version.version.toString()}`;
}

function getNoticeCopy({ terms, privacy }: PendingLegalNotices) {
  if (terms !== null && privacy !== null) {
    const sameDate =
      formatLegalDate(terms.effective_from) ===
      formatLegalDate(privacy.effective_from);
    const dates = sameDate
      ? `${capitalize(startsIn(terms, { plural: true }))} nowy Regulamin i nowa Polityka Prywatności.`
      : `${capitalize(startsIn(terms))} nowy Regulamin, a ${startsIn(privacy)} nowa Polityka Prywatności.`;
    return {
      title: "Aktualizacja Regulaminu i Polityki Prywatności",
      text: `${dates} Korzystając dalej z Testownika, akceptujesz nowy Regulamin.`,
      dismissLabel: "Rozumiem i akceptuję Regulamin",
    };
  }
  if (terms !== null) {
    return {
      title: "Aktualizacja Regulaminu",
      text: `${capitalize(startsIn(terms))} nowy Regulamin. Korzystając dalej z Testownika, akceptujesz go.`,
      dismissLabel: "Rozumiem i akceptuję",
    };
  }
  if (privacy !== null) {
    return {
      title: "Aktualizacja Polityki Prywatności",
      text: `${capitalize(startsIn(privacy))} nowa Polityka Prywatności.`,
      dismissLabel: "Rozumiem",
    };
  }
  return null;
}

/** Tells signed-in users once about new terms and privacy policy versions. */
export function LegalNotice(): React.JSX.Element | null {
  const { user } = useContext(AppContext);
  const pathname = usePathname();
  const isEligible = user !== null && user.account_type !== ACCOUNT_TYPE.GUEST;

  const { data: pending } = useQuery({
    queryKey: PENDING_QUERY_KEY,
    queryFn: async ({ client }) =>
      await servicesFor(client).user.getPendingLegalNotices(),
    enabled: isEligible,
    staleTime: 60 * 60 * 1000,
  });

  const queryClient = useQueryClient();
  const { user: userService } = useServices();
  const confirm = useMutation({
    mutationFn: async (versionIds: string[]) => {
      await userService.confirmLegalVersions(versionIds);
    },
    onSuccess: () => {
      queryClient.setQueryData(PENDING_QUERY_KEY, NOTHING_PENDING);
    },
  });

  const versions = [pending?.terms, pending?.privacy].filter(
    (version): version is LegalDocumentVersionSummary => version != null,
  );

  const copy = pending === undefined ? null : getNoticeCopy(pending);

  if (
    !isEligible ||
    copy === null ||
    pathname === "/" ||
    pathname === "/login"
  ) {
    return null;
  }

  const confirmPending = () => {
    confirm.mutate(versions.map((version) => version.id));
  };

  return (
    <div
      role="status"
      data-slot="legal-notice"
      className="bg-primary/5 border-primary/30 relative flex flex-col gap-3 rounded-lg border p-3 pr-10 md:flex-row md:items-center md:gap-6 md:p-4 md:pr-12"
    >
      <div className="flex min-w-0 flex-1 gap-3">
        <ScrollTextIcon
          aria-hidden
          className="text-primary mt-0.5 size-5 shrink-0"
        />
        <div className="min-w-0">
          <p className="font-medium">{copy.title}</p>
          <p className="text-muted-foreground text-sm text-pretty">
            {copy.text}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 pl-8 md:pl-0">
        <Button size="sm" disabled={confirm.isPending} onClick={confirmPending}>
          Rozumiem
        </Button>
        {versions.map((version) => (
          <ButtonLink
            key={version.id}
            size="sm"
            variant="outline"
            href={versionPath(version)}
          >
            {versions.length === 1
              ? "Przeczytaj"
              : version.kind === "terms"
                ? "Regulamin"
                : "Polityka Prywatności"}
          </ButtonLink>
        ))}
      </div>
      <div className="absolute top-1 right-1">
        <NoticeDismissButton
          label={copy.dismissLabel}
          isDisabled={confirm.isPending}
          onDismiss={confirmPending}
        />
      </div>
    </div>
  );
}
