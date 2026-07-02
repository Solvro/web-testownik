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
            Treści tworzone i udostępniane w Serwisie, w tym quizy, pytania,
            odpowiedzi, wyjaśnienia oraz obrazy dodane do pytań lub odpowiedzi;
          </li>
          <li>
            Treści przekazywane do funkcji sztucznej inteligencji, w tym
            wiadomości czatu AI, prompty, wybrane fragmenty quizów, pytania,
            odpowiedzi, obrazy z pytań oraz odpowiedzi wygenerowane przez AI;
          </li>
          <li>
            Dane związane z integracjami zewnętrznymi i MCP, w tym informacje o
            połączonych aplikacjach, zakresie udzielonych uprawnień, tokenach
            autoryzacyjnych oraz żądaniach wykonywanych przez klienta MCP w
            imieniu Użytkownika;
          </li>
          <li>
            Informacje o korzystaniu z funkcji AI, w tym liczba i czas zapytań
            wykorzystywane do limitowania nadużyć i zapewnienia dostępności
            usługi;
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
            <strong>Funkcje sztucznej inteligencji:</strong> w celu
            udostępniania czatu AI, podpowiedzi, wyjaśnień pytań, generowania
            pytań treningowych oraz proponowania edycji quizów. W tym celu do
            modelu AI mogą być przekazywane treści niezbędne do udzielenia
            odpowiedzi, np. wiadomość Użytkownika, kontekst quizu, treść
            pytania, odpowiedzi, wyjaśnienia i powiązane obrazy (podstawa
            prawna: <strong>art. 6 ust. 1 lit. b RODO</strong> – świadczenie
            funkcji dostępnych w Serwisie oraz{" "}
            <strong>art. 6 ust. 1 lit. f RODO</strong> – prawnie uzasadniony
            interes Administratora polegający na rozwoju i zabezpieczeniu
            Serwisu);
          </li>
          <li>
            <strong>Integracje MCP i OAuth:</strong> w celu umożliwienia
            Użytkownikowi połączenia Serwisu z zewnętrznym klientem MCP lub inną
            aplikacją, autoryzowania dostępu do wybranych danych i wykonywania
            działań w Serwisie zgodnie z zakresem udzielonych uprawnień
            (podstawa prawna: <strong>art. 6 ust. 1 lit. b RODO</strong> –
            świadczenie funkcji integracji oraz{" "}
            <strong>art. 6 ust. 1 lit. f RODO</strong> – bezpieczeństwo i
            rozliczalność dostępu);
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
        <p>
          4. Dane przetwarzane w ramach funkcji AI są przechowywane przez okres
          niezbędny do świadczenia tych funkcji, obsługi historii rozmowy w
          interfejsie, limitowania zapytań, bezpieczeństwa i rozpatrywania
          zgłoszeń. Dostawcy modeli AI mogą przechowywać dane przekazane przez
          API zgodnie z własnymi zasadami retencji, zależnymi m.in. od dostawcy,
          rodzaju usługi, planu, regionu, ustawień konta, wymogów bezpieczeństwa
          i obowiązków prawnych.
        </p>
        <p>
          5. Dane związane z autoryzacją integracji MCP i OAuth przetwarzane są
          przez czas utrzymywania połączenia z daną aplikacją oraz przez okres
          niezbędny do zapewnienia bezpieczeństwa, audytu i rozpatrywania
          zgłoszeń. Użytkownik może odłączyć połączone aplikacje w ustawieniach
          profilu.
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
        <p>
          3. W celu obsługi funkcji sztucznej inteligencji Serwis korzysta z
          zewnętrznych dostawców modeli AI. W zależności od konfiguracji Serwisu
          dostawcą może być w szczególności OpenAI, Google, Anthropic lub inny
          dostawca modeli językowych. Do dostawcy przekazywane są wyłącznie dane
          potrzebne do wykonania wybranej funkcji AI.
        </p>
        <p>
          4. Zasady wykorzystywania danych do trenowania modeli, okresy retencji
          oraz możliwość wglądu człowieka w dane zależą od konkretnego dostawcy,
          planu i ustawień usługi. Informacje o zasadach dostawców znajdują się
          m.in. w dokumentacji{" "}
          <a
            href="https://openai.com/enterprise-privacy/"
            rel="noreferrer"
            target="_blank"
          >
            OpenAI
          </a>
          ,{" "}
          <a
            href="https://ai.google.dev/gemini-api/terms"
            rel="noreferrer"
            target="_blank"
          >
            Google Gemini API
          </a>{" "}
          oraz{" "}
          <a
            href="https://privacy.claude.com/en/collections/10663361-commercial-customers"
            rel="noreferrer"
            target="_blank"
          >
            Anthropic
          </a>
          .
        </p>
        <p>
          5. Serwis może udostępniać dane zewnętrznym aplikacjom połączonym
          przez Użytkownika za pomocą OAuth lub MCP, wyłącznie w zakresie
          uprawnień zaakceptowanych przez Użytkownika. Dotyczy to np. klientów
          MCP takich jak Claude Code, Claude Desktop, VS Code lub innych
          kompatybilnych narzędzi. Po przekazaniu danych do takiego klienta ich
          dalsze przetwarzanie może podlegać zasadom prywatności i ustawieniom
          tego klienta oraz powiązanego dostawcy AI.
        </p>
        <p>
          6. Korzystanie z dostawców zewnętrznych, w tym dostawców modeli AI i
          klientów MCP, może wiązać się z przekazywaniem danych poza Europejski
          Obszar Gospodarczy. W takim przypadku Administrator stosuje
          zabezpieczenia wymagane przez przepisy o ochronie danych osobowych.
        </p>

        <h2 id="funkcje-ai">
          VI. Kontrola nad funkcjami AI i integracjami MCP
        </h2>
        <p>
          1. Korzystanie z funkcji AI jest dobrowolne. Użytkownik może wyłączyć
          funkcje AI w ustawieniach profilu lub przez potwierdzenie propozycji
          wyłączenia wyświetlonej przez asystenta AI.
        </p>
        <p>
          2. Funkcje AI nie są wykorzystywane do zautomatyzowanego podejmowania
          decyzji wywołujących wobec Użytkownika skutki prawne lub podobnie
          istotnie na niego wpływających w rozumieniu RODO.
        </p>
        <p>
          3. Korzystanie z MCP jest dobrowolne i wymaga autoryzacji przez
          Użytkownika. Klient MCP może uzyskać dostęp do danych wskazanych w
          ekranie autoryzacji, np. profilu, quizów lub sesji nauki, oraz
          wykonywać działania zgodnie z zaakceptowanymi uprawnieniami.
        </p>
        <p>
          4. Połączone aplikacje MCP i OAuth można odłączyć w zakładce
          integracji w profilu. Odłączenie aplikacji cofa jej dalszy dostęp do
          danych Użytkownika w Serwisie.
        </p>

        <h2 id="pliki-cookies">VII. Pliki Cookies i Logi Serwera</h2>
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

        <h2 id="prawa-uzytkownikow">VIII. Prawa Użytkownika</h2>
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

        <h2 id="kontakt">IX. Kontakt</h2>
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

        <h2 id="zmiany">X. Zmiany Polityki Prywatności</h2>
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
