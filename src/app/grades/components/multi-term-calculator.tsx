import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";

import { fmtNumber, gradeColor } from "./grade-utils";

export interface TermChip {
  id: string;
  name: string;
  average: number | null;
  ects: number;
  selected: boolean;
}

export function MultiTermCalculator({
  chips,
  combinedAverage,
  combinedEcts,
  combinedCount,
  allSelected,
  onToggleTerm,
  onToggleAll,
}: {
  chips: TermChip[];
  combinedAverage: number | null;
  combinedEcts: number;
  combinedCount: number;
  allSelected: boolean;
  onToggleTerm: (id: string) => void;
  onToggleAll: () => void;
}) {
  return (
    <div className="bg-card rounded-2xl border px-5 py-4.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-bold">Średnia z wielu semestrów</div>
          <p className="text-muted-foreground mt-1 text-xs">
            Zaznacz semestry, żeby policzyć ich łączną średnią ważoną.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onToggleAll}
        >
          {allSelected ? "Odznacz wszystkie" : "Zaznacz wszystkie"}
        </Button>
      </div>
      <div className="mt-3.5 flex flex-col gap-2">
        {chips.map((chip) => (
          <FieldLabel key={chip.id} htmlFor={`term-chip-${chip.id}`}>
            <Field orientation="horizontal">
              <Checkbox
                id={`term-chip-${chip.id}`}
                name={`term-chip-${chip.id}`}
                checked={chip.selected}
                onCheckedChange={() => {
                  onToggleTerm(chip.id);
                }}
              />
              <FieldContent>
                <FieldTitle className="truncate">{chip.name}</FieldTitle>
                <FieldDescription className="tabular-nums">
                  śr. {fmtNumber(chip.average)} · {chip.ects} ECTS
                </FieldDescription>
              </FieldContent>
            </Field>
          </FieldLabel>
        ))}
      </div>
      <div className="border-primary/20 bg-primary/10 mt-3.5 flex items-center gap-4.5 rounded-xl border px-4 py-3.5">
        <div>
          <div className="text-muted-foreground text-xs">Średnia łączona</div>
          <div
            className="text-3xl leading-none font-extrabold tabular-nums"
            style={{ color: gradeColor(combinedAverage).fg }}
          >
            {fmtNumber(combinedAverage, 3)}
          </div>
        </div>
        <Separator orientation="vertical" className="h-8" />
        <div className="text-muted-foreground text-xs leading-snug">
          z <b className="text-foreground">{combinedCount}</b> sem. ·{" "}
          <b className="text-foreground">{combinedEcts}</b> ECTS
        </div>
      </div>
    </div>
  );
}
