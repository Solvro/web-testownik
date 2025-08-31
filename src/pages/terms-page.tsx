import { Link } from "react-router";

import { Card, CardContent } from "@/components/ui/card";

function TermsPage() {
  document.title = "Regulamin - Testownik Solvro";

  return (
    <Card className="shadow-sm">
      <CardContent className="prose prose-sm lg:prose-base dark:prose-invert max-w-none [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:border-b [&_h2]:pb-1 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-6">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">
          Regulamin serwisu Testownik
        </h1>

        <h2 id="postanowienia">1. Postanowienia ogólne</h2>
        <p>
          1. Niniejszy regulamin określa zasady korzystania z serwisu Testownik
          (dalej „Serwis”), dostępnego pod adresem{" "}
          <a href="https://testownik.solvro.pl">testownik.solvro.pl</a>.
        </p>
        <p>
          2. Korzystanie z Serwisu oznacza akceptację wszystkich postanowień
          niniejszego regulaminu.
        </p>
        <p>
          3. Serwis przeznaczony jest wyłącznie dla studentów Politechniki
          Wrocławskiej, którzy logują się za pomocą konta USOS.
        </p>

        <h2 id="zakres-uslug">2. Zakres usług</h2>
        <p>
          1. Serwis umożliwia użytkownikom tworzenie, udostępnianie i
          rozwiązywanie testów w ramach platformy edukacyjnej.
        </p>
        <p>
          2. Serwis nie ponosi odpowiedzialności za treści umieszczane przez
          użytkowników. Każdy użytkownik ponosi pełną odpowiedzialność za
          treści, które zamieszcza w Serwisie.
        </p>

        <h2 id="tresci">3. Treści umieszczane przez użytkowników</h2>
        <p>
          1. Użytkownik oświadcza, że wszelkie treści wprowadzane do Serwisu
          (testy, pytania, odpowiedzi, materiały multimedialne) nie naruszają
          obowiązujących przepisów prawa, w tym praw autorskich osób trzecich.
        </p>
        <p>
          2. Administrator Serwisu zastrzega sobie prawo do usunięcia lub
          modyfikacji treści, które są sprzeczne z regulaminem, prawem lub
          zgłoszono ich naruszenie.
        </p>
        <p>
          3. Serwis pełni jedynie rolę platformy udostępniającej narzędzia i nie
          weryfikuje merytorycznej poprawności zamieszczanych treści.
        </p>

        <h2 id="zglaszanie">4. Zgłaszanie naruszeń</h2>
        <p>
          1. W przypadku zauważenia treści, które mogą naruszać prawo, prawa
          autorskie, dobra osobiste lub inne regulacje, użytkownicy mają
          możliwość zgłoszenia naruszenia.
        </p>
        <p>
          2. Zgłoszenia naruszeń można przesyłać na adres e-mail:{" "}
          <a href="mailto:testownik@solvro.pl">testownik@solvro.pl</a>.
        </p>
        <p>
          3. Każde zgłoszenie powinno zawierać szczegółowy opis naruszenia oraz
          link do materiału, którego dotyczy zgłoszenie.
        </p>
        <p>
          4. Zgłoszenia będą rozpatrywane w ciągu 14 dni roboczych, a w
          przypadku zasadności zgłoszenia treści zostaną usunięte lub
          zablokowane.
        </p>

        <h2 id="odpowiedzialnosc">5. Wyłączenie odpowiedzialności</h2>
        <p>1. Administrator Serwisu nie ponosi odpowiedzialności za:</p>
        <ul>
          <li>treści zamieszczane przez użytkowników,</li>
          <li>
            szkody wynikające z nieautoryzowanego dostępu do danych użytkownika,
          </li>
          <li>
            czasowe przerwy w działaniu Serwisu spowodowane awariami
            technicznymi lub koniecznością przeprowadzenia prac serwisowych.
          </li>
        </ul>
        <p>
          2. Serwis może zostać czasowo zawieszony lub całkowicie wyłączony bez
          wcześniejszego powiadomienia.
        </p>

        <h2 id="polityka-prywatnosci">6. Polityka prywatności</h2>
        <p>
          1. Informacje o tym, w jaki sposób Serwis przetwarza dane
          użytkowników, dostępne są w zakładce{" "}
          <Link to={"/privacy-policy"}>Polityka prywatności</Link>.
        </p>

        <h2 id="postanowienia-koncowe">7. Postanowienia końcowe</h2>
        <p>
          1. Administrator Serwisu zastrzega sobie prawo do zmiany regulaminu.
          Wszelkie zmiany wchodzą w życie z dniem ich opublikowania w Serwisie.
        </p>
        <p>
          2. Wszelkie pytania, uwagi lub problemy dotyczące korzystania z
          Serwisu można zgłaszać na adres e-mail:{" "}
          <a href="mailto:testownik@solvro.pl">testownik@solvro.pl</a>.
        </p>
        <p>
          3. Korzystanie z Serwisu po wprowadzeniu zmian w regulaminie jest
          równoznaczne z akceptacją nowej treści regulaminu.
        </p>
      </CardContent>
    </Card>
  );
}

export { TermsPage };
