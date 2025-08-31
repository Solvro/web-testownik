import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router";

const ImportButtonsCard: React.FC<React.ComponentProps<typeof Card>> = ({
  ...props
}) => {
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
};

export default ImportButtonsCard;
