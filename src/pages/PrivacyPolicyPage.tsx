import {Card} from 'react-bootstrap';

const PrivacyPolicyPage = () => {

    document.title = "Polityka Prywatności - Testownik Solvro";

    return (
        <Card className="border-0 shadow">
            <Card.Body>
                <h1 className="text-center mb-4">Polityka Prywatności</h1>

                <h2>1. Postanowienia ogólne</h2>
                <p>1. Niniejsza Polityka Prywatności określa zasady przetwarzania danych osobowych przez serwis
                    Testownik (dalej "Serwis"), dostępny pod adresem <a
                        href="https://testownik.solvro.pl">testownik.solvro.pl</a>.
                </p>
                <p>2. Administratorem danych osobowych jest właściciel Serwisu (dalej "Administrator").</p>
                <p>3. Serwis przetwarza dane osobowe zgodnie z obowiązującymi przepisami prawa, w szczególności z
                    Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).</p>

                <h2>2. Jakie dane przetwarzamy?</h2>
                <p>1. Dane zbierane od użytkowników:</p>
                <ul>
                    <li>Imię i nazwisko</li>
                    <li>Adres e-mail</li>
                    <li>Płeć</li>
                    <li>Informacje o twoich studiach (np. numer indeksu, kierunek)</li>
                    <li>Informacje związane z logowaniem do konta USOS</li>
                    <li>Adres IP oraz dane techniczne dotyczące urządzenia użytkownika (np. przeglądarka, system
                        operacyjny)
                    </li>
                </ul>
                <p>2. Dane przetwarzane są wyłącznie w zakresie niezbędnym do świadczenia usług Serwisu.</p>

                <h2>3. Cel przetwarzania danych</h2>
                <p>Dane osobowe przetwarzane są w celu:</p>
                <ul>
                    <li>Świadczenia usług dostępnych w Serwisie;</li>
                    <li>Umożliwienia logowania i korzystania z kont użytkowników;</li>
                    <li>Utrzymania bezpieczeństwa Serwisu i zapobiegania nadużyciom;</li>
                    <li>Kontaktowania się z użytkownikami w sprawach związanych z funkcjonowaniem Serwisu;</li>
                    <li>Spełnienia obowiązków prawnych Administratora.</li>
                </ul>

                <h2>4. Udostępnianie danych</h2>
                <p>1. Dane osobowe użytkowników nie są udostępniane osobom trzecim, z wyjątkiem sytuacji, gdy:</p>
                <ul>
                    <li>Administrator jest zobowiązany do ich przekazania na mocy przepisów prawa;</li>
                    <li>Jest to konieczne do świadczenia usług (np. dostawcy usług hostingowych).</li>
                </ul>
                <p>2. W takich przypadkach dane są przetwarzane wyłącznie w zakresie niezbędnym do realizacji
                    określonych celów.</p>

                <h2>5. Czas przechowywania danych</h2>
                <p>1. Dane osobowe są przechowywane przez okres niezbędny do świadczenia usług lub zgodnie z
                    obowiązującymi przepisami prawa.</p>
                <p>2. Po zakończeniu korzystania z usług Serwisu dane mogą być przechowywane przez okres wymagany dla
                    celów podatkowych, księgowych lub prawnych.</p>

                <h2>6. Prawa użytkowników</h2>
                <p>Użytkownicy mają prawo do:</p>
                <ul>
                    <li>Dostępu do swoich danych osobowych;</li>
                    <li>Sprostowania lub usunięcia danych;</li>
                    <li>Ograniczenia przetwarzania;</li>
                    <li>Wniesienia sprzeciwu wobec przetwarzania danych;</li>
                    <li>Przenoszenia danych;</li>
                    <li>Złożenia skargi do organu nadzorczego (np. Prezesa Urzędu Ochrony Danych Osobowych).</li>
                </ul>

                <h2>7. Zabezpieczenia danych</h2>
                <p>1. Administrator wdraża odpowiednie środki techniczne i organizacyjne w celu ochrony danych osobowych
                    przed nieuprawnionym dostępem, utratą lub zniszczeniem.</p>
                <p>2. Dostęp do danych osobowych mają wyłącznie upoważnione osoby, które zobowiązane są do zachowania
                    poufności.</p>

                <h2>8. Wykorzystywanie Analytics</h2>
                <p>1. Serwis korzysta z Umami Analytics w celu analizy ruchu na stronie oraz poprawy jakości
                    świadczonych usług.</p>
                <p>2. Analytics może zbierać informacje, takie jak adres IP użytkownika, rodzaj przeglądarki,
                    system operacyjny i inne dane dotyczące interakcji z Serwisem.</p>

                <h2>9. Kontakt</h2>
                <p>Wszelkie pytania, uwagi lub żądania dotyczące przetwarzania danych osobowych można kierować na adres
                    e-mail: <a href="mailto:testownik@solvro.pl">testownik@solvro.pl</a>.</p>

                <h2>10. Zmiany w Polityce Prywatności</h2>
                <p>1. Administrator zastrzega sobie prawo do zmiany Polityki Prywatności. Wszelkie zmiany będą
                    publikowane na stronie Serwisu.</p>
                <p>2. Korzystanie z Serwisu po wprowadzeniu zmian jest równoznaczne z akceptacją nowej treści Polityki
                    Prywatności.</p>

                <p className="text-center mt-4">Dziękujemy za korzystanie z Testownika i zaufanie nam w zakresie
                    przetwarzania danych!</p>
            </Card.Body>
        </Card>
    );
};

export default PrivacyPolicyPage;