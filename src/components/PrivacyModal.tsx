import React from 'react';
import {Modal, Button} from 'react-bootstrap';

interface PrivacyModalProps {
    show: boolean;
    onHide: () => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({show, onHide}) => {
    return (
        <Modal id="privacyModal" tabIndex={-1} aria-labelledby="privacyModalLabel" aria-hidden="true" show={show}
               onHide={onHide}>
            <Modal.Header closeButton>
                <Modal.Title id="privacyModalLabel">Jak wykorzystujemy Twoje dane</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p>Testownik korzysta z Twoich danych z USOS, aby móc zidentyfikować Cię jako studenta PWr i zapewnić Ci
                    dostęp do odpowiednich funkcji.</p>
                <p>Lista danych, które otrzymujemy od USOS oraz w jaki sposób je przetwarzamy:</p>
                <ul>
                    <li><code>default</code> - Twoje podstawowe dane, takie jak imię, nazwisko oraz status studenta.
                    </li>
                    <li><code>offline_access</code> - Uprawnienie pozwalające na odświeżanie Twoich danych bez
                        konieczności logowania się do USOS za każdym razem.
                    </li>
                    <li><code>studies</code> - Informacje o Twoich studiach, takie jak numer indeksu, kierunek studiów
                        oraz twoje grupy zajęciowe. Użyjemy to żeby ułatwić ci udostępnianie quizów dla twoich grup.
                    </li>
                    <li><code>email</code> - Twój adres email (najczęściej [nr_indeksu]@student.pwr.edu.pl), który jest
                        używany do kontaktu przy zgłaszaniu błędów w quizach.
                    </li>
                    <li><code>photo</code> - Twoje zdjęcie profilowe, które jest wyświetlane w górnym prawym rogu strony
                        oraz przy wyszukiwaniu osób.
                    </li>
                    <li><code>grades</code> - Twoje oceny końcowe z USOS, które są wyświetlane w zakładce "Oceny" wraz z
                        wyliczoną średnią. Nie są one zapisywane w bazie danych Testownika, a jedynie pobierane z USOS w
                        momencie wyświetlania strony. Są one dostępne tylko dla Ciebie.
                    </li>
                </ul>
                <p>Kod źródłowy Testownika jest dostępny na <a
                    href="https://github.com/solvro/web-testownik">GitHubie</a>, gdzie sam możesz zweryfikować, jakie
                    dane są przetwarzane oraz jak są one wykorzystywane.</p>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Zamknij</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default PrivacyModal;