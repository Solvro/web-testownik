import React, {useState, useEffect, useContext} from "react";
import {Container, Row, Col, Tab} from "react-bootstrap";
import MenuSidebar from "../components/profile/MenuSidebar.tsx";
import ProfileDetails from "../components/profile/ProfileDetails.tsx";
import SettingsForm from "../components/profile/SettingsForm.tsx";
import AppContext from "../AppContext.tsx";

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
}

interface SettingsData {
    sync_progress: boolean;
    initial_reoccurrences: number;
    wrong_answer_reoccurrences: number;
}

const ProfilePage: React.FC = () => {
    const appContext = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<string>("account");
    const [userData, setUserData] = useState<UserData | null>(null);
    const [settings, setSettings] = useState<SettingsData>({
        sync_progress: false,
        initial_reoccurrences: 1,
        wrong_answer_reoccurrences: 1,
    });

    useEffect(() => {
        // Set page title
        document.title = "Profil - Testownik";

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
        if (tabKey) setActiveTab(tabKey);
        document.title = `${tabKey === "account" ? "Profil" : "Ustawienia"} - Testownik`;
    };

    const handleSettingChange = (name: keyof SettingsData, value: boolean | number) => {
        setSettings({...settings, [name]: value});
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