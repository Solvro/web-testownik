import React, {useContext, useState} from 'react';
import {Card, Button, Modal, Alert} from 'react-bootstrap';
import {Link, useLocation} from 'react-router';
import GridLoader from "react-spinners/GridLoader";
import '../styles/LoginPrompt.css';
import AppContext from "../AppContext.tsx";
import {SERVER_URL} from "../config.ts";
import PrivacyModal from "./PrivacyModal.tsx";

const LoginPrompt: React.FC = () => {
    const appContext = useContext(AppContext);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showGuestModal, setShowGuestModal] = useState(false);
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const accessToken = queryParams.get('access_token');
    const refreshToken = queryParams.get('refresh_token');
    const error = queryParams.get('error');

    const signInAsGuest = () => {
        appContext.setGuest(true);
        setShowGuestModal(false);
    }

    return (
        <div className="d-flex justify-content-center">
            <Card className="border-0 shadow" id="login-card">
                {accessToken && refreshToken ? (
                    <Card.Body className="d-flex flex-column align-items-center">
                        <Card.Text className="text-success fs-4">
                            Zalogowano pomyślnie!
                        </Card.Text>
                        <GridLoader color={appContext.theme.getOppositeThemeColor()} loading={true} size={15}/>
                        <Card.Text className="text-muted mt-2">
                            Pobieranie twoich danych...
                        </Card.Text>
                    </Card.Body>
                ) : (
                    <Card.Body>
                        <Card.Title>Witaj w Testowniku Solvro!</Card.Title>
                        {error && (
                            <Alert variant="danger">
                                <p>Wystąpił błąd podczas logowania.</p>
                                {error === "not_student" ? (
                                    <span>Niestety, nie udało nam się zidentyfikować Cię jako studenta PWr. Upewnij
                                        się, że logujesz się na swoje konto studenta. Jeśli problem będzie się
                                        powtarzał, <a
                                            href="mailto:testownik@solvro.pl">skontaktuj się z nami</a>.</span>
                                ) : (
                                    <span>{error}</span>
                                )}
                            </Alert>
                        )}
                        <Card.Text>
                            Testownik by <a href="https://github.com/Antoni-Czaplicki">Antoni Czaplicki</a>, stworzony
                            wraz ze wsparciem <a href="https://www.facebook.com/KNKredek/">KN Kredek</a>.
                        </Card.Text>
                        <Card.Text>
                            Powered by <a href="https://solvro.pwr.edu.pl/"><img src="/solvro_mono.svg"
                                                                                 alt="solvro logo" width={24}
                                                                                 className="solvro-logo"/> KN Solvro</a>
                        </Card.Text>
                        <Card.Text>
                            <b>Klikając przyciski poniżej, potwierdzasz, że zapoznałeś się z naszym <Link
                                to={"/terms"}>regulaminem</Link> oraz że go akceptujesz.</b>
                        </Card.Text>
                        <div className="d-grid gap-2">
                            <Button href={`${SERVER_URL}/login/usos?jwt=true&redirect=${document.location}`}
                                    variant="primary" className="w-100">Zaloguj się</Button>
                            <Button onClick={() => setShowGuestModal(true)}
                                    variant="outline-primary" className="w-100">Kontynuuj jako gość</Button>
                        </div>
                        <div className="text-center mt-2">
                            <a href="#" className="fs-6 link-secondary" onClick={() => setShowPrivacyModal(true)}>
                                Jak wykorzystujemy Twoje dane?
                            </a>
                        </div>
                    </Card.Body>
                )}
            </Card>
            <PrivacyModal show={showPrivacyModal} onHide={() => setShowPrivacyModal(false)}/>
            <Modal id="guestModal" tabIndex={-1} aria-labelledby="guestModalLabel" aria-hidden="true"
                   show={showGuestModal} onHide={() => setShowGuestModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title id="guestModalLabel">Kontynuuj jako gość</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <p>Jeśli nie chcesz logować się za pomocą USOS, możesz kontynuować jako gość. W takim przypadku
                        będziesz mógł korzystać z podstawowych funkcji Testownika. Wszystkie quizy oraz wyniki będą
                        zapisywane lokalnie na Twoim urządzeniu (w <code>localStorage</code>).</p>
                    <p>Jeśli zdecydujesz się na zalogowanie za pomocą USOS w przyszłości, będziesz mógł przenieść
                        swoje quizy oraz wyniki do swojego konta i w pełni korzystać z funkcji Testownika - m.in.
                        synchronizacji, udostępniania quizów oraz przeglądania swoich ocen.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant={`outline-${appContext.theme.getOppositeTheme()}`} onClick={() => setShowGuestModal(false)}>Anuluj</Button>
                    <Button onClick={signInAsGuest}
                            variant="primary">Kontynuuj jako gość</Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default LoginPrompt;