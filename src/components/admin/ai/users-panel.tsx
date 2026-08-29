"use client";

import { useDebouncedValue } from "@tanstack/react-pacer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  InfinityIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  SearchIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { AccountLevelBadge } from "@/components/account-level-badge";
import { AccountTypeBadge } from "@/components/account-type-badge";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import {
  formatAIResetAt,
  isAIUsageUnlimited,
  isAIUsageWindowUnlimited,
  usageWindowPercent,
} from "@/lib/ai/usage";
import { cn } from "@/lib/utils";
import { getUserService } from "@/services";
import type {
  AIAdminUser,
  AIUsageEventPage,
  AIUserLimitOverride,
} from "@/types/ai-admin";
import type { AIUsageWindow } from "@/types/ai-usage";
import { AI_USAGE_SCOPE_LABELS } from "@/types/ai-usage";

import { formatNumber, aiAdminKeys as keys } from "./config";
import { AdminLoading, QueryError, SectionHeading } from "./shared";

const EVENTS_PAGE_SIZE = 10;

export function UsersPanel({ canManage }: { canManage: boolean }) {
  const [search, setSearch] = useState("");
  const [deferredSearch] = useDebouncedValue(search.trim(), { wait: 300 });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const searchReady = deferredSearch.length === 0 || deferredSearch.length >= 2;
  const overridesOnly = deferredSearch.length === 0;
  const users = useQuery({
    queryKey: keys.users(deferredSearch, overridesOnly),
    queryFn: async () =>
      getUserService().getAIAdminUsers(deferredSearch, overridesOnly),
    enabled: searchReady,
    staleTime: 20_000,
  });
  const selectedUser = useMemo(
    () => users.data?.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users.data],
  );

  return (
    <div className="space-y-4">
      <SectionHeading title="Użytkownicy" />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="py-0">
          <CardContent className="p-0">
            <div className="border-b p-3">
              <div className="relative">
                <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  className="pl-9"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  placeholder="Imię, nazwisko, e-mail lub ID…"
                  aria-label="Szukaj użytkownika"
                />
              </div>
            </div>
            <UserList
              query={users}
              searchReady={searchReady}
              showingOverrides={overridesOnly}
              selectedUserId={selectedUserId}
              onSelect={setSelectedUserId}
            />
          </CardContent>
        </Card>

        {selectedUser === null ? (
          <Card size="sm" className="min-h-96">
            <CardContent className="flex flex-1 items-center justify-center">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Wyszukaj lub wybierz użytkownika</EmptyTitle>
                  <EmptyDescription>
                    Wyszukaj konto albo wybierz je z listy, aby zobaczyć limity,
                    wyjątki i ostatnie zdarzenia.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <UserUsageDetails
            key={selectedUser.id}
            user={selectedUser}
            canManage={canManage}
          />
        )}
      </div>
    </div>
  );
}

