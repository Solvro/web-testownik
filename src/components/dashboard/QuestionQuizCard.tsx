import React, {useState, useEffect, useContext} from "react";
import {Card, Button} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {Link} from "react-router";

interface Answer {
    answer: string;
    correct: boolean;
}

interface Question {
    id: number;
    question: string;
    quiz_title: string;
    quiz_id: number;
    answers: Answer[];
}

const QuestionQuizCard: React.FC = () => {
    const appContext = useContext(AppContext);
    const [questionData, setQuestionData] = useState<Question | null>(null);
    const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
    const [enableEdit, setEnableEdit] = useState<boolean>(false);
    const [result, setResult] = useState<string | null>(null);

    useEffect(() => {
        fetchQuestion();
    }, []);

    const fetchQuestion = async () => {
        try {
            const response = await appContext.axiosInstance.get("/random-question/");
            if (!response.data) {
                setQuestionData(null);
                throw new Error("No questions available");
            }
            const data: Question = response.data;
            setQuestionData(data);
            setSelectedAnswers([]);
            setEnableEdit(true);
            setResult(null);
        } catch {
            setQuestionData(null);
        }
    };

    const toggleAnswer = (index: number) => {
        if (!enableEdit) return;
        setSelectedAnswers((prev) =>
            prev.includes(index)
                ? prev.filter((i) => i !== index)
                : [...prev, index]
        );
    };

    const checkAnswers = () => {
        if (!questionData) return;

        let isCorrect = true;

        questionData.answers.forEach((answer, idx) => {
            const isSelected = selectedAnswers.includes(idx);
            if ((isSelected && !answer.correct) || (!isSelected && answer.correct)) {
                isCorrect = false;
            }
        });

        setResult(isCorrect ? "Poprawna odpowiedź!" : "Niepoprawna odpowiedź.");
        setEnableEdit(false);
    };

    return (
        <Card className="border-0 shadow h-100">
            <Card.Body>
                {questionData ? (
                    <div>
                        <small className="text-muted">Powtórz to jeszcze raz:</small>
                        <h5 className="card-title mb-0">{questionData.question}</h5>
                        <Link to={`/quiz/${questionData.quiz_id}`}
                              className="small text-decoration-none text-secondary">
                            {questionData.quiz_title}
                        </Link>
                        <div className="d-grid gap-2 mt-3 overflow-y-auto" style={{maxHeight: "30rem"}}>
                            {questionData.answers.map((answer, idx) => (
                                <Button
                                    key={idx}
                                    className={`w-100 ${selectedAnswers.includes(idx) ? "active" : ""} ${result && answer.correct && !selectedAnswers.includes(idx) ? "opacity-50" : ""}`}
                                    size="sm"
                                    variant={
                                        result
                                            ? answer.correct
                                                ? "success"
                                                : selectedAnswers.includes(idx)
                                                    ? "danger"
                                                    : "secondary"
                                            : appContext.theme.getTheme()
                                    }
                                    onClick={() => toggleAnswer(idx)}
                                    disabled={!enableEdit}
                                >
                                    {answer.answer}
                                </Button>
                            ))}
                        </div>
                        {result && (
                            <h5 className={`card-title mt-3 text-${result.includes("Poprawna") ? "success" : "danger"}`}>
                                {result}
                            </h5>
                        )}
                        <div className="d-flex justify-content-end mt-2">
                            {enableEdit ? (
                                <Button variant={appContext.theme.getOppositeTheme()} size="sm" onClick={checkAnswers}>
                                    Sprawdź odpowiedź
                                </Button>
                            ) : (
                                <Button
                                    className="ms-2"
                                    variant={appContext.theme.getOppositeTheme()}
                                    size="sm"
                                    onClick={fetchQuestion}
                                >
                                    Następne pytanie
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div>
                        <h5 className="card-title">Nie ma żadnych pytań do powtórzenia.</h5>
                        <p className="small text-muted">Po użyciu twojej pierwszej bazy pojawią się tutaj pytania.</p>
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default QuestionQuizCard;