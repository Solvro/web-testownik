import React, { useContext, useState } from 'react';
import { Modal, Button, InputGroup, Form } from 'react-bootstrap';
import AppContext from '../AppContext.tsx';
import axios from 'axios';
import { SERVER_URL } from '../config.ts';

interface ReportBugModalProps {
    show: boolean;
    onHide: () => void;
}

const ReportBugModal: React.FC<ReportBugModalProps> = ({ show, onHide }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [content, setContent] = useState('');
    const [isSending, setIsSending] = useState(false);

    const handleSend = () => {
        setIsSending(true);

        if (!name || !email || !content) {
            alert('Wypełnij wszystkie pola!');
            return;
        }

        axios
            .post(`${SERVER_URL}/feedback/send`, { name, email, content })
            .then(() => {
                setName('');
                setEmail('');
                setContent('');
                onHide();
                alert('Dziękujemy za zgłoszenie błędu!');
            })
            .catch((error) => {
                alert('Wystąpił błąd podczas wysyłania zgłoszenia!');
                console.error(error);
            })
            .finally(() => {
                setIsSending(false);
            });
    };

    const appContext = useContext(AppContext);
    return (
        <Modal
            id="reportBugModal"
            tabIndex={-1}
            aria-labelledby="reportBugModalLabel"
            aria-hidden="true"
            show={show}
            onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title id="reportBugModalLabel">
                    Zgłoś błąd w Testowniku
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div>
                    <Form.Label htmlFor="name" className="access-level-label">
                        Twoja nazwa
                    </Form.Label>
                    <InputGroup>
                        <Form.Control
                            disabled={isSending}
                            placeholder="Jan Kowalski"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSend();
                                }
                            }}
                        />
                    </InputGroup>
                    <Form.Label htmlFor="email" className="access-level-label">
                        Adres e-mail
                    </Form.Label>
                    <InputGroup>
                        <Form.Control
                            disabled={isSending}
                            id="email"
                            aria-describedby="email"
                            placeholder="jan.kowalski@solvro.pl"
                            value={email}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSend();
                                }
                            }}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </InputGroup>
                    <Form.Label
                        htmlFor="content"
                        className="access-level-label">
                        Treść
                    </Form.Label>
                    <InputGroup>
                        <Form.Control
                            disabled={isSending}
                            id="content"
                            placeholder="Treść zgłoszenia"
                            as="textarea"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleSend();
                                }
                            }}
                        />
                    </InputGroup>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <div className="d-inline-flex gap-1 align-items-center">
                    <Button
                        variant={`outline-${appContext.theme.getOppositeTheme()}`}
                        onClick={onHide}>
                        Anuluj
                    </Button>
                    <Button
                        disabled={isSending}
                        variant="primary"
                        onClick={handleSend}
                        className="w-100">
                        Wyślij formularz
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default ReportBugModal;