function UserList({
  query,
  searchReady,
  showingOverrides,
  selectedUserId,
  onSelect,
}: {
  query: ReturnType<typeof useQuery<AIAdminUser[]>>;
  searchReady: boolean;
  showingOverrides: boolean;
  selectedUserId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!searchReady) {
    return (
      <p className="text-muted-foreground p-8 text-center text-sm">
        Wpisz jeszcze jeden znak, aby wyszukać konto.
      </p>
    );
  }
  if (query.isPending) {
    return <AdminLoading label="Ładowanie użytkowników" className="min-h-48" />;
  }
  if (query.isError) {
    return (
      <div className="p-3">
        <QueryError
          title="Nie udało się pobrać użytkowników"
          onRetry={() => void query.refetch()}
        />
      </div>
    );
  }
  if (query.data.length === 0) {
    return (
      <p className="text-muted-foreground p-8 text-center text-sm">
        {showingOverrides
          ? "Brak indywidualnych wyjątków. Wyszukaj konto powyżej, aby dodać pierwszy."
          : "Nie znaleziono pasującego konta."}
      </p>
    );
  }

  return (
    <div className="max-h-80 divide-y overflow-y-auto xl:max-h-[640px]">
      {query.data.map((user) => {
        const displayName =
          user.name.trim() === "" ? (user.email ?? user.id) : user.name;
        const percent = Math.max(
          usageWindowPercent(user.usage.session),
          usageWindowPercent(user.usage.weekly),
        );
        return (
          <button
            type="button"
            key={user.id}
            className={cn(
              "hover:bg-muted/60 focus-visible:ring-ring/50 w-full p-3 text-left transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-inset",
              selectedUserId === user.id && "bg-muted",
            )}
            onClick={() => {
              onSelect(user.id);
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {user.email ?? user.id}
                </p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {isAIUsageUnlimited(user.usage) ? (
                  <InfinityIcon className="size-3.5" />
                ) : (
                  `${Math.round(percent).toString()}%`
                )}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <AccountTypeBadge accountType={user.account_type} />
              <AccountLevelBadge accountLevel={user.account_level} />
              {user.has_override ? (
                <Badge variant="outline">
                  <SlidersHorizontalIcon /> Wyjątek
                </Badge>
              ) : null}
            </div>
          </button>
        );
      })}
      {query.data.length >= 100 ? (
        <p className="bg-background/95 text-muted-foreground sticky bottom-0 p-3 text-center text-xs backdrop-blur">
          Pokazano pierwsze 100 kont. Doprecyzuj wyszukiwanie.
        </p>
      ) : null}
    </div>
  );
}

function UserUsageDetails({
  user,
  canManage,
}: {
  user: AIAdminUser;
  canManage: boolean;
}) {
  const [eventsOffset, setEventsOffset] = useState(0);
  const overrideQuery = useQuery({
    queryKey: keys.override(user.id),
    queryFn: async () => getUserService().getAIUserOverride(user.id),
    enabled: canManage,
  });
  const events = useQuery({
    queryKey: keys.events(user.id, eventsOffset),
    queryFn: async () =>
      getUserService().getAIUserEvents(user.id, {
        limit: EVENTS_PAGE_SIZE,
        offset: eventsOffset,
      }),
    placeholderData: (previous) => previous,
  });
  const displayName =
    user.name.trim() === "" ? (user.email ?? user.id) : user.name;

  return (
    <Card className="min-w-0 py-0">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{displayName}</h3>
            <p className="text-muted-foreground mt-0.5 truncate text-xs">
              {user.email ?? user.id}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <AccountTypeBadge accountType={user.account_type} />
            <AccountLevelBadge accountLevel={user.account_level} />
            {user.has_override ? (
              <Badge variant="outline">
                <SlidersHorizontalIcon /> Wyjątek
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-6 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <UserWindow label="5 godzin" window={user.usage.session} />
            <UserWindow label="7 dni" window={user.usage.weekly} />
          </div>

          {canManage ? (
            overrideQuery.isPending ? (
              <Card size="sm" className="py-0">
                <CardContent className="p-0">
                  <AdminLoading
                    label="Ładowanie wyjątku użytkownika"
                    className="min-h-48"
                  />
                </CardContent>
              </Card>
            ) : overrideQuery.isError ? (
              <QueryError
                title="Nie udało się pobrać wyjątku"
                onRetry={() => void overrideQuery.refetch()}
              />
            ) : (
              <OverrideEditor
                key={user.id}
                userId={user.id}
                initiallyHasOverride={user.has_override}
                initialValue={overrideQuery.data}
              />
            )
          ) : null}

          <EventsPanel
            query={events}
            limit={EVENTS_PAGE_SIZE}
            offset={eventsOffset}
            onOffsetChange={setEventsOffset}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UserWindow({
  label,
  window,
}: {
  label: string;
  window: AIUsageWindow;
}) {
  const isUnlimited = isAIUsageWindowUnlimited(window);
  const percent = usageWindowPercent(window);
  const resetLabel = formatAIResetAt(window.resets_at, "short", Date.now());
  return (
    <div className="bg-muted/35 space-y-2 rounded-lg p-3">
      <div className="flex justify-between gap-3 text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {isUnlimited
            ? `${formatNumber(window.used)} · bez limitu`
            : `${formatNumber(window.used)} / ${formatNumber(window.limit)}`}
        </span>
      </div>
      {isUnlimited ? (
        <p className="text-muted-foreground text-xs">
          Użycie w tym oknie nie jest ograniczane.
        </p>
      ) : (
        <Progress value={percent} />
      )}
      {isUnlimited || resetLabel === null ? null : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock3Icon className="size-3.5" />
          Odnowienie {resetLabel}
        </p>
      )}
    </div>
  );
}

function EventsPanel({
  query,
  limit,
  offset,
  onOffsetChange,
}: {
  query: ReturnType<typeof useQuery<AIUsageEventPage>>;
  limit: number;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold">Ostatnie zdarzenia</h4>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Tokeny, model i wynik ostatnich żądań.
        </p>
      </div>
      {query.isPending ? (
        <AdminLoading label="Ładowanie zdarzeń" className="min-h-32" />
      ) : query.isError ? (
        <QueryError
          title="Nie udało się pobrać zdarzeń"
          onRetry={() => void query.refetch()}
        />
      ) : query.data.results.length === 0 ? (
        <p className="bg-muted/35 text-muted-foreground rounded-lg p-6 text-center text-sm">
          Ten użytkownik nie korzystał jeszcze z AI.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {query.data.results.map((event) => (
            <div
              key={event.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {AI_USAGE_SCOPE_LABELS[event.scope] ?? event.scope} ·{" "}
                  {event.model}
                </p>
                <p className="text-muted-foreground mt-0.5">
                  {new Date(event.created_at).toLocaleString("pl-PL")} ·{" "}
                  {event.input_tokens.toString()} wej. /{" "}
                  {event.output_tokens.toString()} wyj.
                </p>
                {event.error === "" ? null : (
                  <p className="text-destructive mt-1 truncate">
                    {event.error}
                  </p>
                )}
              </div>
              <span className="font-medium tabular-nums">
                {formatNumber(event.credits)}
              </span>
            </div>
          ))}
        </div>
      )}
      {query.data === undefined || query.data.count <= limit ? null : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs tabular-nums">
            {offset + 1}–{Math.min(offset + limit, query.data.count)} z{" "}
            {query.data.count}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Poprzednia strona zdarzeń"
              disabled={query.data.previous === null || query.isFetching}
              onClick={() => {
                onOffsetChange(Math.max(0, offset - limit));
              }}
            >
              <ChevronLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Następna strona zdarzeń"
              disabled={query.data.next === null || query.isFetching}
              onClick={() => {
                onOffsetChange(offset + limit);
              }}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function OverrideEditor({
  userId,
  initiallyHasOverride,
  initialValue,
}: {
  userId: string;
  initiallyHasOverride: boolean;
  initialValue: Partial<AIUserLimitOverride> | undefined;
}) {
  const queryClient = useQueryClient();
  const [hasExistingOverride, setHasExistingOverride] =
    useState(initiallyHasOverride);
  const [override, setOverride] = useState<AIUserLimitOverride>(() => ({
    credits_session: initialValue?.credits_session ?? null,
    credits_weekly: initialValue?.credits_weekly ?? null,
    note: initialValue?.note ?? "",
  }));
  const [removeOpen, setRemoveOpen] = useState(false);
  const save = useMutation({
    mutationFn: async () =>
      getUserService().updateAIUserOverride(userId, override),
    onSuccess: (value) => {
      queryClient.setQueryData(keys.override(userId), value);
      setHasExistingOverride(true);
      void queryClient.invalidateQueries({ queryKey: keys.usersRoot });
      toast.success("Wyjątek użytkownika został zapisany");
    },
    onError: () => toast.error("Nie udało się zapisać wyjątku"),
  });
  const remove = useMutation({
    mutationFn: async () => getUserService().deleteAIUserOverride(userId),
    onSuccess: () => {
      queryClient.setQueryData(keys.override(userId), {});
      setHasExistingOverride(false);
      setOverride({
        credits_session: null,
        credits_weekly: null,
        note: "",
      });
      setRemoveOpen(false);
      void queryClient.invalidateQueries({ queryKey: keys.usersRoot });
      toast.success("Wyjątek usunięty — konto dziedziczy macierz");
    },
    onError: () => toast.error("Nie udało się usunąć wyjątku"),
  });

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-4">
        <div>
          <h4 className="text-sm font-semibold">Indywidualny wyjątek</h4>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Brak wyjątku dziedziczy macierz. W wyjątku puste pole wyłącza dane
            okno.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {(["credits_session", "credits_weekly"] as const).map((field) => (
            <label key={field} className="space-y-1.5">
              <span className="flex items-center justify-between gap-3 text-xs font-medium">
                {field === "credits_session" ? "Sesja" : "Tydzień"}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                  onClick={() => {
                    setOverride((current) => ({ ...current, [field]: null }));
                  }}
                >
                  Bez limitu
                </button>
              </span>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="Bez limitu"
                value={override[field] ?? ""}
                onChange={(event) => {
                  setOverride((current) => ({
                    ...current,
                    [field]:
                      event.target.value === ""
                        ? null
                        : event.target.valueAsNumber,
                  }));
                }}
              />
            </label>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium">Uzasadnienie</span>
          <Textarea
            placeholder="Dlaczego ten użytkownik ma inny limit?"
            value={override.note}
            onChange={(event) => {
              setOverride((current) => ({
                ...current,
                note: event.target.value,
              }));
            }}
          />
        </label>
        <div className="flex flex-wrap justify-between gap-2">
          <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={
                    !hasExistingOverride || remove.isPending || save.isPending
                  }
                >
                  <TrashIcon /> Usuń wyjątek
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Usunąć indywidualny wyjątek?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Użytkownik ponownie odziedziczy limity przypisane do swojego
                  typu i poziomu konta.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => {
                    remove.mutate();
                  }}
                >
                  {remove.isPending ? "Usuwanie…" : "Usuń wyjątek"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="sm"
            disabled={save.isPending || remove.isPending}
            onClick={() => {
              save.mutate();
            }}
          >
            {save.isPending ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
