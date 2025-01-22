import React, {useContext} from 'react';
import {Button, Form, Row, Col} from 'react-bootstrap';
import {Answer, Question} from "./types.ts";
import AppContext from "../../AppContext.tsx";

type Props = {
    question: Question;
    onUpdate: (updatedQuestion: Question) => void;
    onRemove: (id: number) => void;
    advancedMode?: boolean;
};

const QuestionForm: React.FC<Props> = ({question, onUpdate, onRemove, advancedMode = false}) => {
    const appContext = useContext(AppContext);

    const handleTextChange = (text: string) => {
        onUpdate({...question, question: text});
    };

    const handleExplanationChange = (explanation: string) => {
        onUpdate({...question, explanation});
    };

    const handleImageUrlChange = (image: string) => {
        onUpdate({...question, image});
    };

    const addAnswer = () => {
        const newAnswer = {answer: '', correct: false, image: ''};
        onUpdate({...question, answers: [...question.answers, newAnswer]});
    };

    const updateAnswer = (index: number, updatedAnswer: Answer) => {
        const updatedAnswers = question.answers.map((a, i) =>
            i === index ? updatedAnswer : a
        );
        onUpdate({...question, answers: updatedAnswers});
    };

    const removeAnswer = (index: number) => {
        const updatedAnswers = question.answers.filter((_, i) => i !== index);
        onUpdate({...question, answers: updatedAnswers});
    };

    return (
        <div className="border rounded p-3 mb-3" id={`question-${question.id}`}>
            <Form.Group className="mb-3">
                <Form.Label>Pytanie {question.id}</Form.Label>
                <Form.Control
                    type="text"
                    as="textarea"
                    placeholder="Podaj treść pytania"
                    value={question.question}
                    onChange={(e) => handleTextChange(e.target.value)}
                />
            </Form.Group>

            {advancedMode && (
                <>
                    <Form.Group className="mb-3">
                        <Form.Label>URL zdjęcia dla pytania</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Podaj URL zdjęcia"
                            value={question.image || ''}
                            onChange={(e) => handleImageUrlChange(e.target.value)}
                        />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label>Wyjaśnienie</Form.Label>
                        <Form.Control
                            as="textarea"
                            rows={3}
                            placeholder="Podaj wyjaśnienie pytania"
                            value={question.explanation || ''}
                            onChange={(e) => handleExplanationChange(e.target.value)}
                        />
                    </Form.Group>
                </>
            )}

            <h6>Odpowiedzi</h6>
            {question.answers.map((answer, index) => (
                <Row key={index} className="align-items-center mb-2">
                    <Col>
                        <Form.Control
                            type="text"
                            placeholder="Treść odpowiedzi"
                            value={answer.answer}
                            onChange={(e) =>
                                updateAnswer(index, {
                                    ...answer,
                                    answer: e.target.value,
                                })
                            }
                        />
                    </Col>
                    {advancedMode && (
                        <Col>
                            <Form.Control
                                type="text"
                                placeholder="URL zdjęcia dla odpowiedzi"
                                value={answer.image || ''}
                                onChange={(e) =>
                                    updateAnswer(index, {
                                        ...answer,
                                        image: e.target.value,
                                    })
                                }
                            />
                        </Col>
                    )}
                    <Col xs="auto">
                        <Form.Check
                            type="checkbox"
                            checked={answer.correct}
                            onChange={(e) =>
                                updateAnswer(index, {
                                    ...answer,
                                    correct: e.target.checked,
                                })
                            }
                        />
                    </Col>
                    <Col xs="auto">
                        <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeAnswer(index)}
                        >
                            Usuń
                        </Button>
                    </Col>
                </Row>
            ))}
            <div className="d-flex gap-2">
                <Button
                    variant={`outline-${appContext.theme.getOppositeTheme()}`}
                    size="sm"
                    onClick={addAnswer}
                >
                    Dodaj odpowiedź
                </Button>
                <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => onRemove(question.id)}
                >
                    Usuń pytanie
                </Button>
            </div>
        </div>
    );
};

export default QuestionForm;