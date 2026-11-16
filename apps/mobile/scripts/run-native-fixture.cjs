#!/usr/bin/env node
/* global __dirname */
// Local synthetic PKCE issuer/API. Never attaches to a pre-existing service.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const {
  fixtureOptions,
  fixturePorts,
  validateResumeDirectory,
} = require("./native-fixture-safety.cjs");
const options = fixtureOptions(process.argv.slice(2));
const ports = fixturePorts(process.env);
const apiBase = `http://127.0.0.1:${ports.api}`;
const loginBase = `http://127.0.0.1:${ports.login}`;
const backend = process.env.MOBILE_E2E_BACKEND;
if (!backend || !fs.existsSync(path.join(backend, "manage.py"))) {
  throw new Error("Set MOBILE_E2E_BACKEND and MOBILE_E2E_PYTHON explicitly.");
}
const python = process.env.MOBILE_E2E_PYTHON;
if (!python) throw new Error("MOBILE_E2E_PYTHON is required.");
const directory = options.resume
  ? validateResumeDirectory(options.resume)
  : fs.mkdtempSync(path.join(os.tmpdir(), "testownik-oauth-e2e-"));
if (!options.resume)
  fs.writeFileSync(path.join(directory, ".disposable-mobile-e2e"), "", {
    mode: 0o600,
  });
const env = {
  ...process.env,
  MOBILE_E2E_BACKEND: path.resolve(backend),
  MOBILE_E2E_DB: path.join(directory, "db.sqlite3"),
  MOBILE_E2E_API_PORT: String(ports.api),
  MOBILE_E2E_LOGIN_PORT: String(ports.login),
};
const fixture = path.join(__dirname, "e2e-native-fixture.py");
const servers = [];
const logs = [];
let stop;
const stopping = new Promise((resolve) => {
  stop = resolve;
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, stop);

async function main() {
  try {
    for (const port of [ports.api, ports.login]) {
      await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", reject);
        probe.listen(port, "127.0.0.1", () => probe.close(resolve));
      });
    }
    if (!options.resume) {
      const init = spawnSync(python, [fixture, "init"], {
        env,
        stdio: "inherit",
      });
      if (init.status !== 0)
        throw new Error("Native fixture initialization failed");
    }
    for (const command of ["api", "login"]) {
      const fd = fs.openSync(
        path.join(directory, `${command}.log`),
        "w",
        0o600,
      );
      logs.push(fd);
      const child = spawn(python, [fixture, command], {
        env,
        stdio: ["ignore", fd, fd],
      });
      servers.push({
        child,
        exited: new Promise((resolve) => {
          child.once("exit", resolve);
          child.once("error", resolve);
        }),
      });
      child.once("error", stop);
      child.once("exit", stop);
    }
    for (const [port, route] of [
      [ports.api, "/api/user/"],
      [ports.login, "/"],
    ]) {
      let ready = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        if (servers.some(({ child }) => child.exitCode !== null))
          throw new Error("Native fixture exited before readiness");
        try {
          await fetch(`http://127.0.0.1:${port}${route}`, {
            signal: AbortSignal.timeout(1000),
          });
          ready = true;
          break;
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
      if (!ready) throw new Error("Native fixture readiness timed out");
    }
    if (options.verify) {
      const control = `${apiBase}/__native_qa_control`;
      const before = await fetch(control);
      assert.equal(before.status, 200);
      const safeStatus = await before.json();
      assert.equal(safeStatus.mode, "compose-503");
      assert.equal(safeStatus.block_delivery, true);
      assert.equal(safeStatus.catalog, "pass");
      assert.equal(safeStatus.catalog_waiting, 0);
      for (const route of ["feedback/send", "report-question-issue/"]) {
        const failure = await fetch(`${apiBase}/api/${route}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        assert.equal(
          failure.status,
          503,
          "Compose must never reach delivery in this fixture",
        );
      }
      const counts = await (await fetch(control)).json();
      assert.equal(counts.intercepted.feedback, 1);
      assert.equal(counts.intercepted.report, 1);
      assert.equal(counts.catalog, "pass");
      assert.equal(counts.catalog_waiting, 0);
      assert.equal(
        (
          await fetch(control, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "reset" }),
          })
        ).status,
        200,
      );
      const verifier = crypto.randomBytes(32).toString("hex");
      const state = crypto.randomUUID();
      const params = new URLSearchParams({
        client_id: "testownik-mobile",
        redirect_uri: "testownik://auth",
        response_type: "code",
        code_challenge_method: "S256",
        state,
        code_challenge: crypto
          .createHash("sha256")
          .update(verifier)
          .digest("base64url"),
        scope:
          "quizzes:read quizzes:write study:read study:write user:read user:write grades:read notifications:read notifications:write feedback:write ai:read ai:write web:read",
      });
      const missingScope = new URLSearchParams(params);
      missingScope.delete("scope");
      assert.equal(
        (
          await fetch(`${loginBase}/oauth/authorize?${missingScope}`, {
            redirect: "manual",
          })
        ).status,
        404,
      );
      const consent = await fetch(`${loginBase}/oauth/authorize?${params}`, {
        redirect: "manual",
      });
      assert.equal(consent.status, 302, "Synthetic consent failed");
      const callback = new URL(consent.headers.get("location"));
      assert.equal(callback.protocol, "testownik:");
      assert.equal(callback.searchParams.get("state"), state);
      const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: "testownik-mobile",
        redirect_uri: "testownik://auth",
        code: callback.searchParams.get("code"),
        code_verifier: verifier,
      });
      const exchange = await fetch(`${apiBase}/api/oauth/token/`, {
        method: "POST",
        body,
      });
      assert.equal(exchange.status, 200, "PKCE exchange failed");
      const tokens = await exchange.json();
      assert.equal(tokens.token_type.toLowerCase(), "bearer");
      const profile = await fetch(`${apiBase}/api/user/`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      assert.equal(profile.status, 200);
      assert.equal((await profile.json()).full_name, "Disposable Native QA");
      assert.equal(
        (
          await fetch(`${apiBase}/api/oauth/token/`, {
            method: "POST",
            body,
          })
        ).status,
        400,
        "An authorization code must be single use",
      );
      console.log(
        "Native fixture verified: local consent, PKCE exchange, synthetic profile, single-use code and scope rejection.",
      );
    } else {
      console.log(
        `Synthetic native QA ready. Build with API ${apiBase}/api and WEB ${loginBase}; use a fresh simulator. Stop with Ctrl-C.`,
      );
      await stopping;
    }
  } finally {
    for (const { child } of servers) child.kill("SIGTERM");
    await Promise.all(servers.map(({ exited }) => exited));
    logs.forEach((fd) => fs.closeSync(fd));
    // A resumed DB belongs to the caller and must survive startup failure/restart.
    if (!options.resume) fs.rmSync(directory, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
