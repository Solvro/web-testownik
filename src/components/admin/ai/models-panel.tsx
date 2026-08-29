"use client";

import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { invalidateAIModels } from "@/hooks/use-ai-models";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import { getUserService } from "@/services";
import type { AIModelRow } from "@/types/ai-admin";
import { ACCOUNT_LEVELS, ACCOUNT_LEVEL_LABELS } from "@/types/user";
import type { AccountLevel } from "@/types/user";

import { aiAdminKeys as keys, normalizeModelRows } from "./config";
import {
  AdminLoading,
  FormSaveBar,
  QueryError,
  SectionHeading,
} from "./shared";

const providers = [
  { label: "OpenAI", value: "openai" },
  { label: "Anthropic", value: "anthropic" },
  { label: "xAI", value: "xai" },
] as const;

const weightSchema = z
  .string()
  .trim()
  .min(1, "Wpisz wagę.")
  .pipe(
    z.coerce
      .number<string>()
      .min(0, "Waga nie może być ujemna.")
      .max(999_999.999_999, "Waga jest zbyt duża."),
  )
  .transform(String);

const modelSchema = z.object({
  model: z.string().trim().min(1, "Wpisz identyfikator.").max(100),
  label: z.string().trim().min(1, "Wpisz nazwę.").max(100),
  provider: z.enum(["openai", "anthropic", "xai"]),
  minimum_account_level: z.enum(["basic", "silver", "gold"]),
  input_weight: weightSchema,
  output_weight: weightSchema,
  cached_weight: weightSchema,
  active: z.boolean(),
});
const modelsFormSchema = z.object({ rows: z.array(modelSchema) });

const newModelDefaults: AIModelRow = {
  model: "",
  label: "",
  provider: "openai" as const,
  minimum_account_level: "basic" as const,
  input_weight: "1",
  output_weight: "1",
  cached_weight: "0",
  active: false,
};

function mergeModelRow(rows: AIModelRow[], row: AIModelRow) {
  return normalizeModelRows([
    ...rows.filter((current) => current.model !== row.model),
    row,
  ]).toSorted(
    (left, right) =>
      left.provider.localeCompare(right.provider) ||
      left.model.localeCompare(right.model),
  );
}

