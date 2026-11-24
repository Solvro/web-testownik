"use client";

import type { UserData, UserSettings } from "@testownik/core/user/types";
import { DEFAULT_USER_SETTINGS } from "@testownik/core/user/types";
import { SquareArrowOutUpRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect } from "react";

import { AppContext } from "@/app-context";
import { AiSettingsForm } from "@/components/profile/ai-settings-form";
import { AIUsageCard } from "@/components/profile/ai-usage-card";
import { AuthorizedAppsList } from "@/components/profile/authorized-apps-list";
import { NotificationsForm } from "@/components/profile/notifications-form";
import { ProfileDetails } from "@/components/profile/profile-details";
import { SettingsForm } from "@/components/profile/settings-form";
import {
  ResponsiveTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { env } from "@/env";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/hooks/use-user-settings";
import { PermissionAction } from "@/lib/auth/permissions";
import type { JWTPayload } from "@/lib/auth/types";

const PROFILE_TABS = [
  "account",
  "settings",
  "notifications",
  "authorized-apps",
] as const;
const DEFAULT_PROFILE_TAB = "account";
const PROFILE_TAB_QUERY_PARAM = "tab";

type ProfileTab = (typeof PROFILE_TABS)[number];

function isProfileTab(
  value: string,
  availableTabs: readonly ProfileTab[],
): value is ProfileTab {
  return availableTabs.includes(value as ProfileTab);
}

function getProfileTabFromQuery(
  tab: string | null,
  availableTabs: readonly ProfileTab[],
): ProfileTab | null {
  return tab !== null && isProfileTab(tab, availableTabs) ? tab : null;
}

function getUserProfilePlaceholder(
  user: JWTPayload | null,
): UserData | undefined {
  if (user === null) {
    return undefined;
  }

  return {
    ...user,
    photo: user.photo ?? null,
    has_custom_photo: false,
    hide_profile: false,
    id: user.user_id,
  };
}

export function ProfilePageClient(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const searchParameters = useSearchParams();
  const { user, checkPermission } = useContext(AppContext);
  const canConnectApps = checkPermission(PermissionAction.CONNECT_APPS);
  const availableTabs = canConnectApps
    ? PROFILE_TABS
    : PROFILE_TABS.filter((tab) => tab !== "authorized-apps");
  const tabParameter = searchParameters.get(PROFILE_TAB_QUERY_PARAM);
  const activeTab =
    getProfileTabFromQuery(tabParameter, availableTabs) ?? DEFAULT_PROFILE_TAB;
  const { data: userData, isPending: isUserDataPending } = useUserProfile({
    placeholderData: getUserProfilePlaceholder(user),
  });
  const {
    data: settings = DEFAULT_USER_SETTINGS,
    isPending: areSettingsPending,
    isPlaceholderData: areSettingsPlaceholderData,
  } = useUserSettings({
    placeholderData: DEFAULT_USER_SETTINGS,
  });
  const updateUserSettings = useUpdateUserSettings();
  const areSettingsDisabled = areSettingsPending || areSettingsPlaceholderData;
  const showAIUsageCard =
    env.NEXT_PUBLIC_AI_ENABLED && !areSettingsDisabled && !settings.ai_disabled;

  useEffect(() => {
    if (
      tabParameter === null ||
      getProfileTabFromQuery(tabParameter, availableTabs) !== null
    ) {
      return;
    }

    const nextSearchParameters = new URLSearchParams(searchParameters);
    nextSearchParameters.delete(PROFILE_TAB_QUERY_PARAM);
    const queryString = nextSearchParameters.toString();

    router.replace(
      queryString === "" ? pathname : `${pathname}?${queryString}`,
    );
  }, [availableTabs, pathname, router, searchParameters, tabParameter]);

  const handleSettingChange = <K extends keyof UserSettings>(
    name: K,
    value: UserSettings[K],
  ) => {
    updateUserSettings.mutate({ [name]: value });
  };

  const handleTabSelect = (tabKey: string) => {
    if (tabKey === "privacy-policy" || tabKey === "terms") {
      return;
    }
    if (!isProfileTab(tabKey, availableTabs)) {
      return;
    }

    const nextSearchParameters = new URLSearchParams(searchParameters);
    if (tabKey === DEFAULT_PROFILE_TAB) {
      nextSearchParameters.delete(PROFILE_TAB_QUERY_PARAM);
    } else {
      nextSearchParameters.set(PROFILE_TAB_QUERY_PARAM, tabKey);
    }
    const queryString = nextSearchParameters.toString();

    router.push(queryString === "" ? pathname : `${pathname}?${queryString}`, {
      scroll: false,
    });
  };

  return (
    <div>
      <ResponsiveTabs
        value={activeTab}
        onValueChange={handleTabSelect}
        className="grid items-start gap-2 md:grid-cols-[220px_1fr] md:gap-6"
      >
        <TabsList className="flex max-w-full justify-start overflow-x-auto overflow-y-hidden md:w-full">
          <TabsTrigger value="account">Konto</TabsTrigger>
          <TabsTrigger value="settings">Ustawienia</TabsTrigger>
          <TabsTrigger value="notifications">Powiadomienia</TabsTrigger>
          {canConnectApps ? (
            <TabsTrigger value="authorized-apps">Integracje</TabsTrigger>
          ) : null}
          <TabsTrigger
            value="terms"
            className="hidden md:inline-flex"
            nativeButton={false}
            render={(props) => (
              <Link {...props} href="/terms" target="_blank">
                Regulamin
                <SquareArrowOutUpRightIcon />
              </Link>
            )}
          />
          <TabsTrigger
            value="privacy-policy"
            className="hidden md:inline-flex"
            nativeButton={false}
            render={(props) => (
              <Link {...props} href="/privacy-policy" target="_blank">
                Polityka prywatności
                <SquareArrowOutUpRightIcon />
              </Link>
            )}
          />
        </TabsList>
        <div className="min-w-0 space-y-6">
          <TabsContent value="account" className="space-y-6 md:mt-0">
            <ProfileDetails
              userData={userData ?? null}
              loading={isUserDataPending || userData == null}
            />
            {showAIUsageCard ? <AIUsageCard /> : null}
            <div className="flex w-full justify-center gap-4 md:hidden">
              <Link href="/terms" className="text-sm underline">
                Regulamin
              </Link>
              <Link href="/privacy-policy" className="text-sm underline">
                Polityka prywatności
              </Link>
            </div>
          </TabsContent>
          <TabsContent value="settings" className="space-y-6 md:mt-0">
            <SettingsForm
              settings={settings}
              onSettingChange={handleSettingChange}
              disabled={areSettingsDisabled}
            />
            {env.NEXT_PUBLIC_AI_ENABLED ? (
              <AiSettingsForm
                settings={settings}
                onSettingChange={handleSettingChange}
                disabled={areSettingsDisabled}
              />
            ) : null}
          </TabsContent>
          <TabsContent value="notifications" className="space-y-6 md:mt-0">
            <NotificationsForm
              settings={settings}
              onSettingChange={handleSettingChange}
              disabled={areSettingsDisabled}
            />
          </TabsContent>
          {canConnectApps ? (
            <TabsContent value="authorized-apps" className="space-y-6 md:mt-0">
              <AuthorizedAppsList />
            </TabsContent>
          ) : null}
        </div>
      </ResponsiveTabs>
    </div>
  );
}
