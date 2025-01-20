import {Card} from 'react-bootstrap';
import {Link} from "react-router-dom";

const TermsPage = () => {
    return (
        <Card className="border-0 shadow">
            <Card.Body>
                <h1 className="text-center mb-4">Regulamin serwisu Testownik</h1>

                <h2>1. Postanowienia ogólne</h2>
                <p>1. Niniejszy regulamin określa zasady korzystania z serwisu Testownik (dalej „Serwis”),
                    dostępnego pod adresem <a href="http://testownik.live">testownik.live</a>.</p>
                <p>2. Korzystanie z Serwisu oznacza akceptację wszystkich postanowień niniejszego regulaminu.</p>
                <p>3. Serwis przeznaczony jest wyłącznie dla studentów Politechniki Wrocławskiej, którzy logują się
                    za pomocą konta USOS.</p>

                <h2>2. Zakres usług</h2>
                <p>1. Serwis umożliwia użytkownikom tworzenie, udostępnianie i rozwiązywanie testów w ramach
                    platformy edukacyjnej.</p>
                <p>2. Serwis nie ponosi odpowiedzialności za treści umieszczane przez użytkowników. Każdy użytkownik
                    ponosi pełną odpowiedzialność za treści, które zamieszcza w Serwisie.</p>

                <h2>3. Treści umieszczane przez użytkowników</h2>
                <p>1. Użytkownik oświadcza, że wszelkie treści wprowadzane do Serwisu (testy, pytania, odpowiedzi,
                    materiały multimedialne) nie naruszają obowiązujących przepisów prawa, w tym praw autorskich
                    osób trzecich.</p>
                <p>2. Administrator Serwisu zastrzega sobie prawo do usunięcia lub modyfikacji treści, które są
                    sprzeczne z regulaminem, prawem lub zgłoszono ich naruszenie.</p>
                <p>3. Serwis pełni jedynie rolę platformy udostępniającej narzędzia i nie weryfikuje merytorycznej
                    poprawności zamieszczanych treści.</p>

                <h2>4. Zgłaszanie naruszeń</h2>
                <p>1. W przypadku zauważenia treści, które mogą naruszać prawo, prawa autorskie, dobra osobiste lub
                    inne regulacje, użytkownicy mają możliwość zgłoszenia naruszenia.</p>
                <p>2. Zgłoszenia naruszeń można przesyłać na adres e-mail: <a
                    href="mailto:takedown@testownik.live">takedown@testownik.live</a>.</p>
                <p>3. Każde zgłoszenie powinno zawierać szczegółowy opis naruszenia oraz link do materiału, którego
                    dotyczy zgłoszenie.</p>
                <p>4. Zgłoszenia będą rozpatrywane w ciągu 14 dni roboczych, a w przypadku zasadności zgłoszenia
                    treści zostaną usunięte lub zablokowane.</p>

                <h2>5. Wyłączenie odpowiedzialności</h2>
                <p>1. Administrator Serwisu nie ponosi odpowiedzialności za:</p>
                <ul>
                    <li>treści zamieszczane przez użytkowników,</li>
                    <li>szkody wynikające z nieautoryzowanego dostępu do danych użytkownika,</li>
                    <li>czasowe przerwy w działaniu Serwisu spowodowane awariami technicznymi lub koniecznością
                        przeprowadzenia prac serwisowych.
                    </li>
                </ul>
                <p>2. Serwis może zostać czasowo zawieszony lub całkowicie wyłączony bez wcześniejszego
                    powiadomienia.</p>

                <h2>6. Polityka prywatności</h2>
                <p>1. Informacje o tym, w jaki sposób Serwis przetwarza dane użytkowników, dostępne są w zakładce <Link
                    to={"/privacy-policy"}>Polityka prywatności</Link>.</p>

                <h2>7. Postanowienia końcowe</h2>
                <p>1. Administrator Serwisu zastrzega sobie prawo do zmiany regulaminu. Wszelkie zmiany wchodzą w
                    życie z dniem ich opublikowania w Serwisie.</p>
                <p>2. Wszelkie pytania, uwagi lub problemy dotyczące korzystania z Serwisu można zgłaszać na adres
                    e-mail: <a href="mailto:kontakt@testownik.live">kontakt@testownik.live</a>.</p>
                <p>3. Korzystanie z Serwisu po wprowadzeniu zmian w regulaminie jest równoznaczne z akceptacją nowej
                    treści regulaminu.</p>

                <p className="text-center mt-4">Dziękujemy za korzystanie z Testownika i życzymy udanej nauki!</p>
            </Card.Body>
        </Card>
    );
};

export default TermsPage;
