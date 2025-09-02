import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router";

import { AppContext } from "@/app-context.tsx";
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
  const [settings, setSettings] = useState<SettingsData>({
    sync_progress: false,
    initial_reoccurrences: 1,
    wrong_answer_reoccurrences: 1,
  });

  useEffect(() => {
    // Set page title
    document.title = "Profil - Testownik Solvro";

    if (location.hash) {
      handleTabSelect(location.hash.slice(1));
      window.history.replaceState(null, "", location.pathname);
    }

    if (appContext.isGuest) {
      const savedSettings = localStorage.getItem("settings");
      setSettings(
        savedSettings === null
          ? settings
          : (JSON.parse(savedSettings) as SettingsData),
      );
      return;
    }

    // Fetch user data
    appContext.axiosInstance
      .get("/user/")
      .then((res) => res.data)
      .then((data: UserData) => {
        setUserData(data);
      })
      .catch((error) => {
        console.error("Error fetching user data:", error);
      });

    // Fetch settings data
    appContext.axiosInstance
      .get("/settings/")
      .then((res) => res.data)
      .then((data: SettingsData) => {
        setSettings(data);
      })
      .catch((error) => {
        console.error("Error fetching settings:", error);
      });
  }, []);

  const handleTabSelect = (tabKey: string) => {
    setActiveTab(tabKey);
    const titles: Record<string, string> = {
      account: "Profil",
      settings: "Ustawienia",
    };
    document.title = `${titles[tabKey] || "Profil"} - Testownik Solvro`;
  };

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
      .then((res) => {
        console.log("Settings updated:", res.data);
      })
      .catch((error) => {
        console.error("Error updating settings:", error);
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
              loading={!userData}
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
