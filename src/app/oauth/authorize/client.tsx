"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  LinkIcon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppLogo } from "@/components/app-logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { API_URL } from "@/lib/api";
import type { JWTPayload } from "@/lib/auth/types";
import { getInitials } from "@/lib/utils";
import { OAuthAuthorizationService } from "@/services/oauth-authorization.service";
import type {
  OAuthAuthorizationParameters,
  OAuthAuthorizationRequest,
  OAuthScopeGrant,
} from "@/services/oauth-authorization.service";

type AuthorizationAction = "allow" | "deny";

interface AuthorizationDecision {
  action: AuthorizationAction;
  allow: boolean;
  scopes: string[];
}

const AUTHORIZATION_SCOPE_SKELETONS = [
  "quizzes-read",
  "quizzes-write",
  "study-read",
  "study-write",
  "user-read",
];

const oauthAuthorizationService = new OAuthAuthorizationService(API_URL);

function isRedirect(value: unknown): value is { redirect_url: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "redirect_url" in value &&
    typeof (value as { redirect_url?: unknown }).redirect_url === "string"
  );
}

function isError(value: unknown): value is { error: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function redirectTo(url: string | null) {
  if (url === null) {
    return;
  }

  window.location.assign(url);
}

export function OAuthAuthorizeClient({
  authorizationParameters,
  currentUser,
}: {
  authorizationParameters: OAuthAuthorizationParameters;
  currentUser: JWTPayload;
}): React.JSX.Element {
  const [uncheckedScopes, setUncheckedScopes] = useState<string[]>([]);
  const authorizationQuery = useQuery({
    queryKey: ["oauth-authorization", authorizationParameters],
    queryFn: async () => {
      const details = await oauthAuthorizationService.getAuthorizationDetails(
        authorizationParameters,
      );

      if (isError(details)) {
        throw new Error(details.error);
      }

      return details;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  const authorizationDecision = useMutation({
    mutationFn: async ({ allow, scopes }: AuthorizationDecision) =>
      oauthAuthorizationService.completeAuthorization({
        authorizationParameters,
        scopes: allow ? scopes : [],
        allow,
      }),
  });

  const redirectUrl = isRedirect(authorizationQuery.data)
    ? authorizationQuery.data.redirect_url
    : null;

  useEffect(() => {
    redirectTo(redirectUrl);
  }, [redirectUrl]);

  const requestDetails =
    authorizationQuery.data === undefined || isRedirect(authorizationQuery.data)
      ? null
      : authorizationQuery.data;
  const selectedScopes =
    requestDetails === null
      ? []
      : requestDetails.scopes
          .map((scope) => scope.value)
          .filter((scope) => !uncheckedScopes.includes(scope));
  const queryError =
    authorizationQuery.error instanceof Error
      ? authorizationQuery.error.message
      : authorizationQuery.isError
        ? "Nie udało się odczytać żądania autoryzacji."
        : null;
  const mutationError =
    authorizationDecision.error instanceof Error
      ? authorizationDecision.error.message
      : authorizationDecision.isError
        ? "Nie udało się zakończyć autoryzacji."
        : null;
  const error = mutationError ?? queryError;
  const submittingAction = authorizationDecision.isPending
    ? authorizationDecision.variables.action
    : null;

  const submitDecision = (allow: boolean) => {
    const action = allow ? "allow" : "deny";
    void authorizationDecision
      .mutateAsync({
        action,
        allow,
        scopes: selectedScopes,
      })
      .then((result) => {
        window.location.assign(result.redirect_url);
      })
      .catch((submitError: unknown) => {
        const message =
          submitError instanceof Error
            ? submitError.message
            : "Nie udało się zakończyć autoryzacji.";
        toast.error(message);
      });
  };

  const setScopeChecked = (scopeValue: string, checked: boolean) => {
    setUncheckedScopes((current) =>
      checked
        ? current.filter((item) => item !== scopeValue)
        : [...new Set([...current, scopeValue])],
    );
  };

  const isLoading = authorizationQuery.isPending;

  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-center">
      <Card className="w-full">
        <AuthorizationHeader
          requestDetails={requestDetails}
          isLoading={isLoading}
          hasError={error !== null}
        />
        <CardContent className="flex flex-col gap-3">
          {error === null ? null : (
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AccountSummary user={currentUser} />

          <FieldSet>
            <FieldLegend
              variant="label"
              className="text-muted-foreground mb-2 text-xs font-semibold tracking-wide uppercase"
            >
              Uprawnienia
            </FieldLegend>
            <FieldGroup className="gap-2">
              {isLoading ? <AuthorizationSkeleton /> : null}

              {requestDetails === null ? null : (
                <PermissionFields
                  scopes={requestDetails.scopes}
                  selectedScopes={selectedScopes}
                  onCheckedChange={setScopeChecked}
                />
              )}
            </FieldGroup>
          </FieldSet>
        </CardContent>

        <AuthorizationActions
          selectedScopesCount={selectedScopes.length}
          submittingAction={submittingAction}
          onSubmit={submitDecision}
          disabled={isLoading}
        />
      </Card>
    </div>
  );
}

function AuthorizationHeader({
  requestDetails,
  isLoading,
  hasError,
}: {
  requestDetails: OAuthAuthorizationRequest | null;
  isLoading: boolean;
  hasError: boolean;
}) {
  const title =
    requestDetails === null
      ? hasError
        ? "Nie można wyświetlić zgody"
        : "Sprawdzanie aplikacji"
      : `Połącz ${requestDetails.client_name} z kontem Testownik`;

  return (
    <CardHeader className="text-center">
      <ConnectionGraphic
        requestDetails={requestDetails}
        isLoading={isLoading}
      />
      <CardTitle className="mt-2 flex flex-col items-center justify-center gap-1.25 text-lg leading-tight font-semibold text-balance">
        {isLoading ? (
          <>
            <Skeleton className="mx-auto h-5 w-full max-w-80 sm:h-[22.5px]" />
            <Skeleton className="mx-auto h-5 w-full max-w-60 sm:hidden sm:h-[22.5px]" />
          </>
        ) : (
          title
        )}
      </CardTitle>
      <CardDescription>
        {isLoading ? (
          <Skeleton className="mx-auto mt-1 h-4 w-full max-w-52 sm:mt-0 sm:h-5" />
        ) : (
          <ClientUriLink clientUri={requestDetails?.client_uri} />
        )}
      </CardDescription>
    </CardHeader>
  );
}

function ConnectionGraphic({
  requestDetails,
  isLoading,
}: {
  requestDetails: OAuthAuthorizationRequest | null;
  isLoading: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <div className="bg-background flex size-11 items-center justify-center rounded-xl border p-2 shadow-xs">
        <AppLogo />
      </div>
      <div className="text-primary flex items-center gap-1.5">
        <ChevronRightIcon className="text-primary/70 size-3.5 animate-pulse" />
        <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-full shadow-xs">
          <LinkIcon className="size-3.5" />
        </span>
        <ChevronLeftIcon className="text-primary/70 size-3.5 animate-pulse" />
      </div>
      <div className="bg-background flex size-11 items-center justify-center overflow-hidden rounded-xl border p-2 shadow-xs">
        {isLoading ? <Skeleton className="size-full rounded-lg" /> : null}
        {!isLoading &&
        requestDetails?.logo_uri !== undefined &&
        requestDetails.logo_uri.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={requestDetails.logo_uri}
            alt=""
            className="size-full object-contain"
            referrerPolicy="no-referrer"
          />
        ) : null}
        {!isLoading &&
        (requestDetails?.logo_uri === undefined ||
          requestDetails.logo_uri.length === 0) ? (
          <span className="text-primary text-base font-semibold">
            {getInitials(requestDetails?.client_name ?? "App")}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ClientUriLink({ clientUri }: { clientUri: string | undefined }) {
  if (clientUri === undefined || clientUri.length === 0) {
    return null;
  }

  return (
    <a
      href={clientUri}
      target="_blank"
      rel="noreferrer"
      className="hover:text-foreground inline-flex items-center gap-1 break-all transition-colors"
    >
      {clientUri}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

function AuthorizationSkeleton() {
  return (
    <>
      {AUTHORIZATION_SCOPE_SKELETONS.map((scope) => (
        <FieldLabel key={scope}>
          <Field orientation="horizontal">
            <Skeleton className="size-5 rounded-[4px]" role="checkbox" />
            <FieldContent>
              <Skeleton className="h-5 w-full max-w-72" />
              <Skeleton className="h-4 w-full max-w-24" />
            </FieldContent>
          </Field>
        </FieldLabel>
      ))}
    </>
  );
}

function AccountSummary({ user }: { user: JWTPayload }) {
  return (
    <div className="bg-muted/30 flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <Avatar className="h-8 w-8">
        {user.photo === null || user.photo.length === 0 ? null : (
          <AvatarImage src={user.photo} alt="" referrerPolicy="no-referrer" />
        )}
        <AvatarFallback>{getInitials(user.full_name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">Zalogowano jako</p>
        <p className="truncate text-sm font-medium">{user.full_name}</p>
      </div>
    </div>
  );
}

function PermissionFields({
  scopes,
  selectedScopes,
  onCheckedChange,
}: {
  scopes: OAuthScopeGrant[];
  selectedScopes: string[];
  onCheckedChange: (scopeValue: string, checked: boolean) => void;
}) {
  return (
    <>
      {scopes.map((scope) => (
        <ScopeField
          key={scope.value}
          scope={scope}
          checked={selectedScopes.includes(scope.value)}
          onCheckedChange={onCheckedChange}
        />
      ))}
    </>
  );
}

function ScopeField({
  scope,
  checked,
  onCheckedChange,
}: {
  scope: OAuthScopeGrant;
  checked: boolean;
  onCheckedChange: (scopeValue: string, checked: boolean) => void;
}) {
  const id = `oauth-scope-${scope.value}`;

  return (
    <FieldLabel htmlFor={id}>
      <Field orientation="horizontal">
        <Checkbox
          id={id}
          checked={checked}
          aria-label={scope.description}
          onCheckedChange={(nextChecked) => {
            onCheckedChange(scope.value, nextChecked);
          }}
        />
        <FieldContent>
          <FieldTitle>{scope.description}</FieldTitle>
          <FieldDescription className="font-mono text-xs">
            {scope.value}
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldLabel>
  );
}

function AuthorizationActions({
  selectedScopesCount,
  submittingAction,
  onSubmit,
  disabled,
}: {
  selectedScopesCount: number;
  submittingAction: AuthorizationAction | null;
  onSubmit: (allow: boolean) => void;
  disabled: boolean;
}) {
  return (
    <CardFooter className="bg-muted/10 grid gap-2 border-t sm:grid-cols-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          onSubmit(false);
        }}
        disabled={submittingAction !== null || disabled}
        className="order-2 sm:order-1"
      >
        {submittingAction === "deny" ? <Spinner /> : <XIcon />}
        Odmów
      </Button>
      <Button
        size="sm"
        onClick={() => {
          onSubmit(true);
        }}
        disabled={
          submittingAction !== null || selectedScopesCount === 0 || disabled
        }
        className="order-1 sm:order-2"
      >
        {submittingAction === "allow" ? <Spinner /> : <ShieldCheckIcon />}
        Zezwól
      </Button>
    </CardFooter>
  );
}
