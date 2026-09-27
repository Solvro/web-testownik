"use client";

import { useForm } from "@tanstack/react-form";
import { PencilIcon } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";

import { aiModelIdentitySchema } from "./config";

export function ModelIdentityEditor({
  label,
  model,
  otherModelCodes,
  onApply,
}: {
  label: string;
  model: string;
  otherModelCodes: string[];
  onApply: (identity: { label: string; model: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const defaultValues = useMemo(() => ({ label, model }), [label, model]);
  const schema = useMemo(
    () =>
      aiModelIdentitySchema.extend({
        model: aiModelIdentitySchema.shape.model.refine(
          (code) => !otherModelCodes.includes(code),
          "Ten identyfikator jest już używany.",
        ),
      }),
    [otherModelCodes],
  );
  const form = useForm({
    defaultValues,
    validators: [{ run: schema, triggers: ["change"] }],
    onSubmit: ({ schemaOutputs }) => {
      onApply(schemaOutputs[0]);
      setOpen(false);
    },
  });

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={label}>
          {label}
        </p>
        <p
          className="text-muted-foreground mt-1 truncate text-xs"
          title={model}
        >
          {model}
        </p>
      </div>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen) {
            form.reset({ label, model });
          }
          setOpen(nextOpen);
        }}
      >
        <PopoverTrigger
          render={
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="text-muted-foreground shrink-0"
              aria-label={`Edytuj model ${label}`}
              title="Edytuj nazwę i identyfikator"
            >
              <PencilIcon />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
          <PopoverHeader>
            <PopoverTitle>Edytuj model</PopoverTitle>
            <PopoverDescription>
              Zmiany zapiszesz przyciskiem „Zapisz” pod tabelą.
            </PopoverDescription>
          </PopoverHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            <FieldGroup className="gap-3">
              <form.Field name="label">
                {(field) => (
                  <Field data-invalid={field.meta.isInvalid}>
                    <FieldLabel htmlFor={`${inputId}-label`}>Nazwa</FieldLabel>
                    <Input
                      id={`${inputId}-label`}
                      value={field.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      aria-invalid={field.meta.isInvalid}
                      autoComplete="off"
                    />
                    <FieldError errors={field.errors} />
                  </Field>
                )}
              </form.Field>
              <form.Field name="model">
                {(field) => (
                  <Field data-invalid={field.meta.isInvalid}>
                    <FieldLabel htmlFor={`${inputId}-model`}>
                      Identyfikator modelu
                    </FieldLabel>
                    <Input
                      id={`${inputId}-model`}
                      value={field.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        field.handleChange(event.target.value);
                      }}
                      aria-invalid={field.meta.isInvalid}
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <FieldError errors={field.errors} />
                  </Field>
                )}
              </form.Field>
            </FieldGroup>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Anuluj
              </Button>
              <form.Subscribe selector={(state) => state.canSubmit}>
                {(canSubmit) => (
                  <Button type="submit" size="sm" disabled={!canSubmit}>
                    Zastosuj
                  </Button>
                )}
              </form.Subscribe>
            </div>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}
