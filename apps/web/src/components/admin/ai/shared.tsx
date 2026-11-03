import type { AnyReactFormApi } from "@tanstack/react-form";
import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";
import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description === undefined ? null : (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function QueryError({
  title,
  onRetry,
}: {
  title: string;
  onRetry: () => void;
}) {
  return (
    <Alert variant="destructive">
      <AlertCircleIcon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
        Połączenie nie powiodło się. Twoje zmiany nie zostały utracone.
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCwIcon /> Spróbuj ponownie
        </Button>
      </AlertDescription>
    </Alert>
  );
}

export function AdminLoading({
  label = "Ładowanie danych",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-64 items-center justify-center", className)}
    >
      <Spinner className="text-muted-foreground size-6" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SaveBar({
  dirty,
  pending,
  onSave,
  onReset,
  disabled = false,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
  onReset: () => void;
  disabled?: boolean;
}) {
  return (
    <Card size="sm" className="sticky bottom-4 z-20 shadow-sm">
      <CardContent className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!dirty || pending}
          onClick={onReset}
        >
          Cofnij
        </Button>
        <Button
          size="sm"
          disabled={!dirty || pending || disabled}
          onClick={onSave}
        >
          {pending ? "Zapisywanie…" : "Zapisz"}
        </Button>
      </CardContent>
    </Card>
  );
}

function DirtyStateReporter({
  dirty,
  onDirtyChange,
}: {
  dirty: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [dirty, onDirtyChange]);
  return null;
}

export function FormSaveBar({
  form,
  onDirtyChange,
}: {
  form: AnyReactFormApi;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  return (
    <form.Subscribe
      selector={(state) => [
        state.isDefaultValue,
        state.isSubmitting,
        state.canSubmit,
      ]}
    >
      {([isDefaultValue, isSubmitting, canSubmit]) => {
        const dirty = !isDefaultValue;
        return (
          <>
            <DirtyStateReporter dirty={dirty} onDirtyChange={onDirtyChange} />
            <SaveBar
              dirty={dirty}
              pending={isSubmitting}
              disabled={!canSubmit}
              onSave={() => {
                void form.handleSubmit();
              }}
              onReset={() => {
                form.reset();
              }}
            />
          </>
        );
      }}
    </form.Subscribe>
  );
}
