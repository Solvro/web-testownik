"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import { cn } from "@/lib/utils";
import { getUserService } from "@/services";
import type { AIAccountLimitRow } from "@/types/ai-admin";
import type { AccountLevel, AccountType } from "@/types/user";

import {
  accountLevelLabels,
  accountLevels,
  accountTypeLabels,
  accountTypes,
  aiAdminKeys as keys,
  limitCellKey,
  normalizeLimitRows,
} from "./config";
import {
  AdminLoading,
  FormSaveBar,
  QueryError,
  SectionHeading,
} from "./shared";

const creditLimitSchema = z
  .number()
  .int("Limit musi być liczbą całkowitą.")
  .min(0, "Limit nie może być ujemny.")
  .max(Number.MAX_SAFE_INTEGER, "Limit jest zbyt duży.");
const nullableCreditLimitSchema = z.union([z.null(), creditLimitSchema]);
const limitsFormSchema = z.object({
  rows: z.array(
    z.object({
      account_type: z.custom<AccountType>((value) =>
        accountTypes.includes(value as AccountType),
      ),
      account_level: z.custom<AccountLevel>((value) =>
        accountLevels.includes(value as AccountLevel),
      ),
      credits_session: nullableCreditLimitSchema,
      credits_weekly: nullableCreditLimitSchema,
      updated_at: z.string().nullable(),
    }),
  ),
});

