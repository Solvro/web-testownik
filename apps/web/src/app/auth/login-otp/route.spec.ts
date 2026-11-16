import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as loginLink } from "../login-link/route";
import { GET, POST } from "./route";

vi.mock("@/lib/api", () => ({ API_URL: "https://api.example.test/api" }));

afterEach(() => {
  vi.unstubAllGlobals();
});

const data = {
  email: "owner@example.test",
  otp: "123456",
  guest_id: "guest-fixture-id",
};
const request = (
  origin: string | null,
  fields: Record<string, string> = data,
) =>
  new NextRequest("https://web.example.test/auth/login-otp", {
    method: "POST",
    headers: {
      ...(origin === null ? {} : { origin }),
      cookie:
        "access_token=guest-fixture-token; refresh_token=never-forward-this",
    },
    body: new URLSearchParams(fields),
  });

describe("guest login migration authority", () => {
  it("requires a same-origin POST before forwarding the guest bearer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", {
        status: 200,
        headers: { "Set-Cookie": "access_token=permanent; Path=/" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(request("https://web.example.test"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://web.example.test/");
    expect(response.headers.get("set-cookie")).toContain(
      "access_token=permanent",
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(options.headers).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer guest-fixture-token",
    });
    expect(JSON.parse(options.body as string)).toEqual(data);
  });

  it.each([null, "https://attacker.example.test", "null"])(
    "rejects forged or missing origin %s without contacting backend",
    async (origin) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      const response = await POST(request(origin));
      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("also rejects a cross-origin ordinary OTP POST", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      request("https://attacker.example.test", {
        email: data.email,
        otp: data.otp,
      }),
    );
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects OTP and link URLs carrying a guest UUID without borrowing browser cookies", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const clicked = new NextRequest(
      "https://web.example.test/auth/login-otp?email=owner@example.test&otp=123456&guest_id=victim",
      { headers: { cookie: "access_token=victim" } },
    );
    const otpResponse = await GET(clicked);
    expect(otpResponse.status).toBe(403);
    const linkResponse = await loginLink(
      new NextRequest(
        "https://web.example.test/auth/login-link?token=fixture&guest_id=victim",
        {
          headers: { cookie: "access_token=victim" },
        },
      ),
    );
    expect(linkResponse.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("keeps ordinary email links and OTP login independent of existing guest cookies", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await GET(
      new NextRequest(
        "https://web.example.test/auth/login-otp?email=owner@example.test&otp=123456",
        { headers: { cookie: "access_token=expired" } },
      ),
    );
    await loginLink(
      new NextRequest(
        "https://web.example.test/auth/login-link?token=fixture",
        { headers: { cookie: "access_token=expired" } },
      ),
    );
    for (const call of fetchMock.mock.calls) {
      const options = call[1] as RequestInit;
      expect(options.headers).toEqual({ "Content-Type": "application/json" });
      expect(options.body).not.toContain("guest_id");
    }
  });

  it.each([
    [403, "guest_auth_required"],
    [409, "guest_migration_failed"],
  ] as const)(
    "explains guest recovery for status %s without mislabelling a valid OTP",
    async (status, code) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status })),
      );
      const response = await POST(request("https://web.example.test"));
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toContain(`error=${code}`);
    },
  );
});
