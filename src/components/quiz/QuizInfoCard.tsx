import {Quiz, Reoccurrence} from "./types.ts";
import {useContext} from "react";
import {Button, ButtonGroup, Card, OverlayTrigger, ProgressBar, Tooltip} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import {useNavigate} from "react-router";
import {Icon} from "@iconify/react";
import {toast} from "react-toastify";
import "../../styles/quiz.css";

interface QuizInfoCardProps {
    quiz: Quiz | null;
    correctAnswersCount: number;
    wrongAnswersCount: number;
    reoccurrences: Reoccurrence[];
    studyTime: number; // in seconds
    resetProgress: () => void;
}

const getProgressColor = (percentage: number): string => {
    const clampedPercentage = Math.max(0, Math.min(100, percentage));

    // Color stops: [percentage, [r, g, b]]
    const colorStops: [number, [number, number, number]][] = [
        [0, [220, 53, 69]],    // Red
        [25, [255, 193, 7]],   // Yellow
        [50, [23, 162, 184]],  // Cyan
        [75, [13, 110, 253]],  // Blue
        [100, [25, 135, 84]]   // Green
    ];

    // Find the two colors to interpolate between
    for (let i = 0; i < colorStops.length - 1; i++) {
        const [startPercent, startColor] = colorStops[i];
        const [endPercent, endColor] = colorStops[i + 1];

        if (clampedPercentage >= startPercent && clampedPercentage <= endPercent) {
            const ratio = (clampedPercentage - startPercent) / (endPercent - startPercent);
            const r = Math.round(startColor[0] + (endColor[0] - startColor[0]) * ratio);
            const g = Math.round(startColor[1] + (endColor[1] - startColor[1]) * ratio);
            const b = Math.round(startColor[2] + (endColor[2] - startColor[2]) * ratio);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    return 'rgb(25, 135, 84)'; // Default to green
};

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
                <ProgressBar
                    className="mt-3 custom-progress-bar"
                    now={progressPercentage}
                    style={{
                        '--progress-color': getProgressColor(progressPercentage)
                    } as React.CSSProperties}
                />
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