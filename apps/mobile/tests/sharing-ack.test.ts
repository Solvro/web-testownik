import type { Quiz, SharedQuiz } from "@testownik/core/quiz/types";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  confirmSharingGrant,
  holdSharingTarget,
  sharingRead,
  unconfirmedSharesKey,
  watchSharingReads,
  addSharingEntry,
  commitSharingAck,
  sharingEntry,
  sharingQuizAck,
} from "../src/lib/sharing-ack";

const entry = {
  id: "entry",
  user: { id: "person", full_name: "Fixture" },
  group: null,
  allow_edit: false,
} as SharedQuiz;
describe("sharing acknowledgements", () => {
  it("cancels an older GET before applying the server acknowledgement", async () => {
    const cache = new QueryClient();
    const key = ["shares", "quiz", "owner"];
    cache.setQueryData(key, [entry]);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const oldGet = cache
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          await gate;
          return [entry];
        },
      })
      .catch(() => undefined);
    await commitSharingAck(cache, key, new AbortController().signal, () => [
      { ...entry, allow_edit: true },
    ]);
    release();
    await oldGet;
    expect(cache.getQueryData(key)).toEqual([{ ...entry, allow_edit: true }]);
    cache.clear();
  });
  it("does not commit or refresh across logout during cancellation", async () => {
    const cache = new QueryClient();
    const owner = new AbortController();
    let release!: () => void;
    vi.spyOn(cache, "cancelQueries").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    const update = vi.fn(() => []);
    const pending = commitSharingAck(cache, ["shares"], owner.signal, update);
    owner.abort();
    release();
    await pending;
    expect(update).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
  it("does not turn a successful write into a write failure if the local cache throws", async () => {
    const cache = new QueryClient();
    vi.spyOn(cache, "setQueryData").mockImplementation(() => {
      throw new Error("local cache");
    });
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    await expect(
      commitSharingAck(
        cache,
        ["shares"],
        new AbortController().signal,
        () => [],
      ),
    ).resolves.toBeUndefined();
    expect(invalidate).toHaveBeenCalledOnce();
  });
  it.each([
    null,
    undefined,
    {},
    { ...entry, id: null },
    { ...entry, allow_edit: "true" },
    { ...entry, user: { id: "person" } },
    { ...entry, user: null },
  ])("retains existing access data for malformed ACK %j", (ack) => {
    const previous = [entry];
    expect(sharingEntry(ack)).toBe(false);
    expect(addSharingEntry(previous, ack)).toBe(previous);
  });
  it("adopts a valid group ACK and replaces duplicate response IDs", () => {
    const ack = {
      ...entry,
      user: null,
      group: { id: "group", name: "Fixture Group" },
    };
    expect(addSharingEntry([entry], ack)).toEqual([ack]);
  });
});

describe("sharing quiz ACKs", () => {
  const quiz = {
    id: "quiz",
    title: "Fixture",
    can_edit: true,
    visibility: 1,
    allow_anonymous: false,
    is_anonymous: false,
  } as Quiz;
  it.each([
    null,
    {},
    { ...quiz, id: "another" },
    { ...quiz, visibility: 9 },
    { ...quiz, is_anonymous: "true" },
  ])("does not corrupt visible settings on malformed ACK %j", (ack) => {
    expect(sharingQuizAck(quiz, ack)).toBe(quiz);
  });
  it("retains quiz metadata when a valid visibility ACK omits it", () => {
    expect(
      sharingQuizAck(quiz, {
        id: quiz.id,
        visibility: 2,
        allow_anonymous: true,
        is_anonymous: true,
      }),
    ).toEqual({
      ...quiz,
      visibility: 2,
      allow_anonymous: true,
      is_anonymous: true,
    });
  });
});

