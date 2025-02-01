import React, {useContext, useState} from 'react';
import {Button, Card, Form, Alert} from 'react-bootstrap';
import QuestionForm from '../components/quiz/QuestionForm';
import {Question, Quiz} from "../components/quiz/types.ts";
import AppContext from "../AppContext.tsx";
import QuizPreviewModal from "../components/quiz/QuizPreviewModal.tsx";
import {useNavigate} from "react-router";
import {toast} from "react-toastify";
import {validateQuiz} from "../components/quiz/helpers/quizValidation.ts";
import {uuidv4} from "../components/quiz/helpers/uuid.ts";


const CreateQuizPage: React.FC = () => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [questions, setQuestions] = useState<Question[]>([{
        id: 1,
        question: '',
        multiple: true,
        answers: [{answer: '', correct: false}, {answer: '', correct: false}]
    }]);
    const [error, setError] = useState<string | null>(null);
    const [quiz, setQuiz] = useState<Quiz | null>(null); // Result of the quiz creation

    document.title = "Stwórz quiz - Testownik Solvro";

    const addQuestion = () => {
        setQuestions((prev) => [
            ...prev,
            {
                id: prev.length + 1,
                question: '',
                multiple: true,
                answers: [{answer: '', correct: false}, {answer: '', correct: false}]
            },
        ]);
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
            title,
            description,
            questions,
        }
        const validationError = validateQuiz(quiz as Quiz);
        if (validationError) {
            setErrorAndNotify(validationError);
            return false;
        }


        setError(null);

        try {
            if (appContext.isGuest) {
                const userQuizzes = localStorage.getItem('guest_quizzes') ? JSON.parse(localStorage.getItem('guest_quizzes')!) : []
                const tempQuiz = {
                    ...quiz,
                    id: uuidv4(),
                    visibility: 0,
                    version: 1,
                    allow_anonymous: false,
                    is_anonymous: true
                }
                userQuizzes.push(tempQuiz)
                localStorage.setItem('guest_quizzes', JSON.stringify(userQuizzes))
                setQuiz(tempQuiz);
                return;
            }
            const response = await appContext.axiosInstance.post('/quizzes/', quiz);

            if (response.status === 201) {
                const result = await response.data;
                setQuiz(result);
            } else {
                const errorData = await response.data;
                setErrorAndNotify(errorData.error || 'Wystąpił błąd podczas importowania quizu.');
            }
        } catch {
            setErrorAndNotify('Wystąpił błąd podczas importowania quizu.');
        }
    };

    return (
        <>
            <Card className="border-0 shadow p-4">
                <h1 className="h5">Stwórz nowy quiz</h1>
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

                    <h2 className="h6 mt-4">Pytania</h2>
                    {questions.map((question) => (
                        <QuestionForm
                            key={question.id}
                            question={question}
                            onUpdate={updateQuestion}
                            onRemove={removeQuestion}
                        />
                    ))}
                    <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={addQuestion}
                            className="mt-3">
                        Dodaj pytanie
                    </Button>
                    <div className="text-center mt-4">
                        <Button onClick={handleSubmit} variant={appContext.theme.getOppositeTheme()}>
                            Stwórz quiz
                        </Button>
                    </div>
                </Form>
            </Card>
            <QuizPreviewModal show={quiz !== null} onHide={() => navigate("/")} quiz={quiz} type="created"/>
        </>
    );
};

export default CreateQuizPage;