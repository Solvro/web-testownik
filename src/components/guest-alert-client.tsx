"use client";

import { EyeOffIcon, IdCardLanyardIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useContext, useEffect, useState } from "react";

import { AppContext } from "@/app-context";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setCookie } from "@/lib/cookies";
import { ACCOUNT_TYPE } from "@/types/user";

interface GuestAlertClientProps {
  isInitiallyHidden?: boolean;
}

export function GuestAlertClient({
  isInitiallyHidden = false,
}: GuestAlertClientProps): React.JSX.Element | null {
  const { user } = useContext(AppContext);
  const searchParameters = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [isJustCreated, setIsJustCreated] = useState(false);
  const [isHidden, setIsHidden] = useState(isInitiallyHidden);

  useEffect(() => {
    if (searchParameters.get("guest_created") === "true") {
      setIsJustCreated(true);
      const newSearchParameters = new URLSearchParams(
        searchParameters.toString(),
      );
      newSearchParameters.delete("guest_created");
      const newUrl = `${pathname}${newSearchParameters.toString() ? `?${newSearchParameters.toString()}` : ""}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParameters, pathname, router]);

  if (
    user?.account_type !== ACCOUNT_TYPE.GUEST ||
    isHidden ||
    pathname === "/login"
  ) {
    return null;
  }

  return (
    <Alert variant="default">
      <IdCardLanyardIcon />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Ukryj"
              onClick={() => {
                setIsHidden(true);
                setCookie("guest-alert-hidden", "true", {
                  maxAge: 60 * 60 * 24 * 3,
                }); // 3 days
              }}
              className="text-muted-foreground hover:text-foreground absolute top-0 right-0 m-1"
            >
              <EyeOffIcon />
            </Button>
          }
        ></TooltipTrigger>
        <TooltipContent>Ukryj na 3 dni</TooltipContent>
      </Tooltip>
      <AlertTitle>Korzystasz z konta gościa</AlertTitle>
      <AlertDescription>
        {isJustCreated ? (
          <>
            <p>
              Utworzyliśmy dla Ciebie tymczasowe konto gościa, abyś mógł zacząć
              korzystać z Testownika bez rejestracji. Pamiętaj jednak, że konto
              gościa ma ograniczone możliwości i dane z tego konta{" "}
              <b>zostaną usunięte po 30 dniach bez aktywności</b>.{" "}
              <Link
                href="/login"
                className="underline-offset-2 hover:underline"
              >
                Zaloguj się
              </Link>{" "}
              aby korzystać ze wszystkich funkcji Testownika i zachować swoje
              postępy!
            </p>
            <p>
              Kontynuując korzystanie z Testownika, potwierdzasz, że akceptujesz{" "}
              <Link href="/privacy-policy">politykę prywatności</Link> i warunki
              korzystania z aplikacji.
            </p>
          </>
        ) : (
          <p>
            Konto gościa jest tymczasowe. Dane{" "}
            <b>zostaną usunięte po 30 dniach bez aktywności</b>.{" "}
            <Link href="/login" className="underline-offset-2 hover:underline">
              Zaloguj się
            </Link>{" "}
            aby zachować postępy i korzystać ze wszystkich funkcji
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
