/**
 * The landing's device screens (`/landing-screen/*`) are iframes and must not
 * carry the app's navbar, footer, auth, analytics or surveys. A layout cannot
 * see the pathname, so `proxy.ts` sets this header on those requests and strips
 * it from every other one, so it cannot be forged.
 */
export const DOCUMENT_SHELL_HEADER = "x-testownik-document-shell";

export const DOCUMENT_PATHNAME_HEADER = "x-testownik-document-pathname";

export const BARE_DOCUMENT_SHELL = "bare";

export function isBareDocumentPath(pathname: string): boolean {
  return pathname.startsWith("/landing-screen/");
}

/** Both values are overwritten by the proxy for every application route. */
export function shouldRenderBareDocument(
  headers: Pick<Headers, "get">,
): boolean {
  const pathname = headers.get(DOCUMENT_PATHNAME_HEADER);
  return (
    headers.get(DOCUMENT_SHELL_HEADER) === BARE_DOCUMENT_SHELL &&
    pathname !== null &&
    isBareDocumentPath(pathname)
  );
}
