import { PlusIcon, UploadIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

interface QuizFilterNotFoundProps {
  handleResetFilters: () => void;
}

export function QuizFilterNotFound({
  handleResetFilters,
}: QuizFilterNotFoundProps) {
  return (
    <ViewTransition>
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nie znaleźliśmy quizu, którego szukasz</EmptyTitle>
          <EmptyDescription>
            Usuń albo zmień wybrane filtry, aby znaleźć inne quizy.
            <br />
            Albo utwórz lub importuj nowy quiz.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex flex-row justify-center">
          <Button onClick={handleResetFilters} variant="outline">
            Wyczyść Filtry <XIcon />
          </Button>
          <ViewTransition name="create-quiz">
            <Button
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/create-quiz">
                  Stwórz quiz
                  <PlusIcon />
                </Link>
              )}
            ></Button>
          </ViewTransition>
          <ViewTransition name="import-quiz">
            <Button
              nativeButton={false}
              render={(props) => (
                <Link {...props} href="/import-quiz">
                  Importuj
                  <UploadIcon />
                </Link>
              )}
            ></Button>
          </ViewTransition>
        </EmptyContent>
      </Empty>
    </ViewTransition>
  );
}
