import React, {useContext} from "react";
import {Button, Card, OverlayTrigger, Tooltip} from "react-bootstrap";
import {Icon} from "@iconify/react";
import AppContext from "../../AppContext.tsx";

interface QuizActionButtonsProps {
    onCopy: () => void;
    onOpenChatGPT: () => void;
    onReportIssue: () => void;
    onEditQuestion: () => void;
    toggleBrainrot: () => void;
    isMaintainer: boolean;
    theme: string;
    disabled?: boolean;
}

const QuizActionButtons: React.FC<QuizActionButtonsProps> = ({
                                                                 onCopy,
                                                                 onOpenChatGPT,
                                                                 onReportIssue,
                                                                 onEditQuestion,
                                                                 toggleBrainrot,
                                                                 isMaintainer,
                                                                 theme,
                                                                 disabled = false,
                                                             }) => {
    const appContext = useContext(AppContext);

    return (
        <Card className="border-0 shadow mt-3">
            <Card.Body>
                <div className="d-flex justify-content-around">
                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Kopiuj pytanie i odpowiedzi do schowka</Tooltip>}
                    >
                        <Button variant={theme} onClick={onCopy} disabled={disabled}>
                            <Icon icon="solar:clipboard-bold"/>
                        </Button>
                    </OverlayTrigger>

                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Otwórz pytanie w ChatGPT</Tooltip>}
                    >
                        <Button variant={theme} onClick={onOpenChatGPT} disabled={disabled}>
                            <Icon icon="simple-icons:openai"/>
                        </Button>
                    </OverlayTrigger>

                    {(!isMaintainer && appContext.isAuthenticated && !appContext.isGuest) && (
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Zgłoś problem z pytaniem</Tooltip>}
                        >
                            <Button variant={theme} onClick={onReportIssue} disabled={disabled}>
                                <Icon icon="tabler:message-report-filled"/>
                            </Button>
                        </OverlayTrigger>
                    )}

                    {(isMaintainer) && (
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Edytuj pytanie</Tooltip>}
                        >
                            <Button variant={theme} onClick={onEditQuestion} disabled={disabled}>
                                <Icon icon="mdi:edit"/>
                            </Button>
                        </OverlayTrigger>
                    )}

                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Włącz/wyłącz dodatkowe efekty</Tooltip>}
                    >
                        <Button variant={theme} onClick={toggleBrainrot}>
                            <Icon icon="healthicons:skull-24px"/>
                        </Button>
                    </OverlayTrigger>
                </div>
            </Card.Body>
        </Card>
    );
};

export default QuizActionButtons;