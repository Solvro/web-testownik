import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function TypographyInlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="bg-muted relative rounded px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold">
      {children}
    </code>
  );
}

interface PrivacyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrivacyDialog({ open, onOpenChange }: PrivacyDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="grid h-fit max-h-[90vh] grid-rows-[auto_1fr_auto] overflow-hidden md:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Jak wykorzystujemy Twoje dane</DialogTitle>
          <DialogDescription>
            Informacje o przetwarzaniu danych osobowych przez Testownik
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto">
          <p>
            Testownik korzysta z Twoich danych - w tym tych uzyskiwanych z USOS,
            aby móc zidentyfikować Cię jako studenta PWr i zapewnić Ci dostęp do
            odpowiednich funkcji, szczegółowe informacje znajdziesz w{" "}
            <Link
              href="/privacy-policy"
              className="underline underline-offset-2"
            >
              Polityce Prywatności
            </Link>
            .
          </p>
          <p>
            Lista danych, które otrzymujemy od USOS oraz w jaki sposób je
            przetwarzamy:
          </p>
          <ul>
            <li>
              <TypographyInlineCode>default</TypographyInlineCode> - Twoje
              podstawowe dane, takie jak imię, nazwisko oraz status studenta.
            </li>
            <li>
              <TypographyInlineCode>offline_access</TypographyInlineCode> -
              Uprawnienie pozwalające na odświeżanie Twoich danych bez
              konieczności logowania się do USOS za każdym razem.
            </li>
            <li>
              <TypographyInlineCode>studies</TypographyInlineCode> - Informacje
              o Twoich studiach, takie jak numer indeksu, kierunek studiów oraz
              twoje grupy zajęciowe. Użyjemy to żeby ułatwić ci udostępnianie
              quizów dla twoich grup.
            </li>
            <li>
              <TypographyInlineCode>email</TypographyInlineCode> - Twój adres
              email (najczęściej [nr_indeksu]@student.pwr.edu.pl), który jest
              używany do kontaktu przy zgłaszaniu błędów w quizach.
            </li>
            <li>
              <TypographyInlineCode>photo</TypographyInlineCode> - Twoje zdjęcie
              profilowe, które jest wyświetlane w górnym prawym rogu strony oraz
              przy wyszukiwaniu osób.
            </li>
            <li>
              <TypographyInlineCode>grades</TypographyInlineCode> - Twoje oceny
              końcowe z USOS, które są wyświetlane w zakładce &quot;Oceny&quot;
              wraz z wyliczoną średnią. Nie są one zapisywane w bazie danych
              Testownika, a jedynie pobierane z USOS w momencie wyświetlania
              strony. Są one dostępne tylko dla Ciebie.
            </li>
          </ul>
          <p>
            Kod źródłowy Testownika jest dostępny na{" "}
            <a
              href="https://github.com/solvro/web-testownik"
              className="underline underline-offset-2"
            >
              GitHubie
            </a>
            , gdzie sam możesz zweryfikować, jakie dane są przetwarzane oraz jak
            są one wykorzystywane.
          </p>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
