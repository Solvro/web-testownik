import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { NotificationsForm } from "@/components/profile/notifications-form.tsx";
import { ProfileDetails } from "@/components/profile/profile-details.tsx";
import { SettingsForm } from "@/components/profile/settings-form.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UserData, UserSettings } from "@/types/user.ts";
import { DEFAULT_USER_SETTINGS } from "@/types/user.ts";

export function ProfilePage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>("account");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<UserSettings>(() => {
    const storedSettings = appContext.services.user.getStoredSettings();
    if (storedSettings != null) {
      return storedSettings;
    }
    return { ...DEFAULT_USER_SETTINGS };
  });

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    const titles: Record<string, string> = {
      account: "Profil",
      settings: "Ustawienia",
      notifications: "Powiadomienia",
    };
    document.title = `${titles[tabKey] || "Profil"} - Testownik Solvro`;
  };

  useEffect(() => {
    document.title = "Profil - Testownik Solvro";

    if (location.hash) {
      handleTabSelect(location.hash.slice(1));
      window.history.replaceState(null, "", location.pathname);
    }

    if (appContext.isGuest) {
      return;
    }

    // Fetch user data
    appContext.services.user
      .getUserData()
      .then((data) => {
        setUserData(data);
      })
      .catch((error: unknown) => {
        console.error("Error fetching user data:", error);
      });

    // Fetch settings data
    appContext.services.user
      .getUserSettings()
      .then((data) => {
        setSettings(data);
      })
      .catch((error: unknown) => {
        console.error("Error fetching settings:", error);
      });
  }, [
    appContext.services.user,
    appContext.isGuest,
    location.hash,
    location.pathname,
  ]);

  const handleSettingChange = async (
    name: keyof UserSettings,
    value: boolean | number,
  ) => {
    setSettings({ ...settings, [name]: value });
    try {
      await appContext.services.user.updateUserSettings({ [name]: value });
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Wystąpił błąd podczas aktualizacji ustawień.");
      setSettings(settings); // Revert to previous settings on error
    }
  };

  return (
    <div className="mt-6">
      <Tabs
        value={activeTab}
        onValueChange={handleTabSelect}
        className="grid items-start gap-6 md:grid-cols-[220px_1fr]"
      >
        <TabsList className="flex md:h-auto md:w-full md:flex-col">
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
        </TabsList>
        <div className="space-y-6">
          <TabsContent value="account" className="space-y-6 md:mt-0">
            <ProfileDetails
              userData={userData}
              loading={userData == null}
              setUserData={setUserData}
            />
          </TabsContent>
          <TabsContent value="settings" className="space-y-6 md:mt-0">
            <SettingsForm
              settings={settings}
              onSettingChange={handleSettingChange}
            />
          </TabsContent>
          <TabsContent value="notifications" className="space-y-6 md:mt-0">
            <NotificationsForm
              settings={settings}
              onSettingChange={handleSettingChange}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
