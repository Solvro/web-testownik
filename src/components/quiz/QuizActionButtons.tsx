import React from "react";
import {Button, Card, OverlayTrigger, Tooltip} from "react-bootstrap";
import {Icon} from "@iconify/react";

interface QuizActionButtonsProps {
    onCopy: () => void;
    onOpenChatGPT: () => void;
    onReportIssue: () => void;
    toggleBrainrot: () => void;
    isMaintainer: boolean;
    theme: string;
}

const QuizActionButtons: React.FC<QuizActionButtonsProps> = ({
                                                                 onCopy,
                                                                 onOpenChatGPT,
                                                                 onReportIssue,
                                                                 toggleBrainrot,
                                                                 isMaintainer,
                                                                 theme,
                                                             }) => {
    return (
        <Card className="border-0 shadow mt-3">
            <Card.Body>
                <div className="d-flex justify-content-around">
                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Kopiuj pytanie i odpowiedzi do schowka</Tooltip>}
                    >
                        <Button variant={theme} onClick={onCopy}>
                            <Icon icon="solar:clipboard-bold"/>
                        </Button>
                    </OverlayTrigger>

                    <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Otwórz pytanie w ChatGPT</Tooltip>}
                    >
                        <Button variant={theme} onClick={onOpenChatGPT}>
                            <Icon icon="simple-icons:openai"/>
                        </Button>
                    </OverlayTrigger>

                    {!isMaintainer && (
                        <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Zgłoś problem z pytaniem</Tooltip>}
                        >
                            <Button variant={theme} onClick={onReportIssue}>
                                <Icon icon="tabler:message-report-filled"/>
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