import React, {useContext, useState, useEffect} from 'react';
import {
    Card,
    Button,
    Alert,
    Form
} from 'react-bootstrap';
import {Link, useLocation, useNavigate} from 'react-router';
import AppContext from "../AppContext.tsx";
import {SERVER_URL} from "../config.ts";
import PrivacyModal from "./PrivacyModal.tsx";
import {Quiz} from "./quiz/types.ts";
import PropagateLoader from "react-spinners/PropagateLoader";

const ConnectGuestAccount: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const error = queryParams.get('error');

    // Modal state
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);

    const [migrating, setMigrating] = useState(false);
    const [migratingText, setMigratingText] = useState("");
    const [migrated, setMigrated] = useState(localStorage.getItem("guest_migrated") === "true");

    // Category migration checkboxes:
    // – By default, "Quizy" and "Postępy quizów" are enabled, "Ustawienia" is off.
    // – The "Postępy quizów" checkbox is disabled if "Quizy" is off.
    const [categories, setCategories] = useState({
        quizzes: true,
        progress: true,
        settings: false,
    });

    // Guest quizzes state
    const [guestQuizzes, setGuestQuizzes] = useState<Quiz[]>([]);
    const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);

    useEffect(() => {
        const quizzesStr = localStorage.getItem('guest_quizzes');
        if (quizzesStr) {
            try {
                const quizzes = JSON.parse(quizzesStr);
                setGuestQuizzes(quizzes);
                setSelectedQuizIds(quizzes.map((quiz: Quiz) => quiz.id));
            } catch (err) {
                console.error("Error parsing guest_quizzes", err);
            }
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("profile_picture");
        localStorage.removeItem("is_staff");
        localStorage.removeItem("user_id");
        appContext.setAuthenticated(false);
        navigate("/");
    };

    const uploadQuizzes = async (quizIds?: string[]) => {
        for (const quiz of guestQuizzes) {
            if (!quizIds || quizIds.includes(quiz.id)) {
                console.log("Uploading quiz", quiz.id);
                try {
                    setMigratingText(`Przenoszenie quizu ${quiz.title}...`);
                    const response = await appContext.axiosInstance.post('/quizzes/', quiz);
                    const newQuizId = response.data.id;
                    console.log("Quiz uploaded:", response.data);
                    if (categories.progress) {
                        const progress = JSON.parse(localStorage.getItem(`${quiz.id}_progress`) || "{}");
                        if (progress) {
                            setMigratingText(`Przenoszenie postępów quizu ${quiz.title}...`);
                            await appContext.axiosInstance.post(`/quiz-progress/${newQuizId}/`, progress);
                        }
                    }
                    // Replace the quiz ID in the local storage with the new ID
                    localStorage.removeItem(`${quiz.id}_progress`);
                    localStorage.setItem(`${newQuizId}_progress`, "{}");
                } catch (err) {
                    console.error("Error uploading quiz", quiz.id, err);
                    throw err;
                }
            }
        }
    };


    const uploadSettings = async () => {
        setMigratingText("Przenoszenie ustawień...");
        const settings = JSON.parse(localStorage.getItem("settings") || "{}");
        try {
            await appContext.axiosInstance.put('/settings/', {
                initial_reoccurrences: settings.initial_reoccurrences,
                wrong_answer_reoccurrences: settings.wrong_answer_reoccurrences,
            });
        } catch (err) {
            console.error("Error uploading settings", err);
            throw err;
        }
    };

    // When the user clicks the migration button, process both category-level and individual quiz migrations.
    const handleMigration = async () => {
        // Ask for confirmation before proceeding
        if (!window.confirm("Czy na pewno chcesz przenieść swoje dane?\nTej operacji nie można cofnąć.")) {
            return;
        }
        setMigrating(true);

        try {
            // Migrate quizzes and progress
            if (selectedQuizIds.length > 0) {
                await uploadQuizzes(selectedQuizIds);
            }

            // Migrate settings
            if (categories.settings) {
                await uploadSettings();
            }
            setMigrated(true);
            localStorage.setItem("guest_migrated", "true");
        } catch (err) {
            console.error("Error migrating data", err);
            alert("Wystąpił błąd podczas przenoszenia danych. Spróbuj ponownie później.");
        } finally {
            setMigrating(false);
        }
    };

    // Handler for category checkbox changes. When unchecking "Quizy", also disable "Postępy quizów"
    const handleCategoryToggle = (field: 'quizzes' | 'progress' | 'settings') => {
        setCategories(prev => {
            const newValue = !prev[field];
            if (field === 'quizzes' && !newValue) {
                // If quizzes is turned off, force progress off as well
                return {...prev, quizzes: false, progress: false};
            }
            return {...prev, [field]: newValue};
        });
    };

    // Handler for toggling individual quiz selection.
    const handleQuizToggle = (quizId: string) => {
        setSelectedQuizIds(prev =>
            prev.includes(quizId)
                ? prev.filter(id => id !== quizId)
                : [...prev, quizId]
        );
    };

    if (migrated) {
        return (
            <div className="d-flex justify-content-center">
                <Card className="border-0 shadow" style={{minWidth: "50%"}}>
                    <Card.Body className="d-flex flex-column align-items-center">
                        <Card.Text className="fs-4">Dane przeniesione pomyślnie!</Card.Text>
                        <Card.Text>
                            Twoje dane zostały przeniesione pomyślnie. Teraz możesz korzystać z pełni funkcji Testownika
                            jako zalogowany użytkownik. Dziękujemy za korzystanie z Testownika!
                        </Card.Text>
                        <Card.Text>
                            Zdecyduj czy dane z konta gościa mają zostać usunięte. Wszystkie wybrane quizy oraz postępy
                            zostały już przeniesione na Twoje konto. Jeśli chcesz zachować dane z konta gościa, kliknij
                            przycisk "Pozostaw". W przeciwnym wypadku kliknij przycisk "Usuń dane gościa".
                        </Card.Text>
                        <Card.Text>
                            Jeśli zdecydujesz się na pozostawienie danych z konta gościa, będziesz miała/miał dostęp do
                            nich w przyszłości po przelogowaniu się na konto gościa, jednak ponowne przeniesienie danych
                            na konto zalogowanego użytkownika nie będzie możliwe.
                        </Card.Text>
                        <div className="d-flex gap-2">
                            <Button
                                onClick={() => {
                                    localStorage.removeItem("guest_quizzes");
                                    localStorage.removeItem("guest_migrated");
                                    appContext.setGuest(false);
                                    navigate("/");
                                }}
                                variant="danger"
                            >
                                Usuń dane gościa
                            </Button>
                            <Button
                                onClick={() => {
                                    appContext.setGuest(false);
                                    navigate("/");
                                }}
                                variant="outline-primary"
                            >
                                Pozostaw
                            </Button>
                        </div>
                    </Card.Body>
                </Card>
            </div>
        );
    }

    if (migrating) {
        return (
            <div className="d-flex justify-content-center">
                <Card className="border-0 shadow" style={{minWidth: "50%"}}>
                    <Card.Body className="d-flex flex-column align-items-center">
                        <Card.Text className="fs-4">Przenoszenie danych...</Card.Text>
                        <PropagateLoader color={appContext.theme.getOppositeThemeColor()} loading={true} size={15}/>
                        <Card.Text className="mt-4">{migratingText}</Card.Text>
                    </Card.Body>
                </Card>
            </div>
        );
    }

    return (
        <div className="d-flex justify-content-center">
            <Card className="border-0 shadow" style={{minWidth: "50%"}}>
                {appContext.isAuthenticated ? (
                    <Card.Body className="d-flex flex-column align-items-center">
                        <Card.Text className="fs-4">Zalogowano pomyślnie!</Card.Text>

                        {/* Migration – Category selection using checkboxes */}
                        <div className="w-100 mt-3">
                            <h5>Wybierz kategorie do migracji:</h5>
                            <Form>
                                <Form.Check
                                    type="checkbox"
                                    id="category-quizzes"
                                    label="Quizy"
                                    checked={categories.quizzes}
                                    onChange={() => handleCategoryToggle('quizzes')}
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="category-progress"
                                    label="Postępy quizów"
                                    checked={categories.progress}
                                    onChange={() => handleCategoryToggle('progress')}
                                    disabled={!categories.quizzes}
                                />
                                <Form.Check
                                    type="checkbox"
                                    id="category-settings"
                                    label="Ustawienia"
                                    checked={categories.settings}
                                    onChange={() => handleCategoryToggle('settings')}
                                />
                            </Form>
                        </div>

                        {/* Migration – Individual quiz selection using checkboxes */}
                        {categories.quizzes && (
                            <div className="w-100 mt-3">
                                <h5>Wybierz quizy do migracji</h5>
                                {categories.progress && (
                                    <p>(Postępy zostaną przeniesione automatycznie)</p>
                                )}
                                {guestQuizzes.length > 0 ? (
                                    <Form>
                                        {guestQuizzes.map((quiz: Quiz) => (
                                            <Form.Check
                                                type="checkbox"
                                                id={`quiz-${quiz.id}`}
                                                key={quiz.id}
                                                label={quiz.title || `Quiz ${quiz.id}`}
                                                checked={selectedQuizIds.includes(quiz.id)}
                                                onChange={() => handleQuizToggle(quiz.id)}
                                            />
                                        ))}
                                    </Form>
                                ) : (
                                    <p>Brak dostępnych quizów do migracji.</p>
                                )}
                            </div>
                        )}

                        {/* Migration action button */}
                        <div className="w-100 mt-3">
                            <Button variant="primary" onClick={handleMigration} className="w-100">
                                Przenieś dane
                            </Button>
                        </div>

                        {/* Cancel button */}
                        <div className="w-100 mt-3">
                            <Button onClick={handleLogout} variant="danger" className="w-100">
                                Anuluj
                            </Button>
                        </div>
                    </Card.Body>
                ) : (
                    // If not authenticated, show the original guest/login card.
                    <Card.Body>
                        <Card.Title>Połącz swoje konto</Card.Title>
                        {error && (
                            <Alert variant="danger">
                                <p>Wystąpił błąd podczas logowania.</p>
                                {error === "not_student" ? (
                                    <span>
                                        Niestety, nie udało nam się zidentyfikować Cię jako studenta PWr. Upewnij się, że
                                        logujesz się na swoje konto studenta. Jeśli problem będzie się powtarzał,{" "}
                                        <a href="mailto:testownik@solvro.pl">skontaktuj się z nami</a>.
                                    </span>
                                ) : (
                                    <span>{error}</span>
                                )}
                            </Alert>
                        )}
                        <Card.Text>
                            Obecnie korzystasz z Testownika jako gość. Aby móc korzystać z pełni funkcji Testownika,
                            możesz połączyć swoje konto z USOS. W ten sposób będziesz mógł synchronizować swoje quizy
                            oraz wyniki, udostępniać quizy oraz przeglądać swoje oceny. Po zalogowaniu za pomocą USOS
                            będziesz mógł również przenieść swoje quizy oraz wyniki z konta gościa. Jeśli nie chcesz
                            logować się za pomocą USOS, możesz kontynuować jako gość.
                        </Card.Text>
                        <Card.Text>
                            <b>
                                Klikając przyciski poniżej, potwierdzasz, że zapoznałeś się z naszym{" "}
                                <Link to={"/terms"}>regulaminem</Link> oraz że go akceptujesz.
                            </b>
                        </Card.Text>
                        <div className="d-grid gap-2">
                            <Button
                                href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location}`}
                                variant="primary"
                                className="w-100"
                            >
                                Zaloguj się
                            </Button>
                            <Button onClick={handleLogout} variant="outline-primary" className="w-100">
                                Kontynuuj jako gość
                            </Button>
                        </div>
                        <div className="text-center mt-2">
                            <a
                                href="#"
                                className="fs-6 link-secondary"
                                onClick={() => setShowPrivacyModal(true)}
                            >
                                Jak wykorzystujemy Twoje dane?
                            </a>
                        </div>
                    </Card.Body>
                )}
            </Card>

            <PrivacyModal show={showPrivacyModal} onHide={() => setShowPrivacyModal(false)}/>
        </div>
    );
};

export default ConnectGuestAccount;