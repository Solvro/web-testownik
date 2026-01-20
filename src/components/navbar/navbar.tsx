import { cookies } from "next/headers";

import { AUTH_COOKIES, GUEST_COOKIE_NAME } from "@/lib/auth/constants";
import { decodeAccessToken } from "@/lib/auth/jwt-utils";

import { NavbarClient } from "./navbar-client";
import type { NavbarUser } from "./navbar-client";

export async function Navbar() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIES.ACCESS_TOKEN)?.value;

  let user: NavbarUser | null = null;

  if (accessToken !== undefined && accessToken !== "") {
    const payload = decodeAccessToken(accessToken);
    if (payload !== null) {
      user = {
        isStaff: payload.is_staff,
        isSuperuser: payload.is_superuser,
        photo: payload.photo || null,
        fullName: payload.full_name || null,
      };
    }
  }

  const isGuest = cookieStore.get(GUEST_COOKIE_NAME)?.value === "true";

  return <NavbarClient initialUser={user} initialIsGuest={isGuest} />;
}
