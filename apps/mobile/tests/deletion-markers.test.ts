import { beforeEach, expect, it, vi } from "vitest";
import { externalDeletionMarkers } from "../src/lib/deletion-markers.native";

const state = vi.hoisted(() => ({
  directories: new Set<string>(),
  files: new Set<string>(),
  failCreate: false,
  noopCreate: false,
  inaccessible: false,
  noopDelete: false,
}));
vi.mock("expo-file-system", () => {
  class File {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    get exists() {
      return state.files.has(this.uri);
    }
    get name() {
      return this.uri.slice(this.uri.lastIndexOf("/") + 1);
    }
    create() {
      if (state.failCreate) throw new Error("Disk unavailable");
      if (!state.noopCreate) state.files.add(this.uri);
    }
    delete() {
      if (!state.noopDelete) state.files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(parent: string, name: string) {
      this.uri = `${parent}/${name}`;
    }
    get exists() {
      return !state.inaccessible && state.directories.has(this.uri);
    }
    create() {
      if (state.inaccessible) throw new Error("Marker directory inaccessible");
      if (state.failCreate) throw new Error("Disk unavailable");
      state.directories.add(this.uri);
    }
    list() {
      if (state.inaccessible) throw new Error("Marker directory inaccessible");
      return [...state.files]
        .filter((uri) => uri.startsWith(`${this.uri}/`))
        .map((uri) => new File(this, uri.slice(this.uri.length + 1)));
    }
  }
  return {
    File,
    Directory,
    Paths: { document: "file:///private/app/documents" },
  };
});
beforeEach(() => {
  state.directories.clear();
  state.files.clear();
  state.failCreate = false;
  state.noopCreate = false;
  state.inaccessible = false;
  state.noopDelete = false;
});
const folder = "file:///private/app/documents/account-deletion-markers.v1";

it("uses durable empty-file existence and discovers the owner without a body write", async () => {
  expect(await externalDeletionMarkers.list()).toEqual([]);
  await externalDeletionMarkers.write("owner-a");
  await externalDeletionMarkers.write("owner-a");
  expect([...state.files]).toEqual([
    `${folder}/006f0077006e00650072002d0061.pending`,
  ]);
  expect(await externalDeletionMarkers.list()).toEqual(["owner-a"]);
});

it("keeps arbitrary owner strings inside one canonical filename", async () => {
  const owner = "../other/Zażółć 🌱%";
  await externalDeletionMarkers.write(owner);
  expect([...state.files]).toEqual([
    expect.stringMatching(/\/(?:[0-9a-f]{4})+\.pending$/),
  ]);
  expect(await externalDeletionMarkers.list()).toEqual([owner]);
});

it("removes only the completed owner's marker", async () => {
  await externalDeletionMarkers.write("owner-a");
  await externalDeletionMarkers.write("owner-b");
  state.files.add(`${folder}/unrelated.txt`);
  await externalDeletionMarkers.remove("owner-a");
  await externalDeletionMarkers.remove("owner-a");
  expect(await externalDeletionMarkers.list()).toEqual(["owner-b"]);
  expect(state.files.has(`${folder}/unrelated.txt`)).toBe(true);
});

it("does not claim a durable intent if filesystem creation fails", async () => {
  state.failCreate = true;
  await expect(externalDeletionMarkers.write("owner-a")).rejects.toThrow(
    "Disk unavailable",
  );
  expect(state.files.size).toBe(0);
});

it.each(["%broken.pending", "%6Fwner-a.pending", ".pending"])(
  "ignores an unknown marker filename without blocking valid owners: %s",
  async (name) => {
    await externalDeletionMarkers.write("owner-a");
    state.files.add(`${folder}/${name}`);
    expect(await externalDeletionMarkers.list()).toEqual(["owner-a"]);
    expect(
      state.files.has(`${folder}/006f0077006e00650072002d0061.pending`),
    ).toBe(true);
  },
);

it("round trips a supplementary character and a lone UTF-16 surrogate without URI decoding", async () => {
  const owner = "a🌱\ud800%/";
  await externalDeletionMarkers.write(owner);
  expect(await externalDeletionMarkers.list()).toEqual([owner]);
  await externalDeletionMarkers.remove(owner);
  expect(state.files.size).toBe(0);
});

it("rejects a silently failed native create before acknowledging intent", async () => {
  state.noopCreate = true;
  await expect(externalDeletionMarkers.write("owner")).rejects.toBeDefined();
  expect(state.files.size).toBe(0);
});
it("does not interpret inaccessible marker directory as no pending owners", async () => {
  await externalDeletionMarkers.write("owner");
  state.inaccessible = true;
  await expect(externalDeletionMarkers.list()).rejects.toThrow(
    "Marker directory inaccessible",
  );
  await expect(externalDeletionMarkers.remove("owner")).rejects.toThrow(
    "Marker directory inaccessible",
  );
  expect(state.files.size).toBe(1);
});
it("does not acknowledge silent marker removal failure", async () => {
  await externalDeletionMarkers.write("owner");
  state.noopDelete = true;
  await expect(externalDeletionMarkers.remove("owner")).rejects.toBeDefined();
  expect(await externalDeletionMarkers.list()).toEqual(["owner"]);
  state.noopDelete = false;
  await externalDeletionMarkers.remove("owner");
  expect(await externalDeletionMarkers.list()).toEqual([]);
});
