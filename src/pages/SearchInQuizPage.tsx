import React, {useEffect, useState} from "react";
import {useParams} from "react-router";
import {Card, Form, Alert} from "react-bootstrap";
import {distance} from "fastest-levenshtein";
import AppContext from "../AppContext.tsx";
import {Question, Quiz} from "../components/quiz/types.ts";

const SearchInQuizPage: React.FC = () => {
    const {quizId} = useParams<{ quizId: string }>();
    const appContext = React.useContext(AppContext);

    const [quiz, setQuiz] = useState<Quiz | null>(null);
    const [query, setQuery] = useState<string>("");
    const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    document.title = `Wyszukaj w bazie - ${quiz?.title || "Ładowanie..."} - Testownik Solvro`;

    useEffect(() => {
        const fetchQuiz = async () => {
            setLoading(true);
            try {
                const response = await appContext.axiosInstance.get(`/quizzes/${quizId}/`);
                if (response.status === 200) {
                    const data: Quiz = response.data;
                    setQuiz(data);
                    setFilteredQuestions(data.questions);
                } else {
                    setError("Nie udało się załadować quizu.");
                }
            } catch {
                setError("Wystąpił błąd podczas ładowania quizu.");
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [quizId, appContext.axiosInstance]);

    useEffect(() => {
        if (!quiz || !query.trim()) {
            setFilteredQuestions(quiz?.questions || []);
            return;
        }

        const lowerCaseQuery = query.toLowerCase().trim();
        const typoToleranceThreshold = 3; // Maximum distance for fuzzy matching

        const filtered = quiz.questions
            .map((question) => ({
                ...question,
                relevance: question.question.toLowerCase().includes(lowerCaseQuery) ? distance(question.question.toLowerCase(), lowerCaseQuery) - 100 : distance(question.question.toLowerCase(), lowerCaseQuery),
            }))
            .filter(
                (question) =>
                    question.relevance <= typoToleranceThreshold || // Allow fuzzy matches
                    question.question.toLowerCase().includes(lowerCaseQuery) // Exact or substring match
            )
            .sort((a, b) => a.relevance - b.relevance);

        setFilteredQuestions(filtered);
    }, [query, quiz]);

    if (loading) {
        return <div className="text-center">Ładowanie...</div>;
    }

    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <div className="p-4">
            <h1 className="h4 mb-4">{quiz?.title}</h1>
            {quiz?.description && <p className="mb-4">{quiz.description}</p>}

            <Form.Group className="mb-4">
                <Form.Control
                    type="text"
                    placeholder="Wyszukaj w pytaniach..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </Form.Group>

            {filteredQuestions.length > 0 ? (
                filteredQuestions.map((question) => (
                    <Card key={question.id} className="mb-3">
                        <Card.Body>
                            <Card.Title>{question.question}</Card.Title>
                            <ul className="list-unstyled">
                                {question.answers.map((answer, index) => (
                                    <li
                                        key={index}
                                        className={answer.correct ? "text-success" : "text-muted"}
                                    >
                                        {answer.answer}
                                    </li>
                                ))}
                            </ul>
                        </Card.Body>
                    </Card>
                ))
            ) : (
                <Alert variant="info">Brak wyników dla podanego zapytania.</Alert>
            )}
        </div>
    );
};

export default SearchInQuizPage;