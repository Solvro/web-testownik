import type { Metadata } from "next";

import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Polityka Prywatności",
};

export default function PrivacyPolicyPage() {
  return (
    <Card>
      <CardContent className="prose prose-sm lg:prose-base dark:prose-invert max-w-none">
        <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">
          Polityka Prywatności
        </h1>

        <p className="text-muted-foreground mb-8 text-sm italic">
          Polityka prywatności określa zasady przetwarzania i ochrony danych
          osobowych przekazywanych przez Użytkowników w związku z korzystaniem z
          serwisu Testownik.
        </p>

        <h2 id="postanowienia-ogolne">I. Postanowienia ogólne</h2>
        <p>
          1. Niniejsza Polityka ochrony prywatności określa sposób zbierania,
          przetwarzania i przechowywania danych osobowych koniecznych do
          świadczenia usług drogą elektroniczną za pośrednictwem serwisu
          internetowego dostępnego pod adresem{" "}
          <a href="https://testownik.solvro.pl">testownik.solvro.pl</a> (dalej:
          &quot;Serwis&quot;).
        </p>
        <p>
          2. Administratorem danych osobowych Użytkowników jest{" "}
          <strong>Antoni Czaplicki</strong> (dalej: &quot;Administrator&quot;).
        </p>
        <p>
          3. Dane osobowe przetwarzane są zgodnie z Rozporządzeniem Parlamentu
          Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. w
          sprawie ochrony osób fizycznych w związku z przetwarzaniem danych
          osobowych i w sprawie swobodnego przepływu takich danych oraz
          uchylenia dyrektywy 95/46/WE (ogólne rozporządzenie o ochronie danych)
          (dalej: &quot;RODO&quot;).
        </p>

        <h2 id="rodzaj-danych">II. Rodzaj i źródło przetwarzanych danych</h2>
        <p>
          1. Administrator przetwarza dane przekazane bezpośrednio przez
          Użytkownika oraz dane uzyskane automatycznie podczas korzystania z
          Serwisu.
        </p>
        <p>2. Zakres przetwarzanych danych obejmuje:</p>
        <ul>
          <li>Imię i nazwisko;</li>
          <li>Adres e-mail;</li>
          <li>Płeć;</li>
          <li>
            Informacje o toku studiów (np. numer indeksu, kierunek) – pobierane
            za pośrednictwem integracji z systemem USOS;
          </li>
          <li>
            Informacje o postępach w nauce (wyniki quizów, statystyki
            rozwiązań);
          </li>
          <li>
            Adres IP oraz dane techniczne urządzenia (typ przeglądarki, system
            operacyjny, logi serwera).
          </li>
        </ul>

        <h2 id="cel-i-podstawy">
          III. Cel i podstawy prawne przetwarzania danych
        </h2>
        <p>Administrator przetwarza dane osobowe w następujących celach:</p>
        <ul>
          <li>
            <strong>Świadczenie usług i obsługa konta:</strong> w celu
            weryfikacji tożsamości (logowanie USOS), umożliwienia tworzenia i
            rozwiązywania quizów oraz zapisywania wyników (podstawa prawna:{" "}
            <strong>art. 6 ust. 1 lit. b RODO</strong> – niezbędność do
            wykonania umowy);
          </li>
          <li>
            <strong>Newsletter i informacje:</strong> w celu wysyłania
            informacji o nowościach w Serwisie, aktualizacjach oraz treści
            edukacyjnych, o ile Użytkownik wyraził na to zgodę (podstawa prawna:{" "}
            <strong>art. 6 ust. 1 lit. a RODO</strong> – zgoda Użytkownika);
          </li>
          <li>
            <strong>Kontakt i wsparcie:</strong> w celu udzielania odpowiedzi na
            zgłoszenia i komunikacji z Użytkownikiem (podstawa prawna:{" "}
            <strong>art. 6 ust. 1 lit. f RODO</strong> – prawnie uzasadniony
            interes Administratora);
          </li>
          <li>
            <strong>Analityka i statystyka:</strong> w celu analizy ruchu na
            stronie (Umami Analytics) i ulepszania funkcjonalności Serwisu
            (podstawa prawna: <strong>art. 6 ust. 1 lit. f RODO</strong>);
          </li>
          <li>
            <strong>Bezpieczeństwo:</strong> w celu zapewnienia bezpieczeństwa
            sesji, wykrywania nadużyć oraz tworzenia kopii zapasowych (podstawa
            prawna: <strong>art. 6 ust. 1 lit. f RODO</strong>).
          </li>
        </ul>

        <h2 id="okres-przechowywania">IV. Okres przetwarzania danych</h2>
        <p>
          1. Dane związane z prowadzeniem konta przetwarzane są przez czas jego
          posiadania przez Użytkownika.
        </p>
        <p>
          2. Dane przetwarzane na potrzeby newslettera przechowywane są do
          momentu wycofania zgody przez Użytkownika.
        </p>
        <p>
          3. Logi systemowe oraz dane analityczne przechowywane są przez okres
          ograniczony, niezbędny do celów technicznych i statystycznych.
        </p>

        <h2 id="odbiorcy-danych">V. Odbiorcy danych</h2>
        <p>
          1. Dane mogą być udostępniane podmiotom wspierającym działanie Serwisu
          (dostawcy hostingu, usługi analityczne typu Umami, dostawcy systemów
          mailingowych).
        </p>
        <p>
          2. Serwis korzysta z zewnętrznego uwierzytelniania (USOS/Solvro Auth),
          co wiąże się z wymianą niezbędnych tokenów autoryzacyjnych.
        </p>

        <h2 id="pliki-cookies">VI. Pliki Cookies i Logi Serwera</h2>
        <p>1. Serwis wykorzystuje pliki cookies (ciasteczka) w celu:</p>
        <ul>
          <li>Utrzymania sesji użytkownika po zalogowaniu;</li>
          <li>Zapamiętania preferencji (np. motyw jasny/ciemny);</li>
          <li>Zbierania anonimowych statystyk (Umami Analytics).</li>
        </ul>
        <p>
          2. Użytkownik może w każdej chwili zmienić ustawienia dotyczące plików
          cookies w swojej przeglądarce internetowej.
        </p>

        <h2 id="prawa-uzytkownikow">VII. Prawa Użytkownika</h2>
        <p>Użytkownikowi przysługuje prawo do:</p>
        <ul>
          <li>Dostępu do swoich danych oraz otrzymania ich kopii;</li>
          <li>Sprostowania (poprawiania) danych;</li>
          <li>Usunięcia danych;</li>
          <li>Ograniczenia przetwarzania;</li>
          <li>Wniesienia sprzeciwu wobec przetwarzania;</li>
          <li>Przenoszenia danych;</li>
          <li>
            Cofnięcia zgody na newsletter w dowolnym momencie (bez wpływu na
            zgodność z prawem przetwarzania przed jej cofnięciem);
          </li>
          <li>Wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.</li>
        </ul>

        <h2 id="kontakt">VIII. Kontakt</h2>
        <p>
          Wszelkie pytania oraz żądania dotyczące danych osobowych można
          kierować na adres e-mail:{" "}
          <a
            href="mailto:testownik@solvro.pl"
            className="text-primary font-medium hover:underline"
          >
            testownik@solvro.pl
          </a>
          .
        </p>

        <h2 id="zmiany">IX. Zmiany Polityki Prywatności</h2>
        <p>
          1. Administrator zastrzega sobie prawo do zmiany Polityki Prywatności.
          Wszelkie zmiany będą publikowane na stronie Serwisu.
        </p>
        <p>
          2. Korzystanie z Serwisu po wprowadzeniu zmian jest równoznaczne z
          akceptacją nowej treści Polityki Prywatności.
        </p>
      </CardContent>
    </Card>
  );
}
