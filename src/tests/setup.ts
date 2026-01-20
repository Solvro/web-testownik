/* eslint-disable @typescript-eslint/no-empty-function */
import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

import { server } from "./mocks/server";

process.env.NEXT_PUBLIC_API_URL = "http://test.local";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useParams: () => ({}),
}));

// JSDOM doesn't implement matchMedia; used by Loader when theme === "system".
if (typeof window.matchMedia !== "function") {
  window.matchMedia = (query: string) => {
    return {
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };
}

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// JSDOM doesn't implement scrollIntoView; some components call it during UI interactions.
if (
  typeof (Element.prototype as unknown as { scrollIntoView?: unknown })
    .scrollIntoView !== "function"
) {
  (
    Element.prototype as unknown as {
      scrollIntoView: (options?: ScrollIntoViewOptions | boolean) => void;
    }
  ).scrollIntoView = () => {};
}

// Some JSDOM environments don't implement File.text().
if (typeof File !== "undefined" && typeof File.prototype.text !== "function") {
  File.prototype.text = async function text(): Promise<string> {
    const self = this as unknown as {
      arrayBuffer?: () => Promise<ArrayBuffer>;
    };

    if (typeof self.arrayBuffer === "function") {
      const buffer = await self.arrayBuffer();
      return new TextDecoder().decode(buffer);
    }

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        resolve(String(reader.result ?? ""));
      });
      reader.addEventListener("error", () => {
        reject(reader.error ?? new Error("FileReader failed to read file"));
      });
      // eslint-disable-next-line unicorn/prefer-blob-reading-methods
      reader.readAsText(this);
    });
  };
}

if (
  typeof (Element.prototype as unknown as { hasPointerCapture?: unknown })
    .hasPointerCapture !== "function"
) {
  (
    Element.prototype as unknown as {
      hasPointerCapture: (pointerId: number) => boolean;
    }
  ).hasPointerCapture = () => false;
}
if (
  typeof (Element.prototype as unknown as { setPointerCapture?: unknown })
    .setPointerCapture !== "function"
) {
  (
    Element.prototype as unknown as {
      setPointerCapture: (pointerId: number) => void;
    }
  ).setPointerCapture = () => {};
}
if (
  typeof (Element.prototype as unknown as { releasePointerCapture?: unknown })
    .releasePointerCapture !== "function"
) {
  (
    Element.prototype as unknown as {
      releasePointerCapture: (pointerId: number) => void;
    }
  ).releasePointerCapture = () => {};
}

beforeAll(() => {
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});
