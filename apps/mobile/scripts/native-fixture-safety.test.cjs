const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  fixtureOptions,
  fixturePorts,
  validateResumeDirectory,
} = require("./native-fixture-safety.cjs");

function directory(t, prefix = "testownik-oauth-e2e-") {
  const result = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(result, { recursive: true, force: true }));
  return result;
}
function fixture(t) {
  const result = directory(t);
  fs.writeFileSync(path.join(result, ".disposable-mobile-e2e"), "", {
    mode: 0o600,
  });
  fs.writeFileSync(
    path.join(result, "db.sqlite3"),
    "SQLite format 3\0fixture",
    { mode: 0o600 },
  );
  return result;
}

test("resume accepts only an existing explicit disposable SQLite fixture", (t) => {
  const result = fixture(t);
  assert.equal(validateResumeDirectory(result), fs.realpathSync(result));
  assert.equal(
    fs.readFileSync(path.join(result, "db.sqlite3"), "utf8"),
    "SQLite format 3\0fixture",
  );
});
test("missing sentinel, wrong directory prefix and arbitrary bytes are rejected", (t) => {
  const result = fixture(t);
  fs.unlinkSync(path.join(result, ".disposable-mobile-e2e"));
  assert.throws(() => validateResumeDirectory(result));
  assert.throws(() =>
    validateResumeDirectory(directory(t, "unrelated-native-")),
  );
  fs.writeFileSync(path.join(result, ".disposable-mobile-e2e"), "");
  fs.writeFileSync(path.join(result, "db.sqlite3"), "not a SQLite DB");
  assert.throws(() => validateResumeDirectory(result));
});
test("symlinked directory, database and sentinel cannot be resumed", (t) => {
  const result = fixture(t),
    other = fixture(t),
    linkParent = directory(t);
  const link = path.join(linkParent, "fixture");
  fs.symlinkSync(result, link);
  assert.throws(() => validateResumeDirectory(link));
  for (const name of ["db.sqlite3", ".disposable-mobile-e2e"]) {
    fs.unlinkSync(path.join(result, name));
    fs.symlinkSync(path.join(other, name), path.join(result, name));
    assert.throws(() => validateResumeDirectory(result));
    fs.unlinkSync(path.join(result, name));
    fs.copyFileSync(path.join(other, name), path.join(result, name));
  }
});
test("option parser supports verified resume and rejects ambiguous flags", () => {
  assert.deepEqual(fixtureOptions([]), { verify: false, resume: undefined });
  assert.deepEqual(fixtureOptions(["--resume", "/fixture", "--verify"]), {
    verify: true,
    resume: "/fixture",
  });
  for (const argv of [
    ["--resume"],
    ["--resume", "--verify"],
    ["--other"],
    ["--verify", "--verify"],
    ["--resume", "/one", "--resume", "/two"],
  ])
    assert.throws(() => fixtureOptions(argv));
});

test("isolated loopback port overrides preserve defaults and reject invalid ports", () => {
  assert.deepEqual(fixturePorts({}), { api: 8768, login: 8769 });
  assert.deepEqual(
    fixturePorts({
      MOBILE_E2E_API_PORT: "8798",
      MOBILE_E2E_LOGIN_PORT: "8799",
    }),
    { api: 8798, login: 8799 },
  );
  for (const value of ["", "0", "443", "65536", "1.5", "8798 extra", " 8798"])
    assert.throws(() => fixturePorts({ MOBILE_E2E_API_PORT: value }));
  assert.throws(() => fixturePorts({ MOBILE_E2E_API_PORT: "8769" }));
});
