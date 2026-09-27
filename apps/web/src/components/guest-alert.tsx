import { cookies } from "next/headers";

import { GuestAlertClient } from "./guest-alert-client";

export async function GuestAlert(): Promise<React.JSX.Element> {
  const cookieStore = await cookies();
  const isHidden = cookieStore.get("guest-alert-hidden")?.value === "true";

  return <GuestAlertClient isInitiallyHidden={isHidden} />;
}
