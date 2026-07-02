import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getServerCurrentUser } from "@/lib/auth/server";

import { OAuthAuthorizeClient } from "./client";

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

function buildReturnPath(
  authorizationParameters: Record<string, string | string[]>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(authorizationParameters)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        query.append(key, item);
      }
    } else {
      query.set(key, value);
    }
  }

  const queryString = query.toString();
  return queryString.length > 0
    ? `/oauth/authorize?${queryString}`
    : "/oauth/authorize";
}

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<SearchParameters>;
}) {
  const authorizationParameters = normalizeSearchParameters(await searchParams);
  const currentUser = await getServerCurrentUser();

  if (currentUser === null) {
    const loginParameters = new URLSearchParams({
      redirect: buildReturnPath(authorizationParameters),
    });
    redirect(`/login?${loginParameters.toString()}`);
  }

  return (
    <OAuthAuthorizeClient
      authorizationParameters={authorizationParameters}
      currentUser={currentUser}
    />
  );
}
