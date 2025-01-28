import React, {useContext} from 'react';
import {Modal, Button, ListGroup, Alert, ButtonGroup, Card} from 'react-bootstrap';
import {Quiz} from './types';
import AppContext from "../../AppContext.tsx";
import {useNavigate} from "react-router";
import ShareQuizModal from "./ShareQuizModal/ShareQuizModal.tsx";

interface QuizPreviewModalProps {
    show: boolean;
    onHide: () => void;
    quiz: Quiz | null;
    type: 'created' | 'imported'; // To distinguish between created and imported quizzes
}

const QuizPreviewModal: React.FC<QuizPreviewModalProps> = ({show, onHide, quiz, type}) => {
    const appContext = useContext(AppContext);
    const navigate = useNavigate();
    const [showShareModal, setShowShareModal] = React.useState(false);

    if (!quiz) return null;

    const {id, title, description, questions} = quiz;
    const previewQuestions = questions.slice(0, 10);

    const handleShare = () => {
        setShowShareModal(true);
    };

    const handleEdit = () => {
        navigate(`/edit-quiz/${id}`);
    };

    const handleOpen = () => {
        navigate(`/quiz/${id}`);
    };

    return (
        <>
            <Modal show={show} onHide={onHide} size="lg" centered>
                <Modal.Header closeButton>
                    <Modal.Title>{type === 'created' ? 'Baza została utworzona' : 'Baza została zaimportowana'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {quiz ? (
                        <>
                            <h5>{title}</h5>
                            <p className="text-muted">{description || 'Brak opisu'}</p>
                            <h6>Pytania {questions.length > 10 ? `(pierwsze 10, łącznie ${questions.length})` : `(${questions.length})`}: </h6>
                            <div style={{maxHeight: '20rem', overflowY: 'auto'}}>
                                {previewQuestions.map((question) => (
                                    <Card key={question.id}
                                          className={`mb-2 bg-opacity-10 border-0 bg-${appContext.theme.getOppositeTheme()}`}>
                                        <Card.Body>
                                            <Card.Title style={{fontSize: "1rem"}}>{question.question}</Card.Title>
                                            <ListGroup variant="flush">
                                                {question.answers.map((answer) => (
                                                    <ListGroup.Item key={answer.answer}
                                                                    variant={answer.correct ? 'success' : 'danger'}>
                                                        {answer.answer}
                                                    </ListGroup.Item>
                                                ))}
                                            </ListGroup>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        </>
                    ) : (
                        <Alert variant="danger">Brak danych do wyświetlenia bazy.</Alert>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <ButtonGroup>
                        <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={handleOpen}>
                            Otwórz
                        </Button>
                        <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={handleShare}>
                            Udostępnij
                        </Button>
                        <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={handleEdit}>
                            Edytuj
                        </Button>
                    </ButtonGroup>
                    <Button variant={`${appContext.theme.getOppositeTheme()}`} onClick={onHide}>
                        Zamknij
                    </Button>
                </Modal.Footer>
            </Modal>
            <ShareQuizModal show={showShareModal} onHide={() => setShowShareModal(false)} quiz={quiz}/>
        </>
    );
};

export default QuizPreviewModal;