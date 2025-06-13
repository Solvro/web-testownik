import React, {useContext, useEffect, useState} from 'react';
import {Button, Card, Form, Alert, ButtonGroup} from 'react-bootstrap';
import QuestionForm from '../components/quiz/QuestionForm';
import {Question, Quiz} from "../components/quiz/types.ts";
import AppContext from "../AppContext.tsx";
import {useLocation, useNavigate, useParams} from "react-router";
import PropagateLoader from "react-spinners/PropagateLoader";
import {toast} from "react-toastify";
import {validateQuiz} from "../components/quiz/helpers/quizValidation.ts";

const EditQuizPage: React.FC = () => {
    const {quizId} = useParams<{ quizId: string }>();
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [advancedMode, setAdvancedMode] = useState(false);

    const [prevQuestionId, setPrevQuestionId] = useState<number>(0);

    // State for controlling multiple choice for all questions
    const [allQuestionsMultiple, setAllQuestionsMultiple] = useState<boolean | null>(null);

    // Function to determine the state of all questions multiple property
    const getAllQuestionsMultipleState = (): boolean | null => {
        if (questions.length === 0) return null;
        const allTrue = questions.every(q => q.multiple);
        const allFalse = questions.every(q => !q.multiple);
        if (allTrue) return true;
        if (allFalse) return false;
        return null; // mixed state
    };

    // Update allQuestionsMultiple state when questions change
    useEffect(() => {
        setAllQuestionsMultiple(getAllQuestionsMultipleState());
    }, [questions]);

    // Function to set multiple property for all questions
    const handleSetAllQuestionsMultiple = (multiple: boolean) => {
        setQuestions(prev => prev.map(q => ({...q, multiple})));
    };

    document.title = "Edytuj quiz - Testownik Solvro";

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                if (appContext.isGuest) {
                    const userQuizzes = localStorage.getItem("guest_quizzes") ? JSON.parse(localStorage.getItem("guest_quizzes")!) : [];
                    const quiz = userQuizzes.find((q: Quiz) => q.id === quizId);
                    if (!quiz) {
                        setError('Nie znaleziono quizu.');
                        setLoading(false);
                        return;
                    }
                    setTitle(quiz.title);
                    setDescription(quiz.description || '');
                    setQuestions(quiz.questions || []);
                    if (quiz.questions.some((q: Question) => q.image || q.explanation || q.answers.some((a) => a.image))) {
                        setAdvancedMode(true);
                    }
                    setLoading(false);
                    setPrevQuestionId(quiz.questions.reduce((prev: Question, current: Question) => (prev.id > current.id) ? prev : current).id);
                    return;
                }
                const response = await appContext.axiosInstance.get(`/quizzes/${quizId}/`);
                if (response.status === 200) {
                    const data: Quiz = response.data;
                    setTitle(data.title);
                    setDescription(data.description || '');
                    setQuestions(data.questions || []);
                    if (data.questions.some((q) => q.image || q.explanation || q.answers.some((a) => a.image))) {
                        setAdvancedMode(true);
                    }
                    setPrevQuestionId(data.questions.reduce((prev: Question, current: Question) => (prev.id > current.id) ? prev : current).id);
                    setTimeout(() => {
                        if (location.hash || queryParams.has('scroll_to')) {
                            const element = document.getElementById(window.location.hash.substring(1) || queryParams.get('scroll_to') || '');
                            if (element) {
                                element.scrollIntoView({behavior: "smooth"});
                                if (window.location.hash) {
                                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                                } else {
                                    queryParams.delete('scroll_to');
                                    navigate({
                                        search: queryParams.toString(),
                                    });
                                }
                            }
                        }
                    }, 100);
                } else {
                    setError('Nie udało się załadować quizu.');
                }
            } catch {
                setError('Wystąpił błąd podczas ładowania quizu.');
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, appContext.axiosInstance]);

    const addQuestion = () => {
        setQuestions((prev) => [
            ...prev,
            {
                id: prevQuestionId + 1,
                question: '',
                multiple: true,
                answers: [{answer: '', correct: false, image: ''}, {answer: '', correct: false, image: ''}],
                image: '',
                explanation: ''
            },
        ]);
        setPrevQuestionId(prevQuestionId + 1);
    };

    const updateQuestion = (updatedQuestion: Question) => {
        setQuestions((prev) =>
            prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
        );
    };

    const removeQuestion = (id: number) => {
        setQuestions((prev) => prev.filter((q) => q.id !== id));
    };

    const setErrorAndNotify = (message: string) => {
        setError(message);
        toast.error(message);
    }

    const handleSubmit = async () => {
        const quiz = {
            title, description,
            questions: questions.map((q) => ({
                ...q,
                image: advancedMode ? q.image : undefined,
                explanation: advancedMode ? q.explanation : undefined,
                answers: q.answers.map((a) => ({
                    ...a,
                    image: advancedMode ? a.image : undefined,
                })),
            })),
        };
        const validationError = validateQuiz(quiz as Quiz);
        if (validationError) {
            setErrorAndNotify(validationError);
            return false;
        }

        setError(null);

        try {
            if (appContext.isGuest) {
                const userQuizzes = localStorage.getItem("guest_quizzes") ? JSON.parse(localStorage.getItem("guest_quizzes")!) : [];
                const quizIndex = userQuizzes.findIndex((q: Quiz) => q.id === quizId);
                if (quizIndex === -1) {
                    setErrorAndNotify('Nie znaleziono quizu.');
                    return false;
                }
                userQuizzes[quizIndex] = {...userQuizzes[quizIndex], ...quiz};
                localStorage.setItem("guest_quizzes", JSON.stringify(userQuizzes));
                toast.success('Quiz został zaktualizowany.');
                return true;
            }
            const response = await appContext.axiosInstance.put(`/quizzes/${quizId}/`, quiz);

            if (response.status !== 200) {
                const errorData = await response.data;
                setErrorAndNotify(errorData.error || 'Wystąpił błąd podczas aktualizacji quizu.');
                return false;
            }
        } catch {
            setErrorAndNotify('Wystąpił błąd podczas aktualizacji quizu.');
            return false;
        }
        toast.success('Quiz został zaktualizowany.');
        return true;
    };

    const handleSubmitAndClose = async () => {
        if (await handleSubmit())
            navigate("/");
    };

    const scrollToBottom = () => {
        window.scrollTo({top: document.body.scrollHeight, behavior: 'smooth'});
    };

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

    return (
        <>
            <Card className="border-0 shadow mb-5">
                <Card.Body>
                    <div className="d-flex justify-content-between align-items-center flex-wrap">
                        <h1 className="h5">Edytuj quiz</h1>
                        <Form.Check
                            type="switch"
                            id="advanced-mode-switch"
                            label="Tryb zaawansowany"
                            checked={advancedMode}
                            onChange={(e) => setAdvancedMode(e.target.checked)}
                        />
                    </div>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Tytuł</Form.Label>
                            <Form.Control
                                type="text"
                                placeholder="Podaj tytuł quizu"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Opis</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="Podaj opis quizu"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </Form.Group>

                        {advancedMode && (
                            <Form.Check
                                type="checkbox"
                                id="all-questions-multiple-switch"
                                label="Wielokrotny wybór (dla wszystkich pytań)"
                                checked={allQuestionsMultiple === true}
                                ref={(el: HTMLInputElement | null) => {
                                    if (el) {
                                        el.indeterminate = allQuestionsMultiple === null;
                                    }
                                }}
                                onChange={(e) => handleSetAllQuestionsMultiple(e.target.checked)}
                            />
                        )}

                        <h2 className="h6 mt-4">Pytania</h2>
                        {questions.map((question) => (
                            <QuestionForm
                                key={question.id}
                                question={question}
                                onUpdate={updateQuestion}
                                onRemove={removeQuestion}
                                advancedMode={advancedMode}
                            />
                        ))}
                        <Button
                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                            onClick={addQuestion}
                            className="mt-3"
                        >
                            Dodaj pytanie
                        </Button>
                        <div className="text-center mt-4">
                            <ButtonGroup>
                                <Button onClick={handleSubmitAndClose} variant={appContext.theme.getOppositeTheme()}>
                                    Zapisz i zakończ
                                </Button>
                                <Button onClick={handleSubmit}
                                        variant={`outline-${appContext.theme.getOppositeTheme()}`}>
                                    Zapisz
                                </Button>
                            </ButtonGroup>
                        </div>
                    </Form>
                </Card.Body>
            </Card>
            <Button
                variant={`outline-${appContext.theme.getOppositeTheme()}`}
                style={{
                    position: 'fixed',
                    bottom: '45px',
                    right: '20px',
                    borderRadius: '50%',
                    width: '50px',
                    height: '50px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
                onClick={scrollToBottom}
            >
                ↓
            </Button>
        </>
    );
};

export default EditQuizPage;