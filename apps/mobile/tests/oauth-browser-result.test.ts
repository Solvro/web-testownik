import { createRequire } from "node:module";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const nodeRequire = createRequire(import.meta.url);
const previousPngLoader = nodeRequire.extensions[".png"];

const mocks = vi.hoisted(() => ({
  open: vi.fn(),
  request: vi.fn(),
  push: vi.fn(),
  state: vi.fn(),
}));
vi.mock("react", () => ({
  useRef: () => ({ current: false }),
  useState: (initial: unknown) => [initial, mocks.state],
}));
vi.mock("react-native", () => ({
  Platform: { OS: "web" },
  Image: "Image",
  View: "View",
}));
vi.mock("expo-secure-store", () => ({}));
vi.mock("expo-crypto", () => ({
  randomUUID: () => "synthetic-random-uuid",
  digestStringAsync: async () => "synthetic-digest",
  CryptoDigestAlgorithm: { SHA256: "SHA256" },
  CryptoEncoding: { BASE64: "BASE64" },
}));
vi.mock("expo-web-browser", () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: mocks.open,
}));
vi.mock("expo-router", () => ({
  Redirect: "Redirect",
  router: { push: mocks.push },
}));
vi.mock("../src/components/ui", () => ({
  Button: "Button",
  ErrorState: "ErrorState",
  Heading: "Heading",
  Label: "Label",
  Screen: "Screen",
}));
vi.mock("../src/lib/api", () => ({
  WEB_URL: "https://synthetic.invalid",
  api: { request: mocks.request },
}));
vi.mock("../src/lib/session", () => ({ useSession: () => ({ user: null }) }));
vi.mock("../src/lib/locale", () => ({
  useLocale: () => ({ t: (_pl: string, en: string) => en }),
}));

beforeEach(() => {
  nodeRequire.extensions[".png"] = (module) => {
    module.exports = 1;
  };
  vi.resetModules();
  vi.clearAllMocks();
  const items = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => items.set(key, value),
    removeItem: (key: string) => items.delete(key),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  if (previousPngLoader) nodeRequire.extensions[".png"] = previousPngLoader;
  else delete nodeRequire.extensions[".png"];
});

async function signIn() {
  const { default: Login } = await import("../app/login");
  const root = Login();
  const button = root.props.children.find(
    (child: { type?: unknown } | null) => child?.type === "Button",
  );
  await button.props.onPress();
}

it("Android-style browser dismiss preserves PKCE for a separately delivered Router callback", async () => {
  mocks.open.mockResolvedValue({ type: "dismiss" });
  await signIn();
  const { exchangeOAuth } = await import("../src/lib/oauth");
  mocks.request.mockResolvedValue({
    access_token: "synthetic-access",
    refresh_token: "synthetic-refresh",
    token_type: "Bearer",
  });
  await expect(
    exchangeOAuth({ code: "redirect-code", state: "syntheticrandomuuid" }),
  ).resolves.toEqual({
    access: "synthetic-access",
    refresh: "synthetic-refresh",
  });
  expect(mocks.request).toHaveBeenCalledTimes(1);
  expect(mocks.push).not.toHaveBeenCalled();
});

it("explicit browser cancel removes only its own PKCE flow", async () => {
  mocks.open.mockResolvedValue({ type: "cancel" });
  await signIn();
  const { exchangeOAuth } = await import("../src/lib/oauth");
  await expect(
    exchangeOAuth({ code: "cancelled-code", state: "syntheticrandomuuid" }),
  ).rejects.toMatchObject({ code: "oauthState" });
  expect(mocks.request).not.toHaveBeenCalled();
});

it("late browser cancel leaves a newer login flow intact", async () => {
  const { saveOAuth } = await import("../src/lib/oauth");
  const newer = { verifier: "new-verifier", state: "new-state" };
  mocks.open.mockImplementation(async () => {
    await saveOAuth(newer);
    return { type: "cancel" };
  });
  await signIn();
  expect(
    JSON.parse(sessionStorage.getItem("testownik.oauth.v1") ?? "null"),
  ).toEqual(newer);
});
