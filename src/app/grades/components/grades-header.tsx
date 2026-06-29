import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { fmtNumber, gradeColor } from "./grade-utils";

export interface TermOption {
  id: string;
  name: string;
  average: number | null;
  current: boolean;
}

export function GradesHeader({
  termOptions,
  disabled,
  onSelectTerm,
}: {
  termOptions: TermOption[];
  disabled: boolean;
  onSelectTerm: (id: string) => void;
}) {
  const selectedId = termOptions.find((option) => option.current)?.id ?? "";

  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <h1 className="text-2xl leading-tight font-extrabold tracking-tight sm:mt-1.5 sm:text-3xl">
        Twoje oceny i średnia
      </h1>

      <Select
        value={selectedId}
        onValueChange={(value) => {
          if (typeof value === "string" && value.length > 0) {
            onSelectTerm(value);
          }
        }}
        items={termOptions.map((option) => ({
          label: option.name,
          value: option.id,
        }))}
        disabled={disabled}
      >
        <SelectTrigger
          className="min-w-60"
          size="default"
          aria-label="Wybierz semestr"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" alignItemWithTrigger>
          <SelectGroup>
            <SelectLabel>Wybierz semestr</SelectLabel>
            {termOptions.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                <span className="flex-1 truncate">{option.name}</span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: gradeColor(option.average).fg }}
                >
                  {fmtNumber(option.average)}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
