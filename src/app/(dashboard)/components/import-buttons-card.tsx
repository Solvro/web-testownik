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
        <Button>
          <LayersPlus className="size-6" />
          <Link href="/create-quiz">Dodaj nowy quiz</Link>
        </Button>
        <Button>
          <Import className="size-6" />
          <Link href="/import-quiz">Importuj quiz</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
