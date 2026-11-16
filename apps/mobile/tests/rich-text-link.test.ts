import { beforeEach, expect, it, vi } from "vitest";
import {
  allowRichTextNavigation,
  openRichTextLink,
} from "../src/lib/rich-text-link";

const mocks = vi.hoisted(() => ({ open: vi.fn(), notify: vi.fn() }));
vi.mock("react-native", () => ({ Linking: { openURL: mocks.open } }));
vi.mock("../src/lib/alerts", () => ({ notify: mocks.notify }));
const en = (_pl: string, en: string) => en;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.open.mockResolvedValue(undefined);
});

it.each(["https://example.org", "http://example.org", "HTTPS://example.org"])(
  "opens HTTP links externally while keeping the quiz WebView in place",
  async (url) => {
    expect(allowRichTextNavigation(url, en)).toBe(false);
    expect(mocks.open).toHaveBeenCalledExactlyOnceWith(url);
    await Promise.resolve();
    expect(mocks.notify).not.toHaveBeenCalled();
  },
);

it.each([
  "mailto:a@example.org",
  "tel:123",
  "testownik://quiz/example",
  "javascript:alert(1)",
  "file:///private/example",
])(
  "blocks non-HTTP navigation without handing it to the operating system",
  (url) => {
    expect(allowRichTextNavigation(url, en)).toBe(false);
    expect(mocks.open).not.toHaveBeenCalled();
  },
);

it("allows the bundled document without launching an external app", () => {
  expect(allowRichTextNavigation("about:blank", en)).toBe(true);
  expect(mocks.open).not.toHaveBeenCalled();
});

it.each(["en", "pl"])(
  "shows localized recoverable feedback when an HTTP link cannot open (%s)",
  async (language) => {
    mocks.open.mockRejectedValue(new Error("native browser unavailable"));
    const t = (pl: string, en: string) => (language === "pl" ? pl : en);
    await openRichTextLink("https://example.org", t);
    expect(mocks.notify).toHaveBeenCalledExactlyOnceWith(
      t("Nie udało się otworzyć linku", "Couldn’t Open Link"),
      t("Spróbuj ponownie za chwilę.", "Please try again in a moment."),
    );
  },
);
