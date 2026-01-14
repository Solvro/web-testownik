import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ImportButtonsCard({
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  return (
    <Card {...props}>
      <CardContent className="flex h-full flex-wrap content-center justify-center gap-3">
        <Button variant="outline" asChild>
          <Link href="/create-quiz">Dodaj nowy quiz</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/import-quiz">Importuj quiz</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
