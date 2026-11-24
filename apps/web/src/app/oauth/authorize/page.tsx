import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  buildLoginPath,
  buildOAuthAuthorizePath,
  splitLoginError,
} from "@/lib/auth/login-redirect";
import { getServerCurrentUser } from "@/lib/auth/server";

import { OAuthAuthorizeClient } from "./client";
import { OAuthGuestNotice } from "./guest-notice";

export const metadata: Metadata = {
  title: "Autoryzacja aplikacji",
};

type SearchParameters = Record<string, string | string[] | undefined>;

function normalizeSearchParameters(
  searchParameters: SearchParameters,
): Record<string, string | string[]> {
  return Object.fromEntries(
    Object.entries(searchParameters).filter(
      (entry): entry is [string, string | string[]] => entry[1] !== undefined,
    ),
  );
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  // A failed sign-in comes back here with `?error=`; it belongs to the login
  // page, not to the authorization request.
  const { parameters: authorizationParameters, loginError } = splitLoginError(
    normalizeSearchParameters(await searchParams),
  );
  const returnPath = buildOAuthAuthorizePath(authorizationParameters);
  const currentUser = await getServerCurrentUser();

  if (currentUser === null) {
    redirect(buildLoginPath(returnPath, loginError));
  }

  if (currentUser.account_type === ACCOUNT_TYPE.GUEST) {
    return <OAuthGuestNotice loginPath={buildLoginPath(returnPath)} />;
  }

  return (
    <OAuthAuthorizeClient
      authorizationParameters={authorizationParameters}
      currentUser={currentUser}
    />
  );
}
