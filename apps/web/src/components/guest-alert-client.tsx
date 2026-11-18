"use client";

import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import { IdCardLanyardIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";

import { AppContext } from "@/app-context";
import { CompactNotice } from "@/components/compact-notice";
import { setCookie } from "@/lib/cookies";

interface GuestAlertClientProps {
  isInitiallyHidden?: boolean;
}

export function GuestAlertClient({
  isInitiallyHidden = false,
}: GuestAlertClientProps): React.JSX.Element | null {
  const { user } = useContext(AppContext);
  const pathname = usePathname();

  const [isJustCreated, setIsJustCreated] = useState(false);
  const [isHidden, setIsHidden] = useState(isInitiallyHidden);
  const previousUserRef = useRef(user);

  useEffect(() => {
    const previousUser = previousUserRef.current;
    previousUserRef.current = user;

    if (
      previousUser === null &&
      user !== null &&
      user.account_type === ACCOUNT_TYPE.GUEST
    ) {
      setIsJustCreated(true);
    }
  }, [user]);

  if (
    user?.account_type !== ACCOUNT_TYPE.GUEST ||
    isHidden ||
    pathname === "/login"
  ) {
    return null;
  }

  return (
    <CompactNotice
      icon={IdCardLanyardIcon}
      dismissLabel="Ukryj na 3 dni"
      onDismiss={() => {
        setIsHidden(true);
        setCookie("guest-alert-hidden", "true", {
          maxAge: 60 * 60 * 24 * 3,
        }); // 3 days
      }}
    >
      Konto gościa jest tymczasowe – dane{" "}
      <b>znikną po 30 dniach bez aktywności</b>.{" "}
      <Link href="/login">Zaloguj się</Link>, aby je zachować.
      {isJustCreated ? (
        <>
          {" "}
          Korzystając dalej, akceptujesz <Link href="/terms">Regulamin</Link> i
          potwierdzasz zapoznanie się z{" "}
          <Link href="/privacy-policy">Polityką Prywatności</Link>.
        </>
      ) : null}
    </CompactNotice>
  );
}
