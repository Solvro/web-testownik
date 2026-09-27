"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircleIcon,
  BotIcon,
  ChartNoAxesCombinedIcon,
  GaugeIcon,
  Settings2Icon,
  UsersIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { aiAdminKeys as keys } from "@/components/admin/ai/config";
import { LimitsPanel } from "@/components/admin/ai/limits-panel";
import { ModelsPanel } from "@/components/admin/ai/models-panel";
import { SettingsPanel } from "@/components/admin/ai/settings-panel";
import { AdminLoading, QueryError } from "@/components/admin/ai/shared";
import { StatisticsPanel } from "@/components/admin/ai/statistics-panel";
import { UsersPanel } from "@/components/admin/ai/users-panel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ResponsiveTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { getUserService } from "@/services";

const AI_ADMIN_TABS = [
  {
    value: "overview",
    label: "Przegląd",
    icon: <ChartNoAxesCombinedIcon />,
  },
  { value: "limits", label: "Limity", icon: <GaugeIcon /> },
  { value: "models", label: "Modele", icon: <BotIcon /> },
  { value: "settings", label: "Ustawienia", icon: <Settings2Icon /> },
  { value: "users", label: "Użytkownicy", icon: <UsersIcon /> },
] as const;
type AdminTab = (typeof AI_ADMIN_TABS)[number]["value"];

function AdminTabsList({
  items,
}: {
  items: readonly (typeof AI_ADMIN_TABS)[number][];
}) {
  return (
    <TabsList
      aria-label="Sekcje administracji AI"
      className="flex max-w-full justify-start overflow-x-auto overflow-y-hidden md:w-full"
    >
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          {item.icon}
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

export function AIAdminClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParameters = useSearchParams();
  const requestedTab = searchParameters.get("tab");
  const activeTab =
    requestedTab === "pricing" ? "models" : (requestedTab ?? "overview");
  const permissions = useQuery({
    queryKey: keys.permissions,
    queryFn: async () => getUserService().getAIAdminPermissions(),
    staleTime: 60_000,
  });
  const [dirtyTabs, setDirtyTabs] = useState<Set<AdminTab>>(() => new Set());
  const [pendingTab, setPendingTab] = useState<AdminTab | null>(null);
  const handleDirtyChange = useCallback((tab: AdminTab, dirty: boolean) => {
    setDirtyTabs((current) => {
      const hasTab = current.has(tab);
      if (hasTab === dirty) {
        return current;
      }
      const next = new Set(current);
      if (dirty) {
        next.add(tab);
      } else {
        next.delete(tab);
      }
      return next;
    });
  }, []);
  const handleLimitsDirtyChange = useCallback(
    (dirty: boolean) => {
      handleDirtyChange("limits", dirty);
    },
    [handleDirtyChange],
  );
  const handleModelsDirtyChange = useCallback(
    (dirty: boolean) => {
      handleDirtyChange("models", dirty);
    },
    [handleDirtyChange],
  );
  const handleSettingsDirtyChange = useCallback(
    (dirty: boolean) => {
      handleDirtyChange("settings", dirty);
    },
    [handleDirtyChange],
  );

  useEffect(() => {
    if (dirtyTabs.size === 0) {
      return;
    }
    const preventUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", preventUnload);
    return () => {
      window.removeEventListener("beforeunload", preventUnload);
    };
  }, [dirtyTabs.size]);

  if (permissions.isPending) {
    return (
      <div className="mx-auto max-w-7xl p-4 md:p-8">
        <AdminLoading
          label="Sprawdzanie uprawnień administratora"
          className="min-h-[50vh]"
        />
      </div>
    );
  }

  if (permissions.isError) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <QueryError
          title="Nie udało się sprawdzić uprawnień"
          onRetry={() => void permissions.refetch()}
        />
      </div>
    );
  }

  const { view_stats: canViewStats, manage_limits: canManage } =
    permissions.data;
  if (!canViewStats && !canManage) {
    return (
      <div className="mx-auto max-w-3xl p-4 md:p-8">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>Brak dostępu</AlertTitle>
          <AlertDescription>
            To konto nie ma uprawnień do zarządzania wykorzystaniem AI.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const allowedTabs = [
    ...(canViewStats ? ["overview", "users"] : []),
    ...(canManage ? ["limits", "models", "settings"] : []),
  ];
  const resolvedActiveTab = allowedTabs.includes(activeTab)
    ? activeTab
    : (allowedTabs[0] ?? "overview");
  const visibleTabs = AI_ADMIN_TABS.filter((tab) =>
    allowedTabs.includes(tab.value),
  );
  const navigateToTab = (value: AdminTab) => {
    const parameters = new URLSearchParams(searchParameters);
    parameters.set("tab", value);
    router.replace(`${pathname}?${parameters.toString()}`, {
      scroll: false,
    });
  };

  return (
    <div>
      <ResponsiveTabs
        key={resolvedActiveTab}
        value={resolvedActiveTab}
        onValueChange={(value: string) => {
          const nextTab = value as AdminTab;
          if (dirtyTabs.has(resolvedActiveTab as AdminTab)) {
            setPendingTab(nextTab);
            return;
          }
          navigateToTab(nextTab);
        }}
        className="grid min-w-0 gap-6 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start"
      >
        <AdminTabsList items={visibleTabs} />
        <div className="min-w-0">
          {canViewStats ? (
            <TabsContent value="overview" className="mt-0">
              <StatisticsPanel canManage={canManage} />
            </TabsContent>
          ) : null}
          {canManage ? (
            <TabsContent value="limits" className="mt-0">
              <LimitsPanel onDirtyChange={handleLimitsDirtyChange} />
            </TabsContent>
          ) : null}
          {canManage ? (
            <TabsContent value="models" className="mt-0">
              <ModelsPanel onDirtyChange={handleModelsDirtyChange} />
            </TabsContent>
          ) : null}
          {canManage ? (
            <TabsContent value="settings" className="mt-0">
              <SettingsPanel onDirtyChange={handleSettingsDirtyChange} />
            </TabsContent>
          ) : null}
          {canViewStats ? (
            <TabsContent value="users" className="mt-0">
              <UsersPanel canManage={canManage} />
            </TabsContent>
          ) : null}
        </div>
      </ResponsiveTabs>
      <AlertDialog
        open={pendingTab !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingTab(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odrzucić niezapisane zmiany?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmiany w tej sekcji nie zostały zapisane. Po przejściu dalej nie
              będzie można ich odzyskać.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zostań</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (pendingTab !== null) {
                  handleDirtyChange(resolvedActiveTab as AdminTab, false);
                  navigateToTab(pendingTab);
                  setPendingTab(null);
                }
              }}
            >
              Odrzuć i przejdź
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
