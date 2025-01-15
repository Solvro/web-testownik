import React, {useState, useEffect, useContext} from "react";
import {Container, Row, Col, Tab} from "react-bootstrap";
import MenuSidebar from "../components/profile/MenuSidebar.tsx";
import ProfileDetails from "../components/profile/ProfileDetails.tsx";
import SettingsForm from "../components/profile/SettingsForm.tsx";
import AppContext from "../AppContext.tsx";
import QuestionQuizCard from "../components/dashboard/QuestionQuizCard.tsx";
import LastUsedCard from "../components/dashboard/LastUsedCard.tsx";
import ImportButtonsCard from "../components/dashboard/ImportButtonsCard.tsx";
import SearchCard from "../components/dashboard/SearchCard.tsx";
import AboutCard from "../components/dashboard/AboutCard.tsx";

interface UserData {
    id: number;
    full_name: string;
    student_number: string;
    email: string;
    photo_url: string;
    is_superuser: boolean;
    is_staff: boolean;
}

interface SettingsData {
    sync_progress: boolean;
    initial_repetitions: number;
    wrong_answer_repetitions: number;
}

const ProfilePage: React.FC = () => {
    const appContext = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<string>("account");
    const [userData, setUserData] = useState<UserData | null>(null);
    const [settings, setSettings] = useState<SettingsData>({
        sync_progress: false,
        initial_repetitions: 1,
        wrong_answer_repetitions: 1,
    });

    useEffect(() => {
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
    };

    const handleSettingChange = (name: keyof SettingsData, value: boolean | number) => {
        setSettings({...settings, [name]: value});
        appContext.axiosInstance.put("/settings/", {[name]: value})
            .then((res) => console.log("Settings updated:", res.data))
            .catch((err) => console.error("Error updating settings:", err));
    };


    return (
        <Row className="mh-1 row-gap-3">
            <Col md={4}>
                <GradesTable/>
            </Col>
        </Row>
    );
};

export default ProfilePage;