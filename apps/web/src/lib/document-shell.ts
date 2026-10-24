/**
 * Which document shell the root layout renders.
 *
 * The landing page's device screens (`/landing-screen/*`) are iframes of the
 * landing itself and must not carry the app around them: no navbar, footer,
 * auth, analytics or surveys. A layout cannot see the pathname, so `proxy.ts`
 * marks those requests with this header (and strips it from every other
 * request, so it cannot be forged into the app's routes).
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
