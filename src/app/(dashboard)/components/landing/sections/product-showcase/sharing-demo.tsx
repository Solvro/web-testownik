"use client";

import { Check, Copy, Link2, LockKeyhole, Share2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../../components/focus";
import { MonoLabel } from "../../components/typography";
import { DemoHeader, DemoPanel } from "./demo-panel";

type Access = "view" | "edit";

interface Grantee {
  id: string;
  name: string;
  detail: string;
  initials: string;
  access: Access;
}

const INITIAL_GRANTEES: Grantee[] = [
  {
    id: "solvro",
    name: "KN Solvro",
    detail: "12 osób",
    initials: "SO",
    access: "edit",
  },
  {
    id: "grupa",
    name: "Grupa SI",
    detail: "28 osób",
    initials: "PE",
    access: "view",
  },
  {
    id: "ola",
    name: "Ola Kowalska",
    detail: "ola@pwr.edu.pl",
    initials: "OK",
    access: "view",
  },
];

const ACCESS_OPTIONS: { value: Access; label: string }[] = [
  { value: "view", label: "Odczyt" },
  { value: "edit", label: "Edycja" },
];

const COPY_FEEDBACK_MS = 1400;

/**
 * A working stand-in for the share dialog. It is the one scene with no real
 * component behind it, so it is kept deliberately small: pick an access level,
 * copy the link, nothing else.
 */
export function SharingDemo(): React.JSX.Element {
  const [grantees, setGrantees] = useState(INITIAL_GRANTEES);
  const [hasCopied, setHasCopied] = useState(false);

  const setAccess = (id: string, access: Access): void => {
    setGrantees((current) =>
      current.map((grantee) =>
        grantee.id === id ? { ...grantee, access } : grantee,
      ),
    );
  };

  return (
    <DemoPanel>
      <DemoHeader>
        <div className="flex items-center gap-[0.7rem]">
          <Share2 aria-hidden="true" className="text-primary size-5" />
          <span className="text-muted-foreground flex flex-col">
            <strong className="text-foreground">Udostępnij quiz</strong>
            Quiz ze sztucznej
          </span>
        </div>
        <span className="border-border text-muted-foreground inline-flex items-center gap-[0.4rem] rounded-full border px-[0.65rem] py-2 text-[0.72rem]">
          <LockKeyhole aria-hidden="true" className="size-[0.8rem]" />
          Prywatny
        </span>
      </DemoHeader>

      <div className="border-border bg-secondary mt-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-[0.7rem] rounded-[0.6rem] border px-[0.9rem] py-[0.8rem] sm:grid-cols-[auto_1fr_auto]">
        <Link2 aria-hidden="true" className="text-primary size-4" />
        <span className="text-muted-foreground overflow-hidden text-ellipsis whitespace-nowrap">
          testownik.solvro.pl/quiz/21fcce34…
        </span>
        <button
          type="button"
          onClick={() => {
            setHasCopied(true);
            window.setTimeout(() => {
              setHasCopied(false);
            }, COPY_FEEDBACK_MS);
          }}
          className={cn(
            "bg-primary text-primary-foreground col-span-full inline-flex items-center justify-center gap-[0.4rem] rounded-[0.45rem] px-[0.7rem] py-[0.55rem] font-bold sm:col-auto [&_svg]:size-[0.85rem]",
            FOCUS_RING,
          )}
        >
          {hasCopied ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          {hasCopied ? "Skopiowano" : "Kopiuj link"}
        </button>
      </div>

      <div className="mt-8">
        <MonoLabel size="xs" className="mb-[0.65rem] block">
          OSOBY I GRUPY Z DOSTĘPEM
        </MonoLabel>
        {grantees.map((grantee) => (
          <div
            key={grantee.id}
            className="border-border grid grid-cols-[2.4rem_1fr] items-center gap-[0.8rem] border-b py-[0.8rem] sm:grid-cols-[2.4rem_1fr_auto]"
          >
            <span className="bg-secondary text-primary grid size-[2.4rem] place-items-center rounded-[0.55rem] font-[750]">
              {grantee.initials}
            </span>
            <span className="text-muted-foreground flex flex-col">
              <strong className="text-foreground">{grantee.name}</strong>
              {grantee.detail}
            </span>
            <div className="col-span-full flex gap-[0.35rem] sm:col-auto">
              {ACCESS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={grantee.access === option.value}
                  onClick={() => {
                    setAccess(grantee.id, option.value);
                  }}
                  className={cn(
                    "border-border text-foreground rounded-[0.42rem] border px-[0.68rem] py-2",
                    "aria-pressed:border-primary aria-pressed:text-primary aria-pressed:bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))]",
                    FOCUS_RING,
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DemoPanel>
  );
}