export function ModelsPanel({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const modelsQuery = useQuery({
    queryKey: keys.models,
    queryFn: async () => getUserService().getAIAdminModels(),
    select: normalizeModelRows,
    staleTime: 60_000,
  });

  if (modelsQuery.isPending) {
    return (
      <div className="space-y-4">
        <SectionHeading title="Modele" />
        <AdminLoading label="Ładowanie modeli" />
      </div>
    );
  }
  if (modelsQuery.isError) {
    return (
      <div className="space-y-4">
        <SectionHeading title="Modele" />
        <QueryError
          title="Nie udało się pobrać modeli"
          onRetry={() => void modelsQuery.refetch()}
        />
      </div>
    );
  }

  return (
    <ModelsForm initialRows={modelsQuery.data} onDirtyChange={onDirtyChange} />
  );
}

function ModelsForm({
  initialRows,
  onDirtyChange,
}: {
  initialRows: AIModelRow[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const defaultValues = useMemo(() => ({ rows: initialRows }), [initialRows]);
  const form = useForm({
    defaultValues,
    validators: [{ run: modelsFormSchema, triggers: ["change"] }],
    onSubmit: async ({ schemaOutputs, formApi }) => {
      try {
        const rows = await getUserService().updateAIAdminModels(
          schemaOutputs[0].rows,
        );
        const normalizedRows = normalizeModelRows(rows);
        queryClient.setQueryData(keys.models, normalizedRows);
        formApi.reset({ rows: normalizedRows });
        void invalidateAIModels(queryClient);
        void invalidateAIUsage(queryClient);
        toast.success("Modele zostały zapisane");
      } catch (error) {
        toast.error("Nie udało się zapisać modeli");
        throw error;
      }
    },
  });
  const deleteModel = useMutation({
    mutationFn: async (model: string) =>
      getUserService().deleteAIAdminModel(model),
    onSuccess: (_, deletedModel) => {
      const savedRows = form.defaultValues.rows.filter(
        (row) => row.model !== deletedModel,
      );
      const draftRows = form.state.values.rows.filter(
        (row) => row.model !== deletedModel,
      );
      const wasDirty = !form.state.isDefaultValue;
      queryClient.setQueryData(keys.models, savedRows);
      form.reset({ rows: savedRows });
      if (wasDirty) {
        form.setFieldValue("rows", draftRows);
      }
      void invalidateAIModels(queryClient);
      void invalidateAIUsage(queryClient);
      toast.success("Model został usunięty z katalogu");
    },
    onError: () => {
      toast.error(
        "Nie udało się usunąć modelu. Najpierw zmień model domyślny lub zapasowy, jeśli jest używany w ustawieniach.",
      );
    },
  });

  return (
    <div className="space-y-4">
      <SectionHeading
        title="Modele"
        description="Mnożniki przeliczają tokeny na kredyty. Wartość 2 oznacza 2 kredyty za token."
        action={
          <Button
            size="sm"
            variant={adding ? "ghost" : "outline"}
            onClick={() => {
              setAdding((current) => !current);
            }}
          >
            {adding ? <XIcon /> : <PlusIcon />}
            {adding ? "Zamknij" : "Dodaj model"}
          </Button>
        }
      />

      {adding ? (
        <CreateModelForm
          onCreated={(row) => {
            const draftRows = form.state.values.rows;
            const wasDirty = !form.state.isDefaultValue;
            const savedRows = mergeModelRow(form.defaultValues.rows, row);
            queryClient.setQueryData(keys.models, savedRows);
            form.reset({ rows: savedRows });
            if (wasDirty) {
              form.setFieldValue("rows", mergeModelRow(draftRows, row));
            }
            setAdding(false);
          }}
        />
      ) : null}

      <Card className="py-0">
        <CardContent className="p-0">
          <Table className="min-w-[880px] table-fixed">
            <TableHeader className="bg-muted/40">
              <TableRow className="hover:bg-muted/40">
                <TableHead className="w-[240px] px-3">Model</TableHead>
                <TableHead className="w-[110px] border-l px-3">
                  Dostawca
                </TableHead>
                <TableHead className="w-[120px] border-l px-3">
                  Dostęp od
                </TableHead>
                <TableHead className="w-[100px] border-l px-3">
                  Wejście ×
                </TableHead>
                <TableHead className="w-[100px] border-l px-3">
                  Wyjście ×
                </TableHead>
                <TableHead className="w-[100px] border-l px-3">
                  Cache ×
                </TableHead>
                <TableHead className="w-[72px] border-l px-2 text-center">
                  Aktywny
                </TableHead>
                <TableHead className="w-12 border-l px-2">
                  <span className="sr-only">Akcje</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <form.Subscribe selector={(state) => state.values.rows}>
                {(rows) =>
                  rows.map((row, index) => (
                    <TableRow key={row.model}>
                      <TableCell className="min-w-0 px-3 py-2 whitespace-normal">
                        <form.Field
                          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TanStack Form array paths require a numeric index.
                          name={`rows[${index}].label`}
                        >
                          {(field) => (
                            <>
                              <Input
                                aria-label={`${row.model}: nazwa`}
                                aria-invalid={field.meta.isInvalid}
                                value={field.value}
                                onBlur={field.handleBlur}
                                onChange={(event) => {
                                  field.handleChange(event.target.value);
                                }}
                                className="hover:border-input focus:border-input h-8 border-transparent bg-transparent px-2 text-sm font-medium shadow-none"
                              />
                              <FieldError
                                className="px-2 text-[10px]"
                                errors={field.errors}
                              />
                            </>
                          )}
                        </form.Field>
                        <p className="text-muted-foreground truncate px-2 text-xs">
                          {row.model}
                        </p>
                      </TableCell>
                      <TableCell className="border-l px-2">
                        <Badge
                          variant="secondary"
                          className="max-w-full truncate"
                        >
                          {providers.find(({ value }) => value === row.provider)
                            ?.label ?? row.provider}
                        </Badge>
                      </TableCell>
                      <TableCell className="border-l px-2">
                        <form.Field
                          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TanStack Form array paths require a numeric index.
                          name={`rows[${index}].minimum_account_level`}
                        >
                          {(field) => (
                            <AccountLevelSelect
                              ariaLabel={`Minimalny poziom konta dla ${row.model}`}
                              ariaInvalid={field.meta.isInvalid}
                              value={field.value}
                              onValueChange={field.handleChange}
                            />
                          )}
                        </form.Field>
                      </TableCell>
                      {(
                        [
                          "input_weight",
                          "output_weight",
                          "cached_weight",
                        ] as const
                      ).map((fieldName) => (
                        <TableCell key={fieldName} className="border-l px-2">
                          <form.Field
                            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TanStack Form array paths require a numeric index.
                            name={`rows[${index}].${fieldName}`}
                          >
                            {(field) => (
                              <>
                                <Input
                                  aria-label={`${row.model}: ${fieldName}`}
                                  aria-invalid={field.meta.isInvalid}
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={field.value}
                                  onBlur={field.handleBlur}
                                  onChange={(event) => {
                                    field.handleChange(event.target.value);
                                  }}
                                  className="h-8 text-xs tabular-nums"
                                />
                                <FieldError
                                  className="text-[10px]"
                                  errors={field.errors}
                                />
                              </>
                            )}
                          </form.Field>
                        </TableCell>
                      ))}
                      <TableCell className="border-l px-2 text-center">
                        <form.Field
                          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions -- TanStack Form array paths require a numeric index.
                          name={`rows[${index}].active`}
                        >
                          {(field) => (
                            <Switch
                              aria-label={`Aktywny model ${row.model}`}
                              aria-invalid={field.meta.isInvalid}
                              checked={field.value}
                              onCheckedChange={(checked) => {
                                field.handleChange(checked);
                              }}
                            />
                          )}
                        </form.Field>
                      </TableCell>
                      <TableCell className="border-l px-2 text-center">
                        <DeleteModelAction
                          model={row}
                          disabled={deleteModel.isPending}
                          pending={
                            deleteModel.isPending
                              ? deleteModel.variables === row.model
                              : false
                          }
                          onDelete={async (model) => {
                            await deleteModel.mutateAsync(model);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                }
              </form.Subscribe>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FormSaveBar form={form} onDirtyChange={onDirtyChange} />
    </div>
  );
}

function DeleteModelAction({
  model,
  disabled,
  pending,
  onDelete,
}: {
  model: AIModelRow;
  disabled: boolean;
  pending: boolean;
  onDelete: (model: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!pending) {
          setOpen(nextOpen);
        }
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            disabled={disabled}
            aria-label={`Usuń model ${model.label}`}
            title="Usuń model"
          >
            <Trash2Icon />
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Usunąć model {model.label}?</AlertDialogTitle>
          <AlertDialogDescription>
            Model zniknie z wyboru użytkowników. Zapisana historia użycia
            pozostanie bez zmian, a identyfikator pozostanie zarezerwowany.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Anuluj</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => {
              void (async () => {
                try {
                  await onDelete(model.model);
                  setOpen(false);
                } catch {
                  // The mutation reports the actionable error in a toast.
                }
              })();
            }}
          >
            {pending ? "Usuwanie…" : "Usuń model"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CreateModelForm({
  onCreated,
}: {
  onCreated: (row: AIModelRow) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm({
    defaultValues: newModelDefaults,
    validators: [
      {
        run: modelSchema,
        triggers: [
          {
            trigger: "change",
            when: ({ formApi }) => formApi.state.submissionAttempts > 0,
          },
        ],
      },
    ],
    errorVisibility: ({ state }) => state.submissionAttempts > 0,
    onSubmit: async ({ schemaOutputs }) => {
      try {
        const row = await getUserService().createAIAdminModel(schemaOutputs[0]);
        onCreated(row);
        void invalidateAIModels(queryClient);
        void invalidateAIUsage(queryClient);
        toast.success("Model został dodany");
      } catch (error) {
        toast.error("Nie udało się dodać modelu");
        throw error;
      }
    },
  });

  return (
    <Card size="sm" className="bg-muted/15">
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <FieldGroup className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <form.Field name="model">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel htmlFor="new-model-id">Identyfikator</FieldLabel>
                  <Input
                    id="new-model-id"
                    name="model"
                    autoComplete="off"
                    placeholder="np. gpt-5.7-luna…"
                    value={field.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    aria-invalid={field.meta.isInvalid}
                  />
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="label">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel htmlFor="new-model-label">Nazwa</FieldLabel>
                  <Input
                    id="new-model-label"
                    name="label"
                    autoComplete="off"
                    placeholder="np. GPT-5.7 Luna…"
                    value={field.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                    aria-invalid={field.meta.isInvalid}
                  />
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="provider">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel>Dostawca</FieldLabel>
                  <Select
                    items={providers}
                    value={field.value}
                    onValueChange={(value) => {
                      if (value !== null) {
                        field.handleChange(value);
                      }
                    }}
                  >
                    <SelectTrigger
                      aria-invalid={field.meta.isInvalid}
                      aria-label="Wybierz dostawcę"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {providers.map((provider) => (
                          <SelectItem
                            key={provider.value}
                            value={provider.value}
                          >
                            {provider.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </form.Field>
            <form.Field name="minimum_account_level">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel>Dostęp od</FieldLabel>
                  <AccountLevelSelect
                    value={field.value}
                    onValueChange={(value) => {
                      field.handleChange(value);
                    }}
                    ariaInvalid={field.meta.isInvalid}
                  />
                </Field>
              )}
            </form.Field>
            {(["input_weight", "output_weight", "cached_weight"] as const).map(
              (name) => (
                <form.Field key={name} name={name}>
                  {(field) => (
                    <Field data-invalid={field.meta.isInvalid}>
                      <FieldLabel htmlFor={`new-model-${name}`}>
                        {name === "input_weight"
                          ? "Waga wejścia"
                          : name === "output_weight"
                            ? "Waga wyjścia"
                            : "Waga cache"}
                      </FieldLabel>
                      <Input
                        id={`new-model-${name}`}
                        name={name}
                        autoComplete="off"
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => {
                          field.handleChange(event.target.value);
                        }}
                        aria-invalid={field.meta.isInvalid}
                      />
                      <FieldError errors={field.errors} />
                    </Field>
                  )}
                </form.Field>
              ),
            )}
            <form.Field name="active">
              {(field) => (
                <Field
                  data-invalid={field.meta.isInvalid}
                  orientation="horizontal"
                  className="self-end pb-2"
                >
                  <FieldLabel htmlFor="new-model-active">Aktywny</FieldLabel>
                  <Switch
                    id="new-model-active"
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.handleChange(checked);
                    }}
                    aria-invalid={field.meta.isInvalid}
                  />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
          <div className="mt-4 flex justify-end">
            <form.Subscribe
              selector={(state) => [state.canSubmit, state.isSubmitting]}
            >
              {([canSubmit, isSubmitting]) => (
                <Button
                  type="submit"
                  size="sm"
                  disabled={!canSubmit || isSubmitting}
                >
                  {isSubmitting ? "Dodawanie…" : "Dodaj"}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AccountLevelSelect({
  ariaLabel = "Minimalny poziom konta",
  ariaInvalid = false,
  value,
  onValueChange,
}: {
  ariaLabel?: string;
  ariaInvalid?: boolean;
  value: AccountLevel;
  onValueChange: (value: AccountLevel) => void;
}) {
  const items = ACCOUNT_LEVELS.map((level) => ({
    label: ACCOUNT_LEVEL_LABELS[level],
    value: level,
  }));
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(nextValue) => {
        if (nextValue !== null) {
          onValueChange(nextValue);
        }
      }}
    >
      <SelectTrigger
        size="sm"
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        className="w-full"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {ACCOUNT_LEVELS.map((level) => (
            <SelectItem key={level} value={level}>
              {ACCOUNT_LEVEL_LABELS[level]}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
