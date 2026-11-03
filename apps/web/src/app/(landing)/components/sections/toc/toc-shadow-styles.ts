/**
 * Peeks render inside a shadow root (see `toc-section-preview.ts`), which does
 * not see the page CSS. This module copies it in as constructed stylesheets.
 */

/** Constructed copies of the page stylesheets, shared by every shadow root. */
let shadowStyles: CSSStyleSheet[] | null = null;
let shadowStylesSignature = "";

/**
 * A cheap fingerprint of the page CSS. Changes when a stylesheet is added,
 * removed or toggled (a lazily loaded chunk, a dev-server hot update).
 */
function styleSignature(): string {
  const parts: string[] = [];
  for (const sheet of document.styleSheets) {
    let rules = -1;
    try {
      rules = sheet.cssRules.length;
    } catch {
      // Cross-origin sheet: its rules are unreadable, so they are not copied.
    }
    parts.push(
      `${sheet.href ?? "inline"}:${String(rules)}:${String(sheet.disabled)}`,
    );
  }
  return parts.join("|");
}

/**
 * One constructed sheet per page sheet (and per `@import`ed one), keeping its
 * base URL so relative `url()`s still resolve and its media list.
 */
function copyStyleSheet(sheet: CSSStyleSheet, into: CSSStyleSheet[]): void {
  if (sheet.disabled) {
    return;
  }
  let rules: CSSRuleList;
  try {
    rules = sheet.cssRules;
  } catch {
    // Cross-origin: skip.
    return;
  }
  const chunks: string[] = [];
  const flush = (): void => {
    if (chunks.length === 0) {
      return;
    }
    const copy = new CSSStyleSheet({
      baseURL: sheet.href ?? document.baseURI,
      media: sheet.media.mediaText,
    });
    copy.replaceSync(chunks.join("\n"));
    into.push(copy);
    chunks.length = 0;
  };
  for (const rule of rules) {
    // Constructed sheets reject `@import`; inline the imported sheet instead.
    if (rule instanceof CSSImportRule) {
      flush();
      if (rule.styleSheet !== null) {
        copyStyleSheet(rule.styleSheet, into);
      }
      continue;
    }
    chunks.push(rule.cssText);
  }
  flush();
}

function adopt(root: ShadowRoot, sheets: CSSStyleSheet[]): void {
  const adopted = root.adoptedStyleSheets;
  if (
    adopted.length !== sheets.length ||
    adopted.some((sheet, index) => sheet !== sheets[index])
  ) {
    root.adoptedStyleSheets = sheets;
  }
}

/**
 * Copy the page CSS into the shadow root so clones render as they do in the
 * page. Serialising takes a few tens of milliseconds at 4x CPU, so it runs in
 * the first idle build and only again when the page CSS changes.
 */
export function syncShadowStyles(root: ShadowRoot): void {
  const signature = styleSignature();
  if (shadowStyles === null || signature !== shadowStylesSignature) {
    const sheets: CSSStyleSheet[] = [];
    for (const sheet of document.styleSheets) {
      copyStyleSheet(sheet, sheets);
    }
    shadowStyles = sheets;
    shadowStylesSignature = signature;
  }
  adopt(root, shadowStyles);
}

/**
 * Give a new shadow root the copies made so far, without re-checking the page
 * CSS. Returns whether there were any.
 */
export function adoptCopiedStyles(root: ShadowRoot): boolean {
  if (shadowStyles === null) {
    return false;
  }
  adopt(root, shadowStyles);
  return true;
}

/**
 * `dark:` compiles to `:is(.dark *)`, which cannot see `html.dark` from inside
 * a shadow root; mirror the theme class onto the scope instead. A theme switch
 * rebuilds every peek, which calls this again.
 */
export function syncShadowTheme(scope: HTMLElement): void {
  scope.classList.toggle(
    "dark",
    document.documentElement.classList.contains("dark"),
  );
}
