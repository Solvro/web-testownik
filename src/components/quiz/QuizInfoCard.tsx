import {Quiz, Reoccurrence} from "./types.ts";
import React, {useContext} from "react";
import {Button, ButtonGroup, Card} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {useNavigate} from "react-router";
import {Icon} from "@iconify/react";

interface QuizInfoCardProps {
    quiz: Quiz | null;
    correctAnswersCount: number;
    wrongAnswersCount: number;
    reoccurrences: Reoccurrence[];
    studyTime: number; // in seconds
    resetProgress: () => void;
}

const QuizInfoCard: React.FC<QuizInfoCardProps> = ({
                                                       quiz,
                                                       correctAnswersCount,
                                                       wrongAnswersCount,
                                                       reoccurrences,
                                                       studyTime,
                                                       resetProgress
                                                   }) => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    if (!quiz) {
        return null;
    }

    const openSearchInQuiz = () => {
        navigate(`/search-in-quiz/${quiz.id}`);
    }

    return (
        <Card className="border-0 shadow">
            <Card.Body>
                <Card.Title>{quiz.title}</Card.Title>
                {quiz.maintainer && <Card.Subtitle className="mb-2 text-muted">by {quiz.maintainer.full_name}</Card.Subtitle>}
                <div>
                    <div className="d-flex justify-content-between">
                        <span>Udzielone odpowiedzi</span>
                        <span className="text-success">{correctAnswersCount + wrongAnswersCount}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                        <span>Opanowane pytania</span>
                        <span
                            className="text-secondary">{reoccurrences.filter(q => q.reoccurrences === 0).length}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                        <span>Liczba pytań</span>
                        <span className="text-success">{quiz.questions.length}</span>
                    </div>
                    <div className="d-flex justify-content-between">
                        <span>Czas nauki</span>
                        <span className="text-success">{new Date(studyTime * 1000).toISOString().slice(11, 19)}</span>
                    </div>
                </div>
                <div className="d-flex justify-content-between mt-3">
                    <ButtonGroup>
                        <Button variant={appContext.theme.getTheme()} size="sm" onClick={openSearchInQuiz}>
                            <Icon icon="mdi:magnify"/>
                        </Button>
                    </ButtonGroup>
                    <Button className="text-danger bg-danger bg-opacity-25 border-0" size="sm" onClick={resetProgress}>
                        Reset
                    </Button>
                </div>
            </Card.Body>
        </Card>
    )
};

export default QuizInfoCard;