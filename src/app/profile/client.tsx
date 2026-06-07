"use client";

import { SquareArrowOutUpRightIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { AiSettingsForm } from "@/components/profile/ai-settings-form";
import { AuthorizedAppsList } from "@/components/profile/authorized-apps-list";
import { NotificationsForm } from "@/components/profile/notifications-form";
import { ProfileDetails } from "@/components/profile/profile-details";
import { SettingsForm } from "@/components/profile/settings-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { env } from "@/env";
import { useUserProfile } from "@/hooks/use-user-profile";
import {
  useUpdateUserSettings,
  useUserSettings,
} from "@/hooks/use-user-settings";
import type { UserSettings } from "@/types/user";
import { DEFAULT_USER_SETTINGS } from "@/types/user";

const PROFILE_TABS = [
  "account",
  "settings",
  "notifications",
  "authorized-apps",
] as const;
const DEFAULT_PROFILE_TAB = "account";
const PROFILE_TAB_QUERY_PARAM = "tab";

type ProfileTab = (typeof PROFILE_TABS)[number];

function isProfileTab(value: string): value is ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab);
}

function getProfileTabFromQuery(tab: string | null): ProfileTab | null {
  return tab !== null && isProfileTab(tab) ? tab : null;
}

export function ProfilePageClient(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const searchParameters = useSearchParams();
  const tabParameter = searchParameters.get(PROFILE_TAB_QUERY_PARAM);
  const activeTab = getProfileTabFromQuery(tabParameter) ?? DEFAULT_PROFILE_TAB;
  const { data: userData, isPending: isUserDataPending } = useUserProfile();
  const {
    data: settings = DEFAULT_USER_SETTINGS,
    isPending: areSettingsPending,
    isPlaceholderData: areSettingsPlaceholderData,
  } = useUserSettings({
    placeholderData: DEFAULT_USER_SETTINGS,
  });
  const updateUserSettings = useUpdateUserSettings();
  const areSettingsDisabled = areSettingsPending || areSettingsPlaceholderData;

  useEffect(() => {
    if (
      tabParameter === null ||
      getProfileTabFromQuery(tabParameter) !== null
    ) {
      return;
    }

    const nextSearchParameters = new URLSearchParams(searchParameters);
    nextSearchParameters.delete(PROFILE_TAB_QUERY_PARAM);
    const queryString = nextSearchParameters.toString();

    router.replace(
      queryString === "" ? pathname : `${pathname}?${queryString}`,
    );
  }, [pathname, router, searchParameters, tabParameter]);

  const handleSettingChange = <K extends keyof UserSettings>(
    name: K,
    value: UserSettings[K],
  ) => {
    updateUserSettings.mutate({ [name]: value });
  };

  const handleTabSelect = (tabKey: string) => {
    if (tabKey === "privacy-policy") {
      return;
    }
    if (!isProfileTab(tabKey)) {
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
      <Tabs
        value={activeTab}
        onValueChange={handleTabSelect}
        className="grid items-start gap-2 md:grid-cols-[220px_1fr] md:gap-6"
      >
        <TabsList className="flex max-w-full justify-start overflow-x-auto overflow-y-hidden md:h-auto md:w-full md:flex-col">
          <TabsTrigger value="account" className="md:w-full md:justify-start">
            Konto
          </TabsTrigger>
          <TabsTrigger value="settings" className="md:w-full md:justify-start">
            Ustawienia
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="md:w-full md:justify-start"
          >
            Powiadomienia
          </TabsTrigger>
          <TabsTrigger
            value="authorized-apps"
            className="md:w-full md:justify-start"
          >
            Integracje
          </TabsTrigger>
          <TabsTrigger
            value="privacy-policy"
            className="hidden md:inline-flex md:w-full md:justify-start"
            nativeButton={false}
            render={(props) => (
              <Link {...props} href="/privacy-policy" target="_blank">
                Polityka prywatności
                <SquareArrowOutUpRightIcon />
              </Link>
            )}
          ></TabsTrigger>
        </TabsList>
        <div className="min-w-0 space-y-6">
          <TabsContent value="account" className="space-y-6 md:mt-0">
            <ProfileDetails
              userData={userData ?? null}
              loading={isUserDataPending || userData == null}
            />
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
          <TabsContent value="authorized-apps" className="space-y-6 md:mt-0">
            <AuthorizedAppsList />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
