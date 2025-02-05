import React, {useContext, useEffect, useRef, useState} from "react";
import {Modal, Button, Form} from "react-bootstrap";
import {toast} from "react-toastify";
import {AxiosError} from "axios";
import AppContext from "../../AppContext.tsx";

interface ReportQuestionIssueModalProps {
    show: boolean;
    onClose: () => void;
    quizId?: string;
    questionId?: number;
}

const ReportQuestionIssueModal: React.FC<ReportQuestionIssueModalProps> = ({show, onClose, quizId, questionId}) => {
    const appContext = useContext(AppContext);
    const [issue, setIssue] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const issueRef = useRef<HTMLTextAreaElement>(null);


    useEffect(() => {
        if (!quizId) {
            console.error("Quiz ID is not set in ReportQuestionIssueModal");
            onClose();
        }
        if (!questionId) {
            console.error("Question ID is not set in ReportQuestionIssueModal");
            onClose();
        }
        if (issueRef.current && !isFocused) {
            issueRef.current.focus();
            setIsFocused(true);
        }
    }, [questionId, quizId, onClose, isFocused]);

    const handleSubmit = async () => {
        if (!issue.trim()) {
            toast.error("Nie podano opisu błędu, zgłoszenie nie zostało wysłane.");
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await appContext.axiosInstance.post("/report-quiz-error/", {
                quiz_id: quizId,
                question_id: questionId,
                issue: issue,
            });

            if (response.status === 201) {
                toast.success("Zgłoszenie zostało wysłane do właściciela quizu. Dziękujemy!");
                setIssue("");
            } else {
                toast.error("Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później. \n" + response.data);
            }
        } catch (e) {
            console.error("Error reporting incorrect question:", e);
            if (e instanceof AxiosError) {
                toast.error("Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później. \n" + e.response?.data.error);
            } else {
                toast.error("Wystąpił błąd podczas wysyłania zgłoszenia. Spróbuj ponownie później.");
            }
        } finally {
            setIsSubmitting(false);
            onClose();
        }
    };

    return (
        <Modal show={show} onHide={onClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>Zgłoś problem z pytaniem</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form.Group>
                    <Form.Label>Opisz błąd:</Form.Label>
                    <Form.Control
                        as="textarea"
                        ref={issueRef}
                        rows={3}
                        value={issue}
                        onChange={(e) => setIssue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key !== "Escape") {
                                e.stopPropagation();
                            }
                        }}
                        placeholder="Opisz co jest nie tak z tym pytaniem..."
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={onClose}>
                    Anuluj
                </Button>
                <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? "Wysyłanie..." : "Wyślij zgłoszenie"}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ReportQuestionIssueModal;