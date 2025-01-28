import React, {useEffect, useState, useContext} from 'react';
import {Button, Card, Alert, Row, Col, ButtonGroup} from 'react-bootstrap';
import {useNavigate} from 'react-router';
import AppContext from '../AppContext.tsx';
import {QuizMetadata} from '../components/quiz/types.ts';
import PropagateLoader from "react-spinners/PropagateLoader";
import {SharedQuiz} from "../components/quiz/ShareQuizModal/types.ts";
import {Icon} from "@iconify/react";
import ShareQuizModal from "../components/quiz/ShareQuizModal/ShareQuizModal.tsx";

const QuizzesPage: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();

    const [userQuizzes, setUserQuizzes] = useState<QuizMetadata[]>([]);
    const [sharedQuizzes, setSharedQuizzes] = useState<SharedQuiz[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedQuizToShare, setSelectedQuizToShare] = useState<QuizMetadata | null>(null);

    document.title = "Twoje quizy - Testownik Solvro";

    useEffect(() => {
        const fetchQuizzes = async () => {
            try {
                const [userResponse, sharedResponse] = await Promise.all([
                    appContext.axiosInstance.get('/quizzes/'),
                    appContext.axiosInstance.get('/shared-quizzes/'),
                ]);

                if (userResponse.status === 200) {
                    setUserQuizzes(userResponse.data);
                }

                if (sharedResponse.status === 200) {
                    const uniqueSharedQuizzes = sharedResponse.data.filter((sq: SharedQuiz, index: number, self: SharedQuiz[]) =>
                        index === self.findIndex((q) => q.quiz.id === sq.quiz.id) && sq.quiz.maintainer?.id !== parseInt(localStorage.getItem('user_id') || '0')
                    );
                    setSharedQuizzes(uniqueSharedQuizzes);
                }
            } catch {
                setError('Nie udało się załadować quizów.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuizzes();
    }, [appContext.axiosInstance]);

    const handleShareQuiz = (quiz: QuizMetadata) => {
        setSelectedQuizToShare(quiz);
    }

    const handleDeleteQuiz = (quiz: QuizMetadata) => {
        // Ask for confirmation  and then delete the quiz
        if (window.confirm('Czy na pewno chcesz usunąć ten quiz?\nTej operacji nie można cofnąć!\n\nTy oraz inni użytkownicy nie będą mogli już korzystać z tego quizu.')) {
            appContext.axiosInstance.delete(`/quizzes/${quiz.id}/`)
                .then(() => {
                    setUserQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
                })
                .catch(() => {
                        setError('Nie udało się usunąć quizu.');
                    }
                );
        }
    }

    const handleDownloadQuiz = (quiz: QuizMetadata) => {
        appContext.axiosInstance.get(`/quizzes/${quiz.id}/`)
            .then((response) => {
                const quiz = response.data;
                delete quiz.id;
                quiz.maintainer = quiz.maintainer?.full_name || null;
                delete quiz.visibility;
                delete quiz.allow_anonymous;
                const url = window.URL.createObjectURL(new Blob([JSON.stringify(quiz, null, 2)], {type: 'application/json'}));
                const link = document.createElement('a');
                link.href = url;
                link.setAttribute('download', `${quiz.title}.json`);
                document.body.appendChild(link);
                link.click();
                link.remove();
            })
            .catch(() => {
                setError('Nie udało się pobrać quizu.');
            });
    }

    const handleSearchInQuiz = (quiz: QuizMetadata) => {
        navigate(`/search-in-quiz/${quiz.id}`);
    }

    const updateQuiz = (quiz: QuizMetadata) => {
        setUserQuizzes((prev) => prev.map((q) => q.id === quiz.id ? quiz : q));
    }

    if (loading) {
        return (
            <Card className="border-0 shadow">
                <Card.Body>
                    <div className="text-center mb-5">
                        <p>Ładowanie quizu...</p>
                        <PropagateLoader color={appContext.theme.getOppositeThemeColor()} size={15}/>
                    </div>
                </Card.Body>
            </Card>
        );
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div>
            <h1 className="h4 mb-4">Twoje quizy</h1>

            {userQuizzes.length > 0 ? (
                <Row xs={1} md={2} lg={3} className="g-4">
                    {userQuizzes.map((quiz) => (
                        <Col key={quiz.id}>
                            <Card className="h-100">
                                <Card.Body>
                                    <Card.Title>{quiz.title}</Card.Title>
                                    <Card.Text>{quiz.description}</Card.Text>
                                </Card.Body>
                                <Card.Footer className="d-flex justify-content-between">
                                    <Button
                                        variant={appContext.theme.getOppositeTheme()}
                                        onClick={() => navigate(`/quiz/${quiz.id}`)}
                                    >
                                        Otwórz
                                    </Button>
                                    <ButtonGroup className="opacity-75">
                                        <Button
                                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                            onClick={() => navigate(`/edit-quiz/${quiz.id}`)}
                                            size="sm"
                                        >
                                            <Icon icon={"mdi:edit"}/>
                                        </Button>
                                        <Button
                                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                            onClick={() => handleShareQuiz(quiz)}
                                            size="sm"
                                        >
                                            <Icon icon={"mdi:ios-share"}/>
                                        </Button>
                                        <Button
                                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                            onClick={() => handleDownloadQuiz(quiz)}
                                            size="sm"
                                        >
                                            <Icon icon={"mdi:download"}/>
                                        </Button>
                                        <Button
                                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                            onClick={() => handleSearchInQuiz(quiz)}
                                            size="sm"
                                        >
                                            <Icon icon={"mdi:magnify"}/>
                                        </Button>
                                        <Button
                                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                            onClick={() => handleDeleteQuiz(quiz)}
                                            size="sm">
                                            <Icon icon={"mdi:delete"}/>
                                        </Button>
                                    </ButtonGroup>
                                </Card.Footer>
                            </Card>
                        </Col>
                    ))}
                    <Col key="create-quiz">
                        <Card className="h-100">
                            <Card.Body>
                                <Card.Title className="text-secondary">Dodaj nowy quiz</Card.Title>
                            </Card.Body>
                            <Card.Footer className="d-flex justify-content-between">
                                <Button
                                    variant={appContext.theme.getOppositeTheme()}
                                    onClick={() => navigate(`/create-quiz`)}
                                >
                                    <Icon icon="mdi:plus"/> Utwórz
                                </Button>
                                <ButtonGroup>
                                    <Button
                                        variant={appContext.theme.getOppositeTheme()}
                                        onClick={() => navigate(`/import-quiz`)}
                                    >
                                        Importuj <Icon icon="mdi:upload"/>
                                    </Button>
                                    <Button
                                        variant={appContext.theme.getOppositeTheme()}
                                        onClick={() => navigate(`/import-quiz-legacy`)}
                                    >
                                        <Icon icon="material-symbols:folder-zip"/>
                                    </Button>
                                </ButtonGroup>
                            </Card.Footer>
                        </Card>
                    </Col>
                </Row>
            ) : (
                <div className="text-center">
                    <p>Nie masz jeszcze żadnych quizów.</p>
                    <Button onClick={() => navigate('/create-quiz')} variant={appContext.theme.getOppositeTheme()}>
                        Stwórz quiz
                    </Button>
                </div>
            )}

            {sharedQuizzes.length > 0 && (
                <>
                    <h2 className="h5 mt-5 mb-4">Udostępnione quizy</h2>
                    <Row xs={1} md={2} lg={3} className="g-4">
                        {sharedQuizzes.map((sq) => (
                            <Col key={sq.id}>
                                <Card className="h-100">
                                    <Card.Body>
                                        <Card.Title>{sq.quiz.title}</Card.Title>
                                        <Card.Text>{sq.quiz.description}</Card.Text>
                                    </Card.Body>
                                    <Card.Footer className="d-flex justify-content-between">
                                        <Button
                                            variant={appContext.theme.getOppositeTheme()}
                                            onClick={() => navigate(`/quiz/${sq.quiz.id}`)}
                                        >
                                            Otwórz
                                        </Button>
                                        <ButtonGroup className="opacity-75">
                                            <Button
                                                variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                                onClick={() => handleDownloadQuiz(sq.quiz)}
                                                size="sm"
                                            >
                                                <Icon icon={"mdi:download"}/>
                                            </Button>
                                            <Button
                                                variant={`outline-${appContext.theme.getOppositeTheme()}`}
                                                onClick={() => handleSearchInQuiz(sq.quiz)}
                                                size="sm"
                                            >
                                                <Icon icon={"mdi:magnify"}/>
                                            </Button>
                                        </ButtonGroup>
                                    </Card.Footer>
                                </Card>
                            </Col>
                        ))}
                    </Row>
                </>
            )}
            <div className="p-5"/>
            {selectedQuizToShare &&
                <ShareQuizModal show={true} onHide={() => setSelectedQuizToShare(null)} quiz={selectedQuizToShare}
                                setQuiz={updateQuiz}/>
            }
        </div>
    );
};

export default QuizzesPage;