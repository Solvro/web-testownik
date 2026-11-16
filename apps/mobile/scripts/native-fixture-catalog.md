# Disposable native model catalog delay

This fixture control holds only `GET /api/ai/models/`. It does not call an AI provider. The existing feedback/report POST guards always return 503. All other API/media requests keep their normal fixture behavior, including the global offline switch.

## Install and restart (root owns execution)

The patch changes Python/Node fixture scripts only. It needs no package install or mobile rebuild. An already running fixture uses `use_reloader=False` and keeps its old code until restarted. No server restart, database change or live control call was performed while preparing this patch.

1. Record the existing owned runner, ports and validated disposable `--resume` directory. Confirm the current runner was started in resume mode before stopping: a fresh non-resumed runner deletes its temporary directory on exit. Preserve existing fixture logs privately because restart opens them with truncation. Stop only the owned runner after its current native checks finish.
2. Reuse that exact directory and existing backend/Python/port configuration. Do not create another database, run `init`/`seed-images`, remove credentials or clear the app cache. For this checkout, the usual command is:

   ```sh
   MOBILE_E2E_BACKEND=/Users/antoniczaplicki/projects/testownik/worktrees/testownik-mobile-core \
   MOBILE_E2E_PYTHON=/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python \
   node scripts/run-native-fixture.cjs --resume "$TESTOWNIK_QA_RESUME_DIR"
   ```

   `TESTOWNIK_QA_RESUME_DIR` must be the existing validated directory recorded by root, not a newly invented path. Preserve any existing port overrides. The runner still rejects occupied ports and invalid/symlinked resume paths. Do not add `--verify` for an unchanged-record restart: that mode performs a synthetic PKCE authorization and creates a grant in the fixture DB.

3. After readiness, read the control endpoint below and require `mode:"compose-503"`, `block_delivery:true`, `catalog:"pass"`, `catalog_waiting:0`. Keep the previous network setting unless the native test explicitly needs online transport. The API server is explicitly threaded, single process, with the reloader disabled, so a release request can reach the same middleware instance while another request waits.

## Host control API

The endpoint is loopback-only and rejects Origin/Referer, non-JSON POST, oversized/malformed JSON, duplicate keys, unsupported values and mixed control keys. There are no CORS or provider controls.

```sh
# Status only. No tokens or request bodies are returned.
curl -fsS --max-time 3 http://127.0.0.1:8768/__native_qa_control

# Hold the catalog for an absolute 20-second lease.
curl -fsS --max-time 3 -H 'Content-Type: application/json' \
  --data '{"catalog":"hold"}' http://127.0.0.1:8768/__native_qa_control

# Release the current generation; harmless if it already expired/released.
curl -fsS --max-time 3 -H 'Content-Type: application/json' \
  --data '{"catalog":"release"}' http://127.0.0.1:8768/__native_qa_control
```

- A repeated hold during an active lease is a no-op. It does not replace the event, increment the generation or extend the deadline.
- Waiters receive only the remaining lease. Lease expiry sets catalog back to pass; already parked requests get 503 and are never forwarded late. A hold with no waiter is also expired on the next control/catalog interaction.
- Release wakes only its captured generation. A later hold cannot recapture the earlier released requests.
- Offline is checked before waiting and again on release. A request held while the network is switched offline gets 503 without reaching Django.
- Held responses and timeout/offline responses have `Cache-Control:no-store`.
- Existing `{"mode":"reset"}` clears only original compose/media/blocked counters. It neither releases a hold, changes connectivity nor resets catalog counters/gauges.

Status adds these fields:

| Field                  | Meaning                                                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `catalog`              | Current effective `pass` or `hold` state                                                                   |
| `catalog_generation`   | Monotonic number of newly created holds                                                                    |
| `catalog_remaining_ms` | Remaining active lease, or 0                                                                               |
| `catalog_started`      | Lifetime number of catalog requests admitted to a hold                                                     |
| `catalog_waiting`      | Live number of parked requests, including an old generation still settling                                 |
| `catalog_released`     | Lifetime held requests awakened by release, including an offline rejection after release                   |
| `catalog_completed`    | Lifetime released requests for which downstream returned a response; not a client receipt or 2xx assertion |
| `catalog_timed_out`    | Lifetime held requests rejected after lease expiry                                                         |

Use counter deltas for each native test. A completed response can be 401/500; require the native resolved model row as well as the counters before calling the loading check successful. The fields never expose credentials, headers, request text or OAuth callbacks.

## Native loading → Close → late completion check

Root owns this test and any native actions. Persist the synthetic unsent Assistant draft before beginning the lease. Cold relaunch clears in-memory query state while retaining that draft and credentials. Hold immediately before the cold Assistant mount because Assistant itself prefetches the catalog.

Require one live waiter and no timeout delta. Allow local quiz override/account settings to resolve, open the model picker, verify its loading state and native Close (Android uses Back), then close it. Require exact retained draft and Assistant navigation. Before host release, require `catalog_waiting:1` and no timeout delta; release and observe deltas `released:+1`, `completed:+1`, `waiting:0`, `timed_out:+0`. Require the final model row resolves, while selection/override, draft and navigation remain unchanged and no overlay returns. The display label may legitimately change from loading to the resolved model name. Do not Send; this check needs no completion/AI request.

If the lease expires, more than one waiter appears, no waiter appears (cached catalog), local settings stay pending, or authentication causes unexpected retries, preserve evidence and mark the setup inconclusive. Do not claim catalog loading from a spinner alone. In finally, release any remaining catalog hold and restore only the original network setting; require catalog pass/waiting 0. A 20-second lease is fixed and cannot be extended by repeated hold.

## Offline contract checks (safe to run without services/DB)

From `apps/mobile`:

```sh
/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python \
  -m unittest discover -s scripts -p 'test_native_fixture_*.py'
node --test scripts/native-fixture-safety.test.cjs
node --check scripts/run-native-fixture.cjs
```

The Python checks configure only minimal Django response settings, use mock downstream handlers and deterministic clocks/events, and do not start Django, open a database, contact 8768/8769 or mutate live controls. Native loading/Close behavior remains separate runtime evidence.
