"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClockIcon,
  ExternalLinkIcon,
  KeyRoundIcon,
  PlugZapIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils";
import { getUserService } from "@/services";
import type { AuthorizedApp } from "@/types/user";

const AUTHORIZED_APPS_QUERY_KEY = ["authorized-apps"];

const SCOPE_LABELS: Record<string, string> = {
  "quizzes:read": "Wyświetlanie quizów",
  "quizzes:write": "Edycja quizów",
  "study:read": "Twoje sesje",
  "study:write": "Prowadzenie sesji",
  "user:read": "Profil",
};

function formatAuthorizationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Nieznana data";
  }
  return new Intl.DateTimeFormat("pl-PL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getScopeLabels(scopes: string): string[] {
  return scopes
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter((scope) => scope.length > 0)
    .map((scope) => SCOPE_LABELS[scope] ?? scope);
}

function getHttpUrl(value?: string): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function AuthorizedAppLogo({ app }: { app: AuthorizedApp }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const appName = app.client_name || "Integracja";
  const logoUrl = getHttpUrl(app.logo_uri);
  const showLogo = logoUrl !== null && !logoFailed;

  return (
    <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-sm font-semibold">
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain p-1.5"
          loading="lazy"
          onError={() => {
            setLogoFailed(true);
          }}
        />
      ) : (
        getInitials(appName)
      )}
    </div>
  );
}

function AuthorizedAppRow({ app }: { app: AuthorizedApp }) {
  const queryClient = useQueryClient();
  const scopeLabels = getScopeLabels(app.scopes);
  const clientUri = getHttpUrl(app.client_uri);
  const appName = app.client_name || "Integracja bez nazwy";
  const revokeApp = useMutation({
    mutationFn: async () => getUserService().deleteAuthorizedApp(app.client_id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: AUTHORIZED_APPS_QUERY_KEY,
      });
      toast.success("Integracja została odłączona.");
    },
    onError: (error: unknown) => {
      console.error("Error revoking authorized integration:", error);
      toast.error("Nie udało się odłączyć integracji.");
    },
  });

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-4">
          <AuthorizedAppLogo app={app} />
          <div>
            <CardTitle className="flex items-center gap-4">
              {clientUri === null ? (
                appName
              ) : (
                <a
                  href={clientUri}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-foreground/90 flex items-center gap-1"
                >
                  {appName}
                  <ExternalLinkIcon className="size-3" />
                </a>
              )}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <CalendarClockIcon className="size-3.5" />
              {formatAuthorizationDate(app.created)}
            </CardDescription>
          </div>
        </CardTitle>
        <CardAction>
          <AlertDialog>
            <AlertDialogTrigger
              className="hidden sm:inline-flex"
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={revokeApp.isPending}
                >
                  <Trash2Icon />
                  Odłącz
                </Button>
              }
            />
            <AlertDialogTrigger
              className="inline-flex sm:hidden"
              render={
                <Button
                  variant="destructive"
                  size="icon-sm"
                  disabled={revokeApp.isPending}
                >
                  <Trash2Icon />
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Odłączyć integrację?</AlertDialogTitle>
                <AlertDialogDescription>
                  Integracja {app.client_name || app.client_id} utraci dostęp do
                  konta. Usuniemy jej tokeny dostępu i odświeżania.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    revokeApp.mutate();
                  }}
                  disabled={revokeApp.isPending}
                >
                  Odłącz
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs font-medium">
            Uprawnienia
          </p>
          <div className="flex flex-wrap gap-1.5">
            {scopeLabels.length > 0 ? (
              scopeLabels.map((scope) => (
                <Badge key={scope} variant="secondary" className="font-normal">
                  {scope}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="font-normal">
                Brak zakresów
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AuthorizedAppsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {[0, 1].map((item) => (
        <Card className="gap-4" key={item}>
          <CardHeader>
            <CardTitle className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-lg border" />
              <div className="flex flex-col gap-2">
                <CardTitle className="flex items-center gap-4">
                  <Skeleton className="h-4 w-32" />
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <CalendarClockIcon className="size-3.5" />
                  <Skeleton className="h-3 w-24" />
                </CardDescription>
              </div>
            </CardTitle>
            <CardAction>
              <Button
                variant="destructive"
                size="sm"
                disabled={true}
                className="hidden sm:inline-flex"
              >
                <Trash2Icon />
                Odłącz
              </Button>
              <Button
                variant="destructive"
                size="icon-sm"
                disabled={true}
                className="inline-flex sm:hidden"
              >
                <Trash2Icon />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <p className="text-muted-foreground text-xs font-medium">
                Uprawnienia
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(SCOPE_LABELS).map((scope) => (
                  <Badge
                    key={scope}
                    variant="secondary"
                    className="w-20 animate-pulse"
                  ></Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AuthorizedAppsList() {
  const {
    data: apps,
    isError,
    isLoading,
  } = useQuery<AuthorizedApp[]>({
    queryKey: AUTHORIZED_APPS_QUERY_KEY,
    queryFn: async () => getUserService().getAuthorizedApps(),
  });
  const authorizedApps = apps ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon className="size-5" />
          Połączone Aplikacje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? <AuthorizedAppsSkeleton /> : null}
        {!isLoading && isError ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <KeyRoundIcon />
              </EmptyMedia>
              <EmptyTitle>Nie udało się pobrać aplikacji</EmptyTitle>
              <EmptyDescription>
                Odśwież stronę albo spróbuj ponownie za chwilę.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {!isLoading && !isError && authorizedApps.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <PlugZapIcon />
              </EmptyMedia>
              <EmptyTitle>Brak połączonych aplikacji</EmptyTitle>
              <EmptyDescription>
                Integracje autoryzowane przez OAuth pojawią się tutaj.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {!isLoading && !isError && authorizedApps.length > 0 ? (
          <div className="flex flex-col gap-4">
            {authorizedApps.map((app) => (
              <AuthorizedAppRow key={app.client_id} app={app} />
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
