#!/usr/bin/env node
/* global __dirname */
// Isolated backend for mutation coverage. The simulator and its Metro configuration stay unchanged.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const backend = process.env.MOBILE_E2E_BACKEND;
if (!backend || !fs.existsSync(path.join(backend, "manage.py"))) {
  throw new Error(
    "Set MOBILE_E2E_BACKEND to the backend checkout and MOBILE_E2E_PYTHON to its Python interpreter.",
  );
}
const python = process.env.MOBILE_E2E_PYTHON || "python3";
const directory = fs.mkdtempSync(
  path.join(os.tmpdir(), "testownik-oauth-e2e-"),
);
fs.writeFileSync(path.join(directory, ".disposable-mobile-e2e"), "", {
  mode: 0o600,
});
const env = {
  ...process.env,
  MOBILE_E2E_BACKEND: path.resolve(backend),
  MOBILE_E2E_DB: path.join(directory, "db.sqlite3"),
};
const script = path.join(__dirname, "e2e-oauth-fixture.py");
let server, runner;
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    interrupted = true;
    runner?.kill(signal);
    server?.kill(signal);
  });
async function main() {
  // Fail rather than silently sending fixture writes to an existing service.
  const net = require("node:net");
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(8768, "127.0.0.1", () => probe.close(resolve));
  });
  const migration = spawnSync(python, [script, "migrate"], {
    env,
    stdio: "inherit",
  });
  if (migration.status !== 0)
    throw new Error("Fixture database initialization failed");
  const log = fs.openSync(path.join(directory, "api.log"), "w", 0o600);
  server = spawn(python, [script, "serve"], {
    env,
    stdio: ["ignore", log, log],
  });
  const stopped = new Promise((resolve) => server.once("exit", resolve));
  try {
    let ready = false;
    for (let i = 0; i < 100 && !interrupted; i++) {
      if (server.exitCode !== null)
        throw new Error("Fixture API exited before becoming ready");
      try {
        await fetch("http://127.0.0.1:8768/api/user/");
        ready = true;
        break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error("Fixture API did not become ready");
    const args = process.argv.slice(2);
    runner = spawn(
      "pnpm",
      [
        "exec",
        "playwright",
        "test",
        ...(args.length ? args : ["e2e/mobile.spec.ts"]),
      ],
      { env, stdio: "inherit" },
    );
    process.exitCode = await new Promise((resolve) => {
      runner.once("error", () => resolve(1));
      runner.once("exit", (code) => resolve(code ?? 1));
    });
  } finally {
    server.kill("SIGTERM");
    await stopped;
    fs.closeSync(log);
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    // This path was created by this process; never remove a supplied database.
    fs.rmSync(directory, { recursive: true, force: true });
  });