describe("unconfirmed sharing grants", () => {
  const key = ["shares", "quiz", "owner"];
  const heldKey = unconfirmedSharesKey("quiz", "owner");
  const target = { user_id: "person" };
  const setup = () => {
    const cache = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    cache.setQueryData(key, []);
    const owner = new AbortController();
    const stop = watchSharingReads(cache, "quiz", "owner", owner.signal);
    return { cache, owner, stop };
  };
  it.each([{ user_id: "person" }, { study_group_id: "group" }])(
    "ignores a stale Add callback after access is confirmed for %j",
    async (target) => {
      const { cache, owner, stop } = setup();
      const confirmed =
        "user_id" in target
          ? entry
          : { ...entry, user: null, group: { id: "group", name: "Group" } };
      cache.setQueryData(key, [confirmed]);
      const write = vi.fn(async () => confirmed);
      expect(
        await confirmSharingGrant(
          cache,
          "quiz",
          "owner",
          owner.signal,
          target,
          write,
        ),
      ).toBe(false);
      expect(write).not.toHaveBeenCalled();
      stop();
      cache.clear();
    },
  );
  it("keeps user and group identifiers separate when checking confirmed access", async () => {
    const { cache, owner, stop } = setup();
    cache.setQueryData(key, [entry]);
    const confirmed = {
      ...entry,
      id: "group-entry",
      user: null,
      group: { id: "person", name: "Group" },
    };
    const write = vi.fn(async () => confirmed);
    expect(
      await confirmSharingGrant(
        cache,
        "quiz",
        "owner",
        owner.signal,
        { study_group_id: "person" },
        write,
      ),
    ).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    stop();
    cache.clear();
  });
  it.each([
    null,
    {},
    { ...entry, user: { id: "someone-else", full_name: "Other" } },
  ])(
    "holds an unreadable or mismatched ACK %j without inventing IDs",
    async (ack) => {
      const { cache, owner, stop } = setup();
      const previous = cache.getQueryData(key);
      expect(
        await confirmSharingGrant(
          cache,
          "quiz",
          "owner",
          owner.signal,
          target,
          async () => ack,
        ),
      ).toBe(false);
      expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
      expect(cache.getQueryData(key)).toBe(previous);
      const second = vi.fn(async () => entry);
      expect(
        await confirmSharingGrant(
          cache,
          "quiz",
          "owner",
          owner.signal,
          target,
          second,
        ),
      ).toBe(false);
      expect(second).not.toHaveBeenCalled();
      stop();
      cache.clear();
    },
  );
  it.each([
    new SyntaxError("truncated"),
    { status: 503 },
    new Error("Failed to fetch"),
    { status: 408 },
  ])("holds an ambiguous failure %j until a server read", async (error) => {
    const { cache, owner, stop } = setup();
    await expect(
      confirmSharingGrant(
        cache,
        "quiz",
        "owner",
        owner.signal,
        target,
        async () => {
          throw error;
        },
      ),
    ).rejects.toMatchObject({ code: "sharingUnconfirmed" });
    expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
    stop();
    cache.clear();
  });
  it("does not hold a definite rejected request", async () => {
    const { cache, owner, stop } = setup();
    const error = { status: 403 };
    await expect(
      confirmSharingGrant(
        cache,
        "quiz",
        "owner",
        owner.signal,
        target,
        async () => {
          throw error;
        },
      ),
    ).rejects.toBe(error);
    expect(cache.getQueryData(heldKey)).toBeUndefined();
    stop();
    cache.clear();
  });
  it("does not call the server after its owner was disposed", async () => {
    const { cache, owner, stop } = setup();
    owner.abort();
    const write = vi.fn(async () => entry);
    expect(
      await confirmSharingGrant(
        cache,
        "quiz",
        "owner",
        owner.signal,
        target,
        write,
      ),
    ).toBe(false);
    expect(write).not.toHaveBeenCalled();
    stop();
    cache.clear();
  });
  it("retains the hold through manual cache writes and clears it after committed server data", async () => {
    const { cache, owner, stop } = setup();
    await holdSharingTarget(cache, "quiz", "owner", owner.signal, target);
    await holdSharingTarget(cache, "quiz", "owner", owner.signal, target);
    cache.setQueryData(key, []);
    expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
    await cache.fetchQuery({
      queryKey: key,
      queryFn: async () => sharingRead([entry]),
    });
    expect(cache.getQueryData(key)).toEqual([entry]);
    expect(cache.getQueryData(heldKey)).toEqual([]);
    stop();
    cache.clear();
  });
  it("cancels an older read before recording the hold; its late reply cannot release it", async () => {
    const { cache, owner, stop } = setup();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const old = cache
      .fetchQuery({
        queryKey: key,
        queryFn: async () => {
          await gate;
          return [];
        },
      })
      .catch(() => undefined);
    await holdSharingTarget(cache, "quiz", "owner", owner.signal, target);
    release();
    await old;
    expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
    stop();
    cache.clear();
  });
  it.each([null, [{}]])(
    "keeps the hold and cached data when a server read is malformed %j",
    async (reply) => {
      const { cache, owner, stop } = setup();
      await holdSharingTarget(cache, "quiz", "owner", owner.signal, target);
      await expect(
        cache.fetchQuery({
          queryKey: key,
          queryFn: async () => sharingRead(reply),
        }),
      ).rejects.toMatchObject({ code: "server" });
      expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
      expect(cache.getQueryData(key)).toEqual([]);
      stop();
      cache.clear();
    },
  );
  it("does not let another quiz or disposed session settle the hold", async () => {
    const { cache, owner, stop } = setup();
    await holdSharingTarget(cache, "quiz", "owner", owner.signal, target);
    await cache.fetchQuery({
      queryKey: ["shares", "another", "owner"],
      queryFn: async () => [],
    });
    expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
    owner.abort();
    await cache.fetchQuery({ queryKey: key, queryFn: async () => [entry] });
    expect(cache.getQueryData(heldKey)).toEqual(["user:person"]);
    stop();
    cache.clear();
  });
});

describe("sharing server list shapes", () => {
  it("accepts a paginated response without copying or filtering entries", () => {
    const rows = [entry];
    expect(sharingRead({ results: rows, next: null })).toBe(rows);
  });
  it.each([null, undefined, {}, { results: null }, { results: [{}] }])(
    "localizes an invalid list envelope %j",
    (reply) => {
      expect(() => sharingRead(reply)).toThrow(
        expect.objectContaining({ code: "server" }),
      );
    },
  );
});
