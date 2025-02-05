/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useState } from 'react';
import { Modal, Button, Form, Row, Col } from 'react-bootstrap';
import AppContext from '../AppContext.tsx';
import axios from 'axios';
import { SERVER_URL } from '../config.ts';

interface ReportBugModalProps {
    show: boolean;
    onHide: () => void;
}

const DEFAULT_FORM_STATE = {
    name: '',
    email: '',
    title: '',
    content: '',
    sendDiagnostics: false,
    diagnostic: '',
    reportType: 'bug',
};

const ReportBugModal: React.FC<ReportBugModalProps> = ({ show, onHide }) => {
    const [form, setForm] = useState(DEFAULT_FORM_STATE);
    const [isSending, setIsSending] = useState(false);

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) => {
        const { id, value, type, checked } = e.target as HTMLInputElement;
        setForm((prev) => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSend = () => {
        setIsSending(true);

        if (!form.name || !form.content || !form.title) {
            alert('Wypełnij wszystkie pola!');
            setIsSending(false);
            return;
        }

        if (form.sendDiagnostics) {
            const diagnostics = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,

                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight,

                location: window.location.href,
                localStorage: JSON.stringify(localStorage),
                sessionStorage: JSON.stringify(sessionStorage),
            };
            form.diagnostic = JSON.stringify(diagnostics, null, 2);
        }

        axios
            .post(`${SERVER_URL}/feedback/send`, {
                ...form,
                sendDiagnostics: form.sendDiagnostics ? 'true' : 'false',
            })
            .then(() => {
                setForm(DEFAULT_FORM_STATE);
                onHide();
                alert('Dziękujemy za zgłoszenie!');
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
        <Modal show={show} onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title>Zgłoszenie błędu lub sugestia</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Row className="mb-3">
                    <Form.Group as={Col} controlId="name">
                        <Form.Label>Twoja nazwa</Form.Label>
                        <Form.Control
                            disabled={isSending}
                            placeholder="Jan Kowalski"
                            value={form.name}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group as={Col} controlId="email">
                        <Form.Label>Adres e-mail (opcjonalnie)</Form.Label>
                        <Form.Control
                            disabled={isSending}
                            placeholder="jan.kowalski@solvro.pl"
                            value={form.email}
                            onChange={handleChange}
                        />
                    </Form.Group>
                </Row>
                <Form.Group className="mb-3" controlId="title">
                    <Form.Label>Tytuł</Form.Label>
                    <Form.Control
                        disabled={isSending}
                        placeholder="Tytuł zgłoszenia"
                        value={form.title}
                        onChange={handleChange}
                    />
                </Form.Group>
                <Form.Group className="mb-3" controlId="content">
                    <Form.Label>Treść</Form.Label>
                    <Form.Control
                        disabled={isSending}
                        placeholder="Treść zgłoszenia"
                        as="textarea"
                        value={form.content}
                        onChange={handleChange}
                    />
                </Form.Group>
                <Row className="mb-3">
                    <Form.Group as={Col} controlId="sendDiagnostics">
                        <Form.Check
                            type="checkbox"
                            label="Wyślij dane diagnostyczne"
                            checked={form.sendDiagnostics}
                            onChange={handleChange}
                        />
                    </Form.Group>
                    <Form.Group as={Col} controlId="reportType">
                        <Form.Label>Typ zgłoszenia</Form.Label>
                        <Form.Select
                            value={form.reportType}
                            onChange={handleChange}>
                            <option value="bug">Błąd</option>
                            <option value="enhancement">Propozycja</option>
                            <option value="question">Pytanie</option>
                        </Form.Select>
                    </Form.Group>
                </Row>
            </Modal.Body>
            <Modal.Footer>
                <Button
                    variant={`outline-${appContext.theme.getOppositeTheme()}`}
                    onClick={onHide}>
                    Anuluj
                </Button>
                <Button
                    disabled={isSending}
                    variant="primary"
                    onClick={handleSend}>
                    Wyślij formularz
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default ReportBugModal;
