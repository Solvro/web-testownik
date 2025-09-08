import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";
import { toast } from "react-toastify";

import { AppContext } from "@/app-context.ts";
import { ProfileDetails } from "@/components/profile/profile-details.tsx";
import { SettingsForm } from "@/components/profile/settings-form.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserData {
  id: string;
  full_name: string;
  student_number: string;
  email: string;
  photo_url: string;
  overriden_photo_url: string;
  photo: string;
  is_superuser: boolean;
  is_staff: boolean;
  hide_profile: boolean;
}

interface SettingsData {
  sync_progress: boolean;
  initial_reoccurrences: number;
  wrong_answer_reoccurrences: number;
}

export function ProfilePage(): React.JSX.Element {
  const appContext = useContext(AppContext);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<string>("account");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [settings, setSettings] = useState<SettingsData>(() => {
    if (appContext.isGuest) {
      const savedSettings = localStorage.getItem("settings");
      if (savedSettings != null && savedSettings.trim() !== "") {
        try {
          return JSON.parse(savedSettings) as SettingsData;
        } catch {
          // If parsing fails, use default
        }
      }
      return {
        sync_progress: false,
        initial_reoccurrences: 1,
        wrong_answer_reoccurrences: 1,
      };
    }
    return {
      sync_progress: false,
      initial_reoccurrences: 1,
      wrong_answer_reoccurrences: 1,
    };
  });

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    const titles: Record<string, string> = {
      account: "Profil",
      settings: "Ustawienia",
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
    appContext.axiosInstance
      .get<UserData>("/user/")
      .then((r) => r.data)
      .then((data) => {
        setUserData(data);
      })
      .catch((error: unknown) => {
        console.error("Error fetching user data:", error);
      });

    // Fetch settings data
    appContext.axiosInstance
      .get<SettingsData>("/settings/")
      .then((r) => r.data)
      .then((data) => {
        setSettings(data);
      })
      .catch((error: unknown) => {
        console.error("Error fetching settings:", error);
      });
  }, [
    appContext.axiosInstance,
    appContext.isGuest,
    location.hash,
    location.pathname,
  ]);

  const handleSettingChange = (
    name: keyof SettingsData,
    value: boolean | number,
  ) => {
    setSettings({ ...settings, [name]: value });
    localStorage.setItem(
      "settings",
      JSON.stringify({ ...settings, [name]: value }),
    );
    if (appContext.isGuest) {
      return;
    }
    appContext.axiosInstance
      .put("/settings/", { [name]: value })
      .catch((error: unknown) => {
        console.error("Error updating settings:", error);
        toast.error("Wystąpił błąd podczas aktualizacji ustawień.");
        setSettings(settings); // Revert to previous settings on error
        localStorage.setItem("settings", JSON.stringify(settings));
      });
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
        </div>
      </Tabs>
    </div>
  );
}
