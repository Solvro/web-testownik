"use client";

import { Fragment } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useIsApplePlatform } from "@/lib/platform";

const groups: { title: string; shortcuts: [string[][], string][] }[] = [
  {
    title: "Quiz",
    shortcuts: [
      [[["Ctrl", "S"]], "Zapisz quiz"],
      [[["Ctrl", "Enter"]], "Następne pytanie albo nowe po ostatnim"],
      [[["Esc"]], "Zwiń otwarte pytanie i wróć do listy"],
    ],
  },
  {
    title: "Lista i spis pytań",
    shortcuts: [
      [[["↑"], ["↓"]], "Poprzednie lub następne pytanie"],
      [[["Home"], ["End"]], "Pierwsze lub ostatnie pytanie"],
      [[["Enter"]], "Otwórz pytanie i przejdź do jego treści"],
    ],
  },
  {
    title: "Odpowiedzi",
    shortcuts: [
      [[["Enter"]], "Następna odpowiedź albo nowa"],
      [[["Shift", "Enter"]], "Nowy wiersz w odpowiedzi"],
      [[["Backspace"]], "Usuń pustą odpowiedź"],
    ],
  },
  {
    title: "Formatowanie",
    shortcuts: [
      [[["Ctrl", "Z"]], "Cofnij zmianę w pytaniu"],
      [[["Ctrl", "Shift", "Z"]], "Ponów zmianę w pytaniu"],
      [[["Ctrl", "B"]], "Pogrubienie"],
      [[["Ctrl", "I"]], "Kursywa"],
      [[["Ctrl", "E"]], "Kod"],
      [[["Ctrl", "K"]], "Link"],
      [[["←"], ["→"]], "Przyciski na pasku formatowania"],
    ],
  },
];

const appleKeys: Record<string, string> = { Ctrl: "⌘", Shift: "⇧" };

/** Lists the editor's keyboard shortcuts, with the keys of the system in use. Opened from the quiz menu. */
export function KeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apple = useIsApplePlatform();
  const keyLabel = (key: string) => (apple ? (appleKeys[key] ?? key) : key);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Skróty klawiszowe</DialogTitle>
        </DialogHeader>
        {groups.map((group) => (
          <section key={group.title} className="space-y-2">
            <h3 className="text-sm font-semibold">{group.title}</h3>
            <dl className="divide-border divide-y text-sm">
              {group.shortcuts.map(([combos, description]) => (
                <div
                  key={description}
                  className="flex items-center justify-between gap-4 py-1.5"
                >
                  <dt className="text-muted-foreground">{description}</dt>
                  <dd className="flex shrink-0 items-center gap-1.5">
                    {combos.map((keys, index) => (
                      <Fragment key={keys.join("+")}>
                        {index > 0 ? (
                          <span className="text-muted-foreground text-xs">
                            lub
                          </span>
                        ) : null}
                        <KbdGroup>
                          {keys.map((key) => (
                            <Kbd key={key}>{keyLabel(key)}</Kbd>
                          ))}
                        </KbdGroup>
                      </Fragment>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
