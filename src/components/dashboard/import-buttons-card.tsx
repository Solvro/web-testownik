import React from "react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

function ImportButtonsCard({
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  return (
    <Card {...props}>
      <CardContent className="flex h-full flex-wrap content-center justify-center gap-3">
        <Button variant="outline" asChild>
          <Link to="/create-quiz">Dodaj nowy quiz</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/import-quiz">Importuj quiz</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/import-quiz-legacy">Importuj quiz (stara wersja)</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export { ImportButtonsCard as default };
