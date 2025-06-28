import React, {useEffect, useState} from "react";
import {useParams} from "react-router";
import {Alert, Card, Form} from "react-bootstrap";
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

    document.title = `Wyszukaj w quizach - ${quiz?.title || "Ładowanie..."} - Testownik Solvro`;

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
        const queryWords = lowerCaseQuery.split(/\s+/).filter(word => word.length > 1);
        const typoToleranceThreshold = 3;

        const filtered = quiz.questions
            .map((question) => {
                const questionLower = question.question.toLowerCase();
                const questionWords = questionLower.split(/\s+/).filter(word => word.length > 0);
                const questionWordCount = questionWords.length;

                // Check for exact matches first
                const exactMatch = questionLower.includes(lowerCaseQuery);

                // Check for word-level matches
                let wordMatches = 0;
                let bestWordDistance = Infinity;

                if (queryWords.length > 0) {
                    // Count how many query words appear in the question
                    queryWords.forEach(qWord => {
                        if (questionWords.some(word => word.includes(qWord))) {
                            wordMatches++;
                        }

                        // Find closest word match for typo tolerance
                        questionWords.forEach(word => {
                            const wordDistance = distance(word, qWord);
                            bestWordDistance = Math.min(bestWordDistance, wordDistance);
                        });
                    });
                }

                // Check answers for matches
                const answerMatches = question.answers.some((answer) =>
                    answer.answer.toLowerCase().includes(lowerCaseQuery)
                );

                // Number of answer matches
                const answerMatchCount = question.answers.filter(
                    answer => answer.answer.toLowerCase().includes(lowerCaseQuery)
                ).length;

                // Calculate relevance score - lower is better
                let relevance = exactMatch ? -200 : 0;

                // Boost for word matches
                relevance -= wordMatches * 50;

                // Only use typo tolerance if we have some word matches or exact matches
                if (!exactMatch && wordMatches === 0) {
                    relevance = 1000; // High relevance (bad) for no matches
                } else if (!exactMatch && bestWordDistance !== Infinity) {
                    relevance += bestWordDistance;
                }

                // Boost for answer matches
                relevance -= answerMatchCount * 30;

                // Calculate match density (ratio of matches to question length)
                const matchDensity = questionWordCount > 0 ? wordMatches / questionWordCount : 0;

                console.log(`Question: ${question.question}, Relevance: ${relevance}, Word Matches: ${wordMatches}, Exact Match: ${exactMatch}, Match Density: ${matchDensity}`);
                return {
                    ...question,
                    relevance,
                    matchesAnswer: answerMatches,
                    hasExactMatch: exactMatch,
                    wordMatchCount: wordMatches,
                    questionWordCount,
                    matchDensity
                };
            })
            .filter(
                (question) =>
                    question.hasExactMatch || // Always include exact matches
                    question.matchesAnswer || // Always include answer matches
                    (question.wordMatchCount > 0 && ( // Only include if we have actual word matches
                        question.relevance <= typoToleranceThreshold || // Good typo tolerance
                        question.matchDensity >= 0.30 || // At least 15% of words match
                        question.wordMatchCount >= 3    // Or at least 2 words match
                    ))
            )
            .sort((a, b) => a.relevance - b.relevance);

        setFilteredQuestions(filtered);
    }, [query, quiz]);

    // Function to highlight the matched text
    const highlightMatch = (text: string, query: string): React.ReactNode => {
        if (!query) return text;

        const regex = new RegExp(`(${query})`, "gi");
        const parts = text.split(regex);

        return parts.map((part, index) =>
            regex.test(part) ? (
                <span key={index}
                      style={{backgroundColor: appContext.theme.getTheme() === "dark" ? "rgba(159,159,159,0.32)" : "#ff0"}}>
                    {part}
                </span>
            ) : (
                part
            )
        );
    };

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
                    placeholder="Wyszukaj w pytaniach lub odpowiedziach..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </Form.Group>

            {filteredQuestions.length > 0 ? (
                filteredQuestions.map((question) => (
                    <Card key={question.id} className="mb-3">
                        <Card.Body>
                            <Card.Title>
                                {highlightMatch(question.question, query)}
                                {question.image && (
                                    <img src={question.image} alt={question.question}
                                         className="d-block mx-auto rounded mw-100"/>
                                )}
                            </Card.Title>
                            <ul className="list-unstyled">
                                {question.answers.map((answer, index) => (
                                    <li
                                        key={index}
                                        className={answer.correct ? "text-success" : "text-muted"}
                                    >
                                        {highlightMatch(answer.answer, query)}
                                        {answer.image && (
                                            <img src={answer.image} alt={answer.answer}
                                                 style={{borderStyle: answer.correct ? "solid" : "none"}}
                                                 className={"d-block mx-auto rounded mw-100" + (answer.correct ? " border-success border-3" : "")}/>
                                        )}
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