import { Import, LayersPlus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ImportButtonsCard({
  ...props
}: React.ComponentProps<typeof Card>): React.JSX.Element {
  return (
    <Card {...props}>
      <CardContent className="flex h-full flex-col flex-wrap content-center justify-center gap-3">
        <Button asChild>
          <Link href="/create-quiz">
            <LayersPlus className="size-6" />
            Dodaj nowy quiz
          </Link>
        </Button>
        <Button asChild>
          <Link href="/import-quiz">
            <Import className="size-6" />
            Importuj quiz
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
