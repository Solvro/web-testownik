import React, {useContext, useEffect} from 'react';
import {Card, Button} from 'react-bootstrap';
import {Answer, Question} from "./types.ts";
import AppContext from "../../AppContext.tsx";
import Markdown from 'marked-react';
import {DotLottieReact} from "@lottiefiles/dotlottie-react";

interface QuestionCardProps {
    question: Question | null;
    selectedAnswers: number[];
    setSelectedAnswers: (selectedAnswers: number[]) => void;
    questionChecked: boolean;
    nextAction: () => void;
    isQuizFinished: boolean;
}

const QuestionCard: React.FC<QuestionCardProps> = ({
                                                       question,
                                                       selectedAnswers,
                                                       setSelectedAnswers,
                                                       questionChecked,
                                                       nextAction,
                                                       isQuizFinished,
                                                   }) => {
    const appContext = useContext(AppContext);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Only process number keys 1-9
            if (event.key >= '1' && event.key <= '9') {
                const answerIndex = parseInt(event.key, 10) - 1;
                if (question && answerIndex < question.answers.length) {
                    handleAnswerClick(answerIndex);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [question, selectedAnswers]);


    if (isQuizFinished) {
        return (
            <Card className="border-0 shadow">
                <Card.Body>
                    <Card.Title>Quiz został ukończony</Card.Title>
                    <Card.Text>
                        Gratulacje! Ukończyłeś cały quiz. Aby kontynuować naukę, zresetuj swoje postępy korzystając z
                        przycisku po prawej stronie.
                    </Card.Text>
                    <DotLottieReact
                        src="https://lottie.host/dfccc02f-66a0-41dc-894c-c5f376a1f8dd/nMskjwo4wX.lottie"
                        loop
                        autoplay
                    />
                    <Card.Text className="mt-3 text-center text-muted">
                        Idź się napić piwka, no i odpocznij - zasłużyłeś!
                    </Card.Text>
                </Card.Body>
            </Card>
        );
    }

    if (!question) {
        return null;
    }
    const getAnswerVariant = (answer: Answer, answerId: number) => {
        if (questionChecked) {
            if (answer.correct) {
                return 'success';
            } else if (selectedAnswers.includes(answerId)) {
                return 'danger';
            } else {
                return 'secondary';
            }
        }
        return appContext.theme.getTheme();
    };

    const getAnswerAdditionalClasses = (answer: Answer, answerId: number) => {
        if (questionChecked) {
            if (answer.correct && !selectedAnswers.includes(answerId)) {
                return 'opacity-50';
            }
            return '';
        }
    };

    // Check if the question was answered correctly with all required answers
    const isQuestionAnsweredCorrectly = () => {
        return questionChecked && question.answers.filter((answer, idx) => {
            return answer.correct !== selectedAnswers.includes(idx);
        }).length === 0;
    }

    const handleAnswerClick = (idx: number) => {
        if (questionChecked) {
            return;
        }
        const newSelectedAnswers = [...selectedAnswers];
        const answerIndex = newSelectedAnswers.indexOf(idx);

        if (question.multiple) {
            if (answerIndex === -1) {
                newSelectedAnswers.push(idx); // Add answer if not already selected
            } else {
                newSelectedAnswers.splice(answerIndex, 1); // Remove answer if already selected
            }
        } else {
            // If the answer is already selected, remove it
            if (answerIndex !== -1) {
                newSelectedAnswers.splice(answerIndex, 1);
            }
            if (answerIndex === -1) {
                newSelectedAnswers.splice(0, newSelectedAnswers.length, idx);
            }
        }

        setSelectedAnswers(newSelectedAnswers);
    };

    return (
        <Card className="border-0 shadow">
            <Card.Body>
                <div>
                    <Markdown>{question.id + ". " + question.question}</Markdown>
                    {question.image && (
                        <img src={question.image} alt={question.question} className="d-block mx-auto rounded mw-100"/>
                    )}
                </div>
                <div className="mt-3 d-flex flex-column gap-2">
                    {question.answers.map((answer: Answer, idx: number) => (
                        <Button
                            key={`answer-${idx}`}
                            id={`answer-${idx}`}
                            variant={getAnswerVariant(answer, idx)}
                            onClick={() => handleAnswerClick(idx)}
                            className={`answer ${selectedAnswers.includes(idx) ? 'active' : ''} ${getAnswerAdditionalClasses(answer, idx)}`}
                            disabled={questionChecked}
                        >
                            <div className="d-flex justify-content-between align-items-center flex-column">
                                {answer.answer}
                                {answer.image && (
                                    <img src={answer.image} alt={answer.answer}
                                         className="d-block mx-auto rounded mb-2 mw-100"/>
                                )}
                            </div>
                        </Button>
                    ))}
                </div>
                <div className="mt-3">
                    {questionChecked && !selectedAnswers.length ? (
                        <p className="text-danger">Nie wybrano odpowiedzi</p>
                    ) : questionChecked && isQuestionAnsweredCorrectly() ? (
                        <p className="text-success">Poprawna odpowiedź!</p>
                    ) : questionChecked && (
                        <p className="text-danger">Niepoprawna odpowiedź.</p>
                    )}
                </div>
                <div className="y-2 text-end">
                    {questionChecked ? (
                        <Button variant={appContext.theme.getOppositeTheme()} onClick={nextAction}>
                            Następne pytanie
                        </Button>
                    ) : (
                        <Button variant={appContext.theme.getOppositeTheme()} onClick={nextAction}>
                            Sprawdź odpowiedź
                        </Button>
                    )}
                </div>
                <div id="explanation" className="mt-3"></div>
            </Card.Body>
        </Card>
    );
};

export default QuestionCard;