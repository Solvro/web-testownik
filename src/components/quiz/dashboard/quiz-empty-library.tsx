import { PlusIcon, UploadIcon } from "lucide-react";
import Link from "next/link";
import { ViewTransition } from "react";

import { Button } from "@/components/ui/button";

export function QuizEmptyLibrary() {
  return (
    <ViewTransition>
      <div className="space-y-3 text-center">
        <p className="text-muted-foreground text-sm">
          Nie masz jeszcze żadnych quizów.
        </p>
        <div className="flex flex-row justify-center gap-2">
          <Button
            nativeButton={false}
            render={(props) => (
              <Link {...props} href="/create-quiz">
                Stwórz quiz
                <PlusIcon />
              </Link>
            )}
          ></Button>

          <Button
            nativeButton={false}
            render={(props) => (
              <Link {...props} href="/import-quiz">
                Importuj
                <UploadIcon />
              </Link>
            )}
          ></Button>
        </div>
      </div>
    </ViewTransition>
  );
}