export function LimitsPanel({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const limitsQuery = useQuery({
    queryKey: keys.limits,
    queryFn: async () => getUserService().getAIAdminLimits(),
    select: normalizeLimitRows,
    staleTime: 60_000,
  });

  if (limitsQuery.isPending) {
    return (
      <div className="space-y-4">
        <SectionHeading
          title="Macierz limitów"
          description="Zaznacz komórki, wiersz albo kolumnę, aby zmienić kilka limitów naraz."
        />
        <AdminLoading label="Ładowanie limitów" />
      </div>
    );
  }
  if (limitsQuery.isError) {
    return (
      <div className="space-y-4">
        <SectionHeading
          title="Macierz limitów"
          description="Limity według typu i poziomu konta."
        />
        <QueryError
          title="Nie udało się pobrać limitów"
          onRetry={() => void limitsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <LimitsForm initialRows={limitsQuery.data} onDirtyChange={onDirtyChange} />
  );
}

function LimitsForm({
  initialRows,
  onDirtyChange,
}: {
  initialRows: AIAccountLimitRow[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const defaultValues = useMemo(() => ({ rows: initialRows }), [initialRows]);
  const form = useForm({
    defaultValues,
    validators: [{ run: limitsFormSchema, triggers: ["change"] }],
    onSubmit: async ({ schemaOutputs, formApi }) => {
      try {
        const rows = await getUserService().updateAIAdminLimits(
          schemaOutputs[0].rows,
        );
        const normalizedRows = normalizeLimitRows(rows);
        queryClient.setQueryData(keys.limits, rows);
        formApi.reset({ rows: normalizedRows });
        void invalidateAIUsage(queryClient);
        toast.success("Macierz limitów została zapisana");
      } catch (error) {
        toast.error("Nie udało się zapisać macierzy limitów");
        throw error;
      }
    },
  });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkSession, setBulkSession] = useState<number | null>();
  const [bulkWeekly, setBulkWeekly] = useState<number | null>();
  const availableKeys = useMemo(
    () =>
      new Set(
        initialRows.map((row) =>
          limitCellKey(row.account_type, row.account_level),
        ),
      ),
    [initialRows],
  );
  const rowIndexByKey = useMemo(
    () =>
      new Map(
        initialRows.map((row, index) => [
          limitCellKey(row.account_type, row.account_level),
          index,
        ]),
      ),
    [initialRows],
  );
  const selectedCount = [...selected].filter((key) =>
    availableKeys.has(key),
  ).length;

  const toggleMany = (keysToToggle: string[], checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keysToToggle) {
        if (checked) {
          next.add(key);
        } else {
          next.delete(key);
        }
      }
      return next;
    });
  };
  const applyBulk = () => {
    form.setFieldValue("rows", (current) =>
      current.map((row) => {
        if (!selected.has(limitCellKey(row.account_type, row.account_level))) {
          return row;
        }
        return {
          ...row,
          ...(bulkSession === undefined
            ? {}
            : { credits_session: bulkSession }),
          ...(bulkWeekly === undefined ? {} : { credits_weekly: bulkWeekly }),
        };
      }),
    );
    setBulkSession(undefined);
    setBulkWeekly(undefined);
    toast.success(`Zmieniono ${selectedCount.toString()} pól macierzy`);
  };

  return (
    <div className="space-y-4">
      <SectionHeading title="Macierz limitów" />

      <Card
        role="region"
        aria-label="Macierz limitów według typu i poziomu konta"
        className="py-0"
      >
        <CardContent className="p-0">
          <div className="bg-muted/40 hidden grid-cols-[150px_repeat(3,minmax(0,1fr))] border-b md:grid">
            <div className="bg-muted sticky left-0 z-20 flex items-center gap-3 p-4 text-xs font-medium">
              <Checkbox
                aria-label="Zaznacz całą macierz"
                checked={
                  selectedCount === initialRows.length && initialRows.length > 0
                }
                indeterminate={
                  selectedCount > 0 && selectedCount < initialRows.length
                }
                onCheckedChange={(checked) => {
                  toggleMany([...availableKeys], checked);
                }}
              />
              Typ konta
            </div>
            {accountLevels.map((level) => {
              const columnKeys = initialRows
                .filter((row) => row.account_level === level)
                .map((row) =>
                  limitCellKey(row.account_type, row.account_level),
                );
              const columnSelectedCount = columnKeys.filter((key) =>
                selected.has(key),
              ).length;
              return (
                <div
                  key={level}
                  className="flex items-center gap-3 border-l p-4 text-sm font-semibold"
                >
                  <Checkbox
                    aria-label={`Zaznacz kolumnę ${accountLevelLabels[level]}`}
                    checked={
                      columnKeys.length > 0 &&
                      columnSelectedCount === columnKeys.length
                    }
                    indeterminate={
                      columnSelectedCount > 0 &&
                      columnSelectedCount < columnKeys.length
                    }
                    onCheckedChange={(checked) => {
                      toggleMany(columnKeys, checked);
                    }}
                  />
                  {accountLevelLabels[level]}
                </div>
              );
            })}
          </div>
          {accountTypes.map((accountType) => {
            const rowKeys = initialRows
              .filter((row) => row.account_type === accountType)
              .map((row) => limitCellKey(row.account_type, row.account_level));
            return (
              <div
                key={accountType}
                className="border-b last:border-b-0 md:grid md:grid-cols-[150px_repeat(3,minmax(0,1fr))]"
              >
                <div className="bg-muted/20 md:bg-background flex items-start gap-3 border-b p-4 md:border-b-0">
                  <Checkbox
                    aria-label={`Zaznacz wiersz ${accountTypeLabels[accountType]}`}
                    checked={
                      rowKeys.length > 0 &&
                      rowKeys.every((key) => selected.has(key))
                    }
                    indeterminate={
                      rowKeys.some((key) => selected.has(key)) &&
                      !rowKeys.every((key) => selected.has(key))
                    }
                    onCheckedChange={(checked) => {
                      toggleMany(rowKeys, checked);
                    }}
                  />
                  <p className="text-sm font-semibold">
                    {accountTypeLabels[accountType]}
                  </p>
                </div>
                {accountLevels.map((accountLevel) => {
                  const cellKey = limitCellKey(accountType, accountLevel);
                  const accessibleAccountType =
                    accountType === "email"
                      ? "Konto użytkownika"
                      : accountTypeLabels[accountType];
                  const rowIndex = rowIndexByKey.get(cellKey);
                  if (rowIndex === undefined) {
                    return (
                      <div
                        key={accountLevel}
                        className="text-muted-foreground border-t p-4 text-xs md:border-t-0 md:border-l"
                      >
                        Brak konfiguracji
                      </div>
                    );
                  }
                  return (
                    <div
                      key={accountLevel}
                      className={cn(
                        "relative space-y-3 border-t p-4 md:border-t-0 md:border-l",
                        selected.has(cellKey) && "bg-primary/5",
                      )}
                    >
                      <div className="absolute top-3 right-3">
                        <Checkbox
                          aria-label={`Zaznacz ${accountTypeLabels[accountType]} / ${accountLevelLabels[accountLevel]}`}
                          checked={selected.has(cellKey)}
                          onCheckedChange={(checked) => {
                            toggleMany([cellKey], checked);
                          }}
                        />
                      </div>
                      <p className="border-border/70 mb-3 border-b pr-8 pb-2 text-sm font-semibold md:hidden">
                        {accountLevelLabels[accountLevel]}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pr-7">
                        {(
                          [
                            ["credits_session", "Sesja"],
                            ["credits_weekly", "Tydzień"],
                          ] as const
                        ).map(([fieldName, label]) => (
                          <label key={fieldName} className="space-y-1">
                            <span className="text-muted-foreground text-xs font-medium">
                              {label}
                            </span>
                            <form.Field
                              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TanStack Form array paths require a numeric index.
                              name={`rows[${rowIndex}].${fieldName}`}
                            >
                              {(field) => (
                                <>
                                  <Input
                                    aria-label={`${accessibleAccountType} / ${accountLevelLabels[accountLevel]}: limit ${label.toLocaleLowerCase("pl-PL")}`}
                                    autoComplete="off"
                                    type="number"
                                    min="0"
                                    step="1"
                                    placeholder="Bez limitu"
                                    value={field.value ?? ""}
                                    onBlur={field.handleBlur}
                                    onChange={(event) => {
                                      field.handleChange(
                                        event.target.value === ""
                                          ? null
                                          : event.target.valueAsNumber,
                                      );
                                    }}
                                    className="h-8 text-xs tabular-nums"
                                  />
                                  <FieldError errors={field.errors} />
                                </>
                              )}
                            </form.Field>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardContent>
          <FieldGroup className="gap-4">
            <p className="text-sm font-medium">
              {selectedCount > 0
                ? `Edycja grupowa · ${selectedCount.toString()} zaznaczonych`
                : "Edycja grupowa"}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <Field>
                <FieldLabel htmlFor="bulk-session">Sesja</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="bulk-session"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={
                      bulkSession === null ? "Bez limitu" : "Bez zmian"
                    }
                    value={bulkSession ?? ""}
                    disabled={selectedCount === 0 || bulkSession === null}
                    onChange={(event) => {
                      setBulkSession(
                        event.target.value === ""
                          ? undefined
                          : event.target.valueAsNumber,
                      );
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={bulkSession === null ? "secondary" : "outline"}
                    disabled={selectedCount === 0}
                    aria-pressed={bulkSession === null}
                    onClick={() => {
                      setBulkSession((current) =>
                        current === null ? undefined : null,
                      );
                    }}
                  >
                    Bez limitu
                  </Button>
                </div>
              </Field>
              <Field>
                <FieldLabel htmlFor="bulk-weekly">Tydzień</FieldLabel>
                <div className="flex gap-2">
                  <Input
                    id="bulk-weekly"
                    type="number"
                    min="0"
                    step="1"
                    placeholder={
                      bulkWeekly === null ? "Bez limitu" : "Bez zmian"
                    }
                    value={bulkWeekly ?? ""}
                    disabled={selectedCount === 0 || bulkWeekly === null}
                    onChange={(event) => {
                      setBulkWeekly(
                        event.target.value === ""
                          ? undefined
                          : event.target.valueAsNumber,
                      );
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={bulkWeekly === null ? "secondary" : "outline"}
                    disabled={selectedCount === 0}
                    aria-pressed={bulkWeekly === null}
                    onClick={() => {
                      setBulkWeekly((current) =>
                        current === null ? undefined : null,
                      );
                    }}
                  >
                    Bez limitu
                  </Button>
                </div>
              </Field>
              <Button
                onClick={applyBulk}
                disabled={
                  selectedCount === 0 ||
                  (bulkSession === undefined && bulkWeekly === undefined)
                }
              >
                Zastosuj
              </Button>
            </div>
            <FieldDescription>
              Zaznacz komórki, wiersz lub kolumnę w macierzy, aby zastosować
              wspólne wartości.
            </FieldDescription>
          </FieldGroup>
        </CardContent>
      </Card>

      <FormSaveBar form={form} onDirtyChange={onDirtyChange} />
    </div>
  );
}
