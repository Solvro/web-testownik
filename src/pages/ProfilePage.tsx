import React, {useState, useEffect, useContext} from "react";
import {Container, Row, Col, Tab} from "react-bootstrap";
import MenuSidebar from "../components/profile/MenuSidebar.tsx";
import ProfileDetails from "../components/profile/ProfileDetails.tsx";
import SettingsForm from "../components/profile/SettingsForm.tsx";
import AppContext from "../AppContext.tsx";
import {useLocation} from "react-router";

interface UserData {
    id: number;
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

const ProfilePage: React.FC = () => {
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
            setSettings(localStorage.getItem("settings") ? JSON.parse(localStorage.getItem("settings")!) : settings);
            return;
        }

        // Fetch user data
        appContext.axiosInstance.get("/user/")
            .then((res) => res.data)
            .then((data: UserData) => setUserData(data))
            .catch((err) => console.error("Error fetching user data:", err));

        // Fetch settings data
        appContext.axiosInstance.get("/settings/")
            .then((res) => res.data)
            .then((data: SettingsData) => setSettings(data))
            .catch((err) => console.error("Error fetching settings:", err));
    }, []);

    const handleTabSelect = (tabKey: string | null) => {
        if (!tabKey) return;

        setActiveTab(tabKey);

        const titles: Record<string, string> = {
            account: "Profil",
            settings: "Ustawienia",
        };
        document.title = `${titles[tabKey] || "Profil"} - Testownik Solvro`;
    };

    const handleSettingChange = (name: keyof SettingsData, value: boolean | number) => {
        setSettings({...settings, [name]: value});
        localStorage.setItem("settings", JSON.stringify({...settings, [name]: value}));
        if (appContext.isGuest) return;
        appContext.axiosInstance.put("/settings/", {[name]: value})
            .then((res) => console.log("Settings updated:", res.data))
            .catch((err) => console.error("Error updating settings:", err));
    };


    return (
        <Container className="mt-4">
            <Row>
                <Col md={4} className="mb-3">
                    <MenuSidebar activeTab={activeTab} onTabSelect={handleTabSelect}/>
                </Col>
                <Col md={8}>
                    <Tab.Content>
                        {activeTab === "account" &&
                            <ProfileDetails userData={userData} loading={!userData} setUserData={setUserData}/>}
                        {activeTab === "settings" && (
                            <SettingsForm
                                settings={settings}
                                onSettingChange={handleSettingChange}
                            />
                        )}
                    </Tab.Content>
                </Col>
            </Row>
        </Container>
    );
};

export default ProfilePage;