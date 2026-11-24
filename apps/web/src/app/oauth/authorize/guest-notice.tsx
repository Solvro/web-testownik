import { IdCardLanyardIcon, LogInIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** A guest account is throwaway, so the backend refuses to connect apps to it. */
export function OAuthGuestNotice({
  loginPath,
}: {
  loginPath: string;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex w-full max-w-md items-center justify-center">
      <Card className="w-full">
        <CardHeader className="text-center">
          <div className="bg-primary/10 text-primary mx-auto mb-2 grid size-14 place-items-center rounded-full">
            <IdCardLanyardIcon className="size-7" />
          </div>
          <CardTitle className="text-lg leading-tight font-semibold text-balance">
            Zaloguj się, aby połączyć aplikację
          </CardTitle>
          <CardDescription className="text-balance">
            Korzystasz z konta gościa, a do niego nie można podłączyć
            zewnętrznej aplikacji.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center text-sm text-balance">
            Zaloguj się przez USOS lub e-mail. Quizy z konta gościa przeniesiemy
            na Twoje konto, a potem wrócisz tutaj, żeby dokończyć łączenie.
          </p>
        </CardContent>
        <CardFooter className="bg-muted/10 border-t">
          <ButtonLink href={loginPath} className="w-full">
            <LogInIcon />
            Zaloguj się
          </ButtonLink>
        </CardFooter>
      </Card>
    </div>
  );
}
