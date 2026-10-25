"use client";

import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BanIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { AiModelProviderIcon } from "@/components/ai/ai-model-provider-icon";
import { ModelSelect } from "@/components/ai/model-select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { invalidateAIModels } from "@/hooks/use-ai-models";
import { invalidateAIUsage } from "@/hooks/use-ai-usage";
import { getUserService } from "@/services";
import type { AIModelRow, AIUsageSettingsRow } from "@/types/ai-admin";

import { aiAdminKeys as keys, normalizeSettings } from "./config";
import {
  AdminLoading,
  FormSaveBar,
  QueryError,
  SectionHeading,
} from "./shared";

const requiredNumber = z
  .string()
  .trim()
  .min(1, "Wpisz wartość.")
  .pipe(z.coerce.number());
const nonNegativeInteger = requiredNumber.pipe(
  z.number().int("Wpisz liczbę całkowitą.").min(0, "Wpisz wartość nieujemną."),
);
const positiveInteger = requiredNumber.pipe(
  z.number().int("Wpisz liczbę całkowitą.").min(1, "Wpisz wartość dodatnią."),
);
const noFallbackValue = "__no_fallback__";

const settingsFormSchema = z.object({
  limits_enabled: z.boolean(),
  grace_buffer_credits: requiredNumber
    .pipe(z.number().min(0, "Wpisz wartość nieujemną."))
    .transform(String),
  staff_bypass_limits: z.boolean(),
  default_model: z.string().min(1),
  fallback_model: z.string().min(1).nullable(),
  fallback_throttle_seconds: nonNegativeInteger,
  fallback_max_output_tokens: positiveInteger.pipe(
    z.number().min(16, "Wpisz co najmniej 16 tokenów."),
  ),
  updated_at: z.string(),
});

const compactFieldGroupClass =
  "grid gap-x-4 gap-y-3 p-4 md:grid-cols-2 xl:grid-cols-5 [&>[data-slot=field]]:gap-1.5 [&_[data-slot=field-description]]:text-xs [&_[data-slot=field-description]]:leading-snug [&_[data-slot=input]]:h-8";

function getSettingsFormValues(settings: AIUsageSettingsRow) {
  const normalized = normalizeSettings(settings);
  return {
    ...normalized,
    fallback_throttle_seconds: settings.fallback_throttle_seconds.toString(),
    fallback_max_output_tokens: settings.fallback_max_output_tokens.toString(),
  };
}

