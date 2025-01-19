import React, {useState, useEffect, useContext} from "react";
import {Container, Row, Col, Tab, Card, Badge} from "react-bootstrap";
import {Grade, GradesTotal} from "../components/grades/Grade.ts";
import MenuSidebar from "../components/profile/MenuSidebar.tsx";
import ProfileDetails from "../components/profile/ProfileDetails.tsx";
import SettingsForm from "../components/profile/SettingsForm.tsx";
import AppContext from "../AppContext.tsx";
import QuestionQuizCard from "../components/dashboard/QuestionQuizCard.tsx";
import LastUsedCard from "../components/dashboard/LastUsedCard.tsx";
import ImportButtonsCard from "../components/dashboard/ImportButtonsCard.tsx";
import SearchCard from "../components/dashboard/SearchCard.tsx";
import AboutCard from "../components/dashboard/AboutCard.tsx";
import GradesTable from "../components/grades/GradesTable.tsx";

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

const GradesPage: React.FC = () => {
    const appContext = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<string>("grades");
    const [userData, setUserData] = useState<UserData | null>(null);
    const [userGrades, setUserGrades] = useState<GradesTotal[]>([]);
    const [settings, setSettings] = useState<SettingsData>({
        sync_progress: false,
        initial_repetitions: 1,
        wrong_answer_repetitions: 1,
    });
    const [loading, setLoading] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const [userResponse, sharedResponse] = await Promise.all([
                    appContext.axiosInstance.get('/grades/'),
                ]);

                if (userResponse.status === 200) {
                    setUserGrades(userResponse.data);
                }

            } catch {
                setError('Nie udało się załadować ocen.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuizzes();
    }, [appContext.axiosInstance]);

    useEffect(() => {

        // Fetch user data
        appContext.axiosInstance.get("/grades/")
            .then((res) => res.data)
            .then((data: UserData) => setUserData(data))
            .catch((err) => console.error("Error fetching user grades:", err));
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
        <Card className="border-0 shadow">

            <Col md={4}>
                <Card.Body className="d-flex flex-column text-nowrap">
                    <label>Wybierz semestr</label>
                    <select id="term-select" className="form-select" aria-label="Wybierz semestr" disabled>
                        <option>Ładowanie...</option>
                    </select>
                    <GradesTable/>
                </Card.Body>
            </Col>
        </Card>
    );
};

export default GradesPage;