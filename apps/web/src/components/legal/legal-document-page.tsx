import type {
  LegalDocumentKind,
  LegalDocumentVersion,
  LegalDocumentVersionSummary,
} from "@testownik/core/legal/types";
import { CalendarClockIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import {
  getLegalArchiveSSR,
  getLegalDocumentSSR,
  getLegalVersionSSR,
} from "@/lib/legal";

import { LegalMarkdown } from "./legal-markdown";
import { LEGAL_PAGES, formatLegalDate } from "./legal-pages";

function versionPath(kind: LegalDocumentKind, version: number): string {
  return `${LEGAL_PAGES[kind].path}/v/${version.toString()}`;
}

function Unavailable({ kind }: { kind: LegalDocumentKind }) {
  return (
    <Card>
      <CardContent className="prose prose-sm lg:prose-base dark:prose-invert max-w-none">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">
          {LEGAL_PAGES[kind].title}
        </h1>
        <p>
          Nie udało się wczytać dokumentu. Spróbuj ponownie za chwilę albo
          napisz na <a href="mailto:testownik@solvro.pl">testownik@solvro.pl</a>
          .
        </p>
      </CardContent>
    </Card>
  );
}

function LegalDocumentView({
  document,
  status,
  upcoming,
  archive,
}: {
  document: LegalDocumentVersion;
  status: React.ReactNode;
  upcoming?: LegalDocumentVersionSummary | null;
  archive: LegalDocumentVersionSummary[];
}) {
  const others = archive.filter((version) => version.id !== document.id);
  return (
    <Card>
      <CardContent className="prose prose-sm lg:prose-base dark:prose-invert max-w-none">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">
          {LEGAL_PAGES[document.kind].title}
        </h1>
        <p className="text-muted-foreground text-sm italic">{status}</p>
        {upcoming == null ? null : (
          <Alert className="not-prose mb-6">
            <CalendarClockIcon />
            <AlertTitle>
              Od {formatLegalDate(upcoming.effective_from)} obowiązuje nowa
              wersja
            </AlertTitle>
            <AlertDescription>
              <Link
                href={versionPath(upcoming.kind, upcoming.version)}
                className="underline underline-offset-2"
              >
                Zobacz nową wersję
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <LegalMarkdown>{document.content}</LegalMarkdown>
        {others.length === 0 ? null : (
          <>
            <h2 id="archiwum">Inne wersje</h2>
            <ul>
              {others.map((version) => (
                <li key={version.id}>
                  <Link href={versionPath(version.kind, version.version)}>
                    Wersja {version.version} z{" "}
                    {formatLegalDate(version.effective_from)}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** The version in force now, with the next one announced above it. */
export async function CurrentLegalDocument({
  kind,
}: {
  kind: LegalDocumentKind;
}) {
  const [document, archive] = await Promise.all([
    getLegalDocumentSSR(kind),
    getLegalArchiveSSR(kind),
  ]);
  if (document?.current == null) {
    return <Unavailable kind={kind} />;
  }
  return (
    <LegalDocumentView
      document={document.current}
      upcoming={document.upcoming}
      archive={archive}
      status={`Obowiązuje od ${formatLegalDate(document.current.effective_from)}`}
    />
  );
}

/** One version from the archive, which may also be an announced one. */
export async function ArchivedLegalDocument({
  kind,
  version,
}: {
  kind: LegalDocumentKind;
  version: number;
}) {
  const [document, current, archive] = await Promise.all([
    getLegalVersionSSR(kind, version),
    getLegalDocumentSSR(kind),
    getLegalArchiveSSR(kind),
  ]);
  if (document === null) {
    notFound();
  }
  const date = formatLegalDate(document.effective_from);
  const isCurrent = current?.current?.id === document.id;
  const isUpcoming = new Date(document.effective_from) > new Date();
  const label = isCurrent
    ? `obowiązuje od ${date}`
    : isUpcoming
      ? `będzie obowiązywać od ${date}`
      : `obowiązywała od ${date}`;
  return (
    <LegalDocumentView
      document={document}
      archive={archive}
      status={
        <>
          Wersja {document.version} – {label}{" "}
          {isCurrent ? null : (
            <Link href={LEGAL_PAGES[kind].path} className="not-italic">
              Zobacz obowiązującą wersję
            </Link>
          )}
        </>
      }
    />
  );
}