export function SettingsPanel({
  onDirtyChange,
}: {
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const settingsQuery = useQuery({
    queryKey: keys.settings,
    queryFn: async () => getUserService().getAIAdminSettings(),
    staleTime: 60_000,
  });
  const modelsQuery = useQuery({
    queryKey: keys.models,
    queryFn: async () => getUserService().getAIAdminModels(),
    staleTime: 60_000,
  });

  if (settingsQuery.isError || modelsQuery.isError) {
    return (
      <div className="space-y-4">
        <SectionHeading title="Ustawienia" />
        <QueryError
          title="Nie udało się pobrać ustawień"
          onRetry={() => {
            void settingsQuery.refetch();
            void modelsQuery.refetch();
          }}
        />
      </div>
    );
  }
  if (settingsQuery.isPending || modelsQuery.isPending) {
    return (
      <div className="space-y-4">
        <SectionHeading title="Ustawienia" />
        <AdminLoading label="Ładowanie ustawień" />
      </div>
    );
  }

  return (
    <SettingsForm
      initialSettings={settingsQuery.data}
      models={modelsQuery.data}
      onDirtyChange={onDirtyChange}
    />
  );
}

function SettingsForm({
  initialSettings,
  models,
  onDirtyChange,
}: {
  initialSettings: AIUsageSettingsRow;
  models: AIModelRow[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const defaultValues = useMemo(
    () => getSettingsFormValues(initialSettings),
    [initialSettings],
  );
  const activeModelOptions = useMemo(
    () =>
      models
        .filter((row) => row.active)
        .map((model) => ({
          id: model.model,
          name: model.label,
          icon: <AiModelProviderIcon provider={model.provider} />,
        })),
    [models],
  );
  const fallbackModelOptions = useMemo(
    () => [
      { id: noFallbackValue, name: "Brak", icon: <BanIcon /> },
      ...activeModelOptions,
    ],
    [activeModelOptions],
  );
  const form = useForm({
    defaultValues,
    validators: [
      {
        run: settingsFormSchema,
        triggers: ["change"],
      },
    ],
    onSubmit: async ({ schemaOutputs, formApi }) => {
      try {
        const row = await getUserService().updateAIAdminSettings(
          schemaOutputs[0],
        );
        queryClient.setQueryData(keys.settings, row);
        formApi.reset(getSettingsFormValues(row));
        void queryClient.invalidateQueries({ queryKey: keys.stats });
        void invalidateAIUsage(queryClient);
        void invalidateAIModels(queryClient);
        toast.success("Ustawienia AI zostały zapisane");
      } catch (error) {
        toast.error("Nie udało się zapisać ustawień AI");
        throw error;
      }
    },
  });

  return (
    <div className="space-y-4">
      <SectionHeading title="Ustawienia" />
      <Card className="py-0">
        <CardContent className="divide-y p-0">
          <div className="divide-y md:grid md:grid-cols-2 md:divide-x md:divide-y-0">
            <form.Field name="limits_enabled">
              {(field) => (
                <SettingSwitchRow
                  label="Egzekwuj limity"
                  description="Blokuj zwykłe żądania po wyczerpaniu puli."
                  checked={field.value}
                  onCheckedChange={field.handleChange}
                />
              )}
            </form.Field>
            <form.Field name="staff_bypass_limits">
              {(field) => (
                <SettingSwitchRow
                  label="Wyjątek dla administracji"
                  description="Nie naliczaj kredytów administratorom."
                  checked={field.value}
                  onCheckedChange={field.handleChange}
                />
              )}
            </form.Field>
          </div>
          <FieldGroup className={compactFieldGroupClass}>
            <form.Field name="grace_buffer_credits">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel htmlFor="grace-buffer-credits">
                    Margines kredytów
                  </FieldLabel>
                  <Input
                    id="grace-buffer-credits"
                    type="number"
                    min="0"
                    value={field.value}
                    aria-invalid={field.meta.isInvalid}
                    onBlur={field.handleBlur}
                    onChange={(event) => {
                      field.handleChange(event.target.value);
                    }}
                  />
                  <FieldDescription>
                    Pozwala dokończyć rozpoczętą odpowiedź.
                  </FieldDescription>
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="default_model">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel>Domyślny model</FieldLabel>
                  <ModelSelect
                    models={activeModelOptions}
                    value={field.value}
                    ariaLabel="Wybierz domyślny model AI"
                    className="w-full"
                    size="sm"
                    onValueChange={field.handleChange}
                  />
                  <FieldDescription>
                    Używany, gdy użytkownik nie wybierze modelu.
                  </FieldDescription>
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="fallback_model">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel>Model po limicie</FieldLabel>
                  <ModelSelect
                    models={fallbackModelOptions}
                    value={field.value ?? noFallbackValue}
                    ariaLabel="Wybierz model zapasowy AI"
                    className="w-full"
                    size="sm"
                    onValueChange={(value) => {
                      field.handleChange(
                        value === noFallbackValue ? null : value,
                      );
                    }}
                  />
                  <FieldDescription>
                    Dostępny po wyczerpaniu zwykłej puli.
                  </FieldDescription>
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="fallback_throttle_seconds">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel htmlFor="fallback-throttle">
                    Przerwa po limicie
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="fallback-throttle"
                      className="pr-10"
                      type="number"
                      min="0"
                      step="1"
                      value={field.value}
                      aria-invalid={field.meta.isInvalid}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                    />
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      sek.
                    </span>
                  </div>
                  <FieldDescription>
                    Czas między kolejnymi żądaniami.
                  </FieldDescription>
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
            <form.Field name="fallback_max_output_tokens">
              {(field) => (
                <Field data-invalid={field.meta.isInvalid}>
                  <FieldLabel htmlFor="fallback-cap">
                    Długość odpowiedzi
                  </FieldLabel>
                  <div className="relative">
                    <Input
                      id="fallback-cap"
                      className="pr-16"
                      type="number"
                      min="1"
                      step="1"
                      value={field.value}
                      aria-invalid={field.meta.isInvalid}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                    />
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs">
                      tokenów
                    </span>
                  </div>
                  <FieldDescription>
                    Maksimum tokenów generowanych po limicie.
                  </FieldDescription>
                  <FieldError errors={field.errors} />
                </Field>
              )}
            </form.Field>
          </FieldGroup>
        </CardContent>
      </Card>
      <FormSaveBar form={form} onDirtyChange={onDirtyChange} />
    </div>
  );
}

function SettingSwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description === undefined ? null : (
          <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
        )}
      </div>
      <Switch
        aria-label={label}
        size="sm"
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}
