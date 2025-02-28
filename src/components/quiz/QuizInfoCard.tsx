import {Quiz, Reoccurrence} from "./types.ts";
import React, {useContext} from "react";
import {Button, ButtonGroup, Card, OverlayTrigger, ProgressBar, Tooltip} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {useNavigate} from "react-router";
import {Icon} from "@iconify/react";
import {toast} from "react-toastify";

interface QuizInfoCardProps {
    quiz: Quiz | null;
    correctAnswersCount: number;
    wrongAnswersCount: number;
    reoccurrences: Reoccurrence[];
    studyTime: number; // in seconds
    resetProgress: () => void;
}

const percentageToColor = (percentage: number) => {
    if (percentage < 25) {
        return "danger";
    } else if (percentage < 50) {
        return "warning";
    } else if (percentage < 75) {
        return "info";
    } else {
        return "success";
    }
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

    const progressPercentage = (reoccurrences.filter(q => q.reoccurrences === 0).length / quiz.questions.length) * 100;

    return (
        <Card className="border-0 shadow">
            <Card.Body>
                <Card.Title>{quiz.title}</Card.Title>
                {quiz.maintainer &&
                    <Card.Subtitle className="mb-2 text-muted">by {quiz.maintainer.full_name}</Card.Subtitle>}
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
                <ProgressBar className="mt-3" now={progressPercentage} variant={percentageToColor(progressPercentage)}/>
                <div className="d-flex justify-content-between mt-3">
                    <ButtonGroup>
                        {appContext.isAuthenticated ? (
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip>Wyszukaj w quizie</Tooltip>}
                            >
                                <Button variant={appContext.theme.getTheme()} size="sm" onClick={openSearchInQuiz}>
                                    <Icon icon="mdi:magnify"/>
                                </Button>
                            </OverlayTrigger>
                        ) : (
                            <OverlayTrigger
                                placement="top"
                                overlay={<Tooltip>Zaloguj się, aby użyć tej funkcji</Tooltip>}
                            >
                                <span className="d-inline-block" style={{cursor: "not-allowed"}}>
                                    <Button variant={appContext.theme.getTheme()} size="sm" disabled>
                                        <Icon icon="mdi:magnify"/>
                                    </Button>
                                </span>
                            </OverlayTrigger>
                        )}
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Kopiuj link do quizu</Tooltip>}
                        >
                            <Button variant={appContext.theme.getTheme()} size="sm" onClick={() => {
                                navigator.clipboard.writeText(window.location.href).then(() => {
                                    toast.success("Skopiowano link do quizu", {
                                        autoClose: 2000,
                                        hideProgressBar: true,
                                    });
                                });
                            }}>
                                <Icon icon="mdi:link"/>
                            </Button>
                        </OverlayTrigger>
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