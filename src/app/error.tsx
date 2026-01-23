"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircleIcon className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>Wystąpił nieoczekiwany błąd</EmptyTitle>
        <EmptyDescription>
          Przepraszamy, coś poszło nie tak. Spróbuj odświeżyć stronę.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="error-details" className="border-none">
            <AccordionTrigger className="justify-center gap-2 py-2 hover:no-underline">
              Szczegóły błędu
            </AccordionTrigger>
            <AccordionContent className="bg-muted rounded-md p-4 text-left">
              <pre className="overflow-auto text-xs wrap-break-word whitespace-pre-wrap">
                {error.message}
              </pre>
              {error.digest != null && error.digest !== "" ? (
                <p className="text-muted-foreground mt-2 text-xs">
                  Digest: {error.digest}
                </p>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex gap-2">
          <Button onClick={reset} variant="default">
            <RefreshCwIcon />
            Spróbuj ponownie
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = "/")}
          >
            Wróć do strony głównej
          </Button>
        </div>
        <EmptyDescription>
          Jeśli problem się powtarza, możesz utworzyć zgłoszenie na{" "}
          <a
            href="https://github.com/solvro/web-testownik/issues"
            target="_blank"
            rel="noreferrer"
          >
            GitHubie
          </a>
          .
        </EmptyDescription>
      </EmptyContent>
    </Empty>
  );
}
