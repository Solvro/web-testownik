const fs = require("node:fs");
const { Buffer } = require("node:buffer");
const os = require("node:os");
const path = require("node:path");

function fixtureOptions(argv) {
  const result = { verify: false, resume: undefined };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === "--verify" && !result.verify) result.verify = true;
    else if (
      argv[index] === "--resume" &&
      !result.resume &&
      argv[index + 1] &&
      !argv[index + 1].startsWith("--")
    )
      result.resume = argv[++index];
    else
      throw new Error("Use --verify and/or --resume <disposable directory>.");
  }
  return result;
}

function validateResumeDirectory(candidate) {
  const requested = path.resolve(candidate);
  if (fs.lstatSync(requested).isSymbolicLink())
    throw new Error("Symlinked fixture directory is not allowed.");
  const directory = fs.realpathSync(requested);
  if (
    path.dirname(directory) !== fs.realpathSync(os.tmpdir()) ||
    !path.basename(directory).startsWith("testownik-oauth-e2e-")
  )
    throw new Error("A disposable native fixture directory is required.");
  const sentinel = path.join(directory, ".disposable-mobile-e2e");
  const database = path.join(directory, "db.sqlite3");
  for (const file of [sentinel, database]) {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error("A regular fixture sentinel and database are required.");
  }
  const fd = fs.openSync(database, "r");
  try {
    const header = Buffer.alloc(16);
    if (
      fs.readSync(fd, header, 0, 16, 0) !== 16 ||
      header.toString() !== "SQLite format 3\0"
    )
      throw new Error("A SQLite fixture database is required.");
  } finally {
    fs.closeSync(fd);
  }
  return directory;
}
function fixturePorts(env) {
  function port(value, fallback) {
    if (value === undefined) return fallback;
    if (
      !/^[1-9]\d*$/.test(value) ||
      Number(value) < 1024 ||
      Number(value) > 65535
    )
      throw new Error(
        "Native fixture ports must be unprivileged numeric ports.",
      );
    return Number(value);
  }
  const result = {
    api: port(env.MOBILE_E2E_API_PORT, 8768),
    login: port(env.MOBILE_E2E_LOGIN_PORT, 8769),
  };
  if (result.api === result.login)
    throw new Error("Native fixture ports must differ.");
  return result;
}
module.exports = { fixtureOptions, validateResumeDirectory, fixturePorts };
