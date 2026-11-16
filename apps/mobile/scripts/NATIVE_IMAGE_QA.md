# Native image cache QA (synthetic fixture only)

This runbook checks native downloaded bytes, image display after an API/media outage and relaunch, and cleanup when the final saved reference is removed. It simulates unavailable API/media with HTTP 503; it does not prove physical-device airplane-mode behavior. The independent rehearsal is automated; actual simulator phases belong to the native QA runner.

## Safety and preparation

Wait for the owner of the active native run to release the fixture. Never seed or restart during another native flow. The seed accepts only the existing sentinel-marked temporary SQLite fixture and permanent `native-qa@example.invalid` user. It adds two fixed-ID owned quizzes and two deterministic PNGs. Existing mismatched IDs, edited content, changed ownership or changed image bytes cause refusal; nothing is overwritten. No migration, account deletion, answer submission, email, report or paid AI request is needed.

The Compose routes are permanently blocked, independently of network mode. `GET http://127.0.0.1:8768/__native_qa_control` must include `mode:"compose-503"` and `block_delivery:true` before any native Send action.

Independent rehearsal (creates and removes its own 8798/8799 fixture):

```sh
MOBILE_E2E_BACKEND=/Users/antoniczaplicki/projects/testownik/worktrees/testownik-mobile-core \
MOBILE_E2E_PYTHON=/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python \
/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python scripts/verify-native-image-fixture.py
```

After explicit fixture release, seed the preserved current synthetic DB:

```sh
MOBILE_E2E_BACKEND=/Users/antoniczaplicki/projects/testownik/worktrees/testownik-mobile-core \
MOBILE_E2E_DB=/var/folders/hb/06n4wrj5227c9w0lzlp39kpw0000gn/T/testownik-oauth-e2e-ceqh5tlk/db.sqlite3 \
MOBILE_E2E_API_PORT=8768 \
/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python scripts/e2e-native-fixture.py seed-images \
> .local/overnight-2026-10-11/native-image-fixture-live.json
```

A later coordinated restart is required to load the new network control. Stop only the currently identified `run-native-fixture.cjs --resume` process; resume the same directory without initialization:

```sh
MOBILE_E2E_BACKEND=/Users/antoniczaplicki/projects/testownik/worktrees/testownik-mobile-core \
MOBILE_E2E_PYTHON=/Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python \
node scripts/run-native-fixture.cjs --resume /var/folders/hb/06n4wrj5227c9w0lzlp39kpw0000gn/T/testownik-oauth-e2e-ceqh5tlk
```

The resumed directory survives stop. Preserve its existing tokens, quizzes and media. Do not run `init` against it.

## Fixed fixture IDs

| Item                                 | ID                                                                          |
| ------------------------------------ | --------------------------------------------------------------------------- |
| Native QA Image Cache A              | e121bd54-80ab-4dce-8b4b-5aa4d1aa0001                                        |
| Native QA Image Cache B              | e121bd54-80ab-4dce-8b4b-5aa4d1aa0002                                        |
| A question                           | e121bd54-80ab-4dce-8b4b-5aa4d1aa0011                                        |
| B question                           | e121bd54-80ab-4dce-8b4b-5aa4d1aa0012                                        |
| A correct answer (with unique image) | e121bd54-80ab-4dce-8b4b-5aa4d1aa0021                                        |
| A other answer                       | e121bd54-80ab-4dce-8b4b-5aa4d1aa0022                                        |
| B answers                            | e121bd54-80ab-4dce-8b4b-5aa4d1aa0023 / e121bd54-80ab-4dce-8b4b-5aa4d1aa0024 |

A uses a shared red/cyan question image and a unique yellow/black/green answer image. Its Markdown text also embeds the unique PNG. B uses only the shared question image. Both PNGs are 256×144 RGB, with no personal metadata.

At API 8768, the exact trusted URLs and filesystem keys are:

- Shared URL: `http://127.0.0.1:8768/media/native-qa/image-cache-e121bd54-80ab-4dce-8b4b-5aa4d1aa0031.png`
- Shared cache file: `fbffa09800f0e7ef20137fee6bafcfa9eb5ba4821ead267be0596f1be7c03c44.png`
- Shared byte SHA256: `f14f677fc9b6dce6f451e01d2cd2f4f0dbc989c9e000847c21b938a25cce208e`
- Unique URL: `http://127.0.0.1:8768/media/native-qa/image-cache-e121bd54-80ab-4dce-8b4b-5aa4d1aa0032.png`
- Unique cache file: `8fa052c92022855f7d2f3947251c9b5ababe8bf882ea1c59f129357fbc4c6da3.png`
- Unique byte SHA256: `fb692a686deb5571ff195add84a1118c985f30fd6d2505b60cb950ee35e386a5`

Keys use SHA256 of exact URL UTF16BE code units, plus `.png`. This seed is for an iOS simulator build whose API URL uses `127.0.0.1:8768`. Different ports or hosts produce different keys. The generated JSON manifest records actual values; the independent HTTP proof compares authenticated serializer URLs and served bytes to it.

## Native phases and host checks

1. Confirm synthetic identity and control safety. Open A and B from Library without answering questions. Capture online question image, Markdown image, and A's answer image. Wait for both downloaded files.
2. Obtain only the selected simulator's app data container:

   ```sh
   xcrun simctl get_app_container SIMULATOR_UUID pl.solvro.testownik data
   ```

   Use its `Documents` directory with the read-only checker:

   ```sh
   /Users/antoniczaplicki/projects/testownik/testownik_core/.venv/bin/python scripts/check-native-image-cache.py --documents APP_DATA_CONTAINER/Documents --phase downloaded
   ```

   It requires exact PNG bytes and no matching partial files. It reads only the two known image keys; it never removes files or inspects session/OAuth storage.

3. Terminate the app. Reset counters, then set unavailable transport:

   ```sh
   curl --fail --silent --show-error -H 'Content-Type: application/json' --data '{"mode":"reset"}' http://127.0.0.1:8768/__native_qa_control
   curl --fail --silent --show-error -H 'Content-Type: application/json' --data '{"network":"offline"}' http://127.0.0.1:8768/__native_qa_control
   ```

   `reset` clears counters and preserves network state. Only explicit `network:"online"` restores availability. Always restore it in native test teardown. All controls reject Origin/Referer and nonloopback callers.

4. Relaunch and open A from Saved Offline (Home/Library network queries may show recovery states). Require the saved-copy refresh notice, visible question image with no Reload placeholder, visible distinctive Markdown/answer pixels and screenshot. The correct-answer accessibility ID is `study-answer-e121bd54-80ab-4dce-8b4b-5aa4d1aa0021`; the answer's enclosing button can hide the image's separate AX element.
5. Verify the host byte check still passes and examine control counters. `blocked_requests>0` shows the app encountered the outage. `media_requests:0` after reset is strong evidence that the relaunch used downloaded media rather than requesting remote media.
6. While API/media remain unavailable, remove A only through Saved Offline's local Remove action. Do not use the Study menu's Remove Local Copy, which refetches and can recache when online. Poll checker `--phase a-removed`: unique bytes gone, shared bytes retained for B. Verify B remains usable.
7. Remove B from Saved Offline. Poll `--phase all-removed`: both target files gone and no corresponding partial files. Other app files remain untouched. Server quizzes remain; this is local cache removal.
8. Restore availability:

   ```sh
   curl --fail --silent --show-error -H 'Content-Type: application/json' --data '{"network":"online"}' http://127.0.0.1:8768/__native_qa_control
   ```

### Secondary cache limit

Expo Image and WKWebView may retain their own remote caches. Relaunch is mandatory so RichText recomputes inline downloaded image data. To exclude secondary caches completely, the native runner may additionally clear only the synthetic simulator app's regenerable image/WebView cache while terminated, after an explicit owner-approved scope. This runbook does not delete `Library/Caches` or other application data automatically. Record whether this extra check was performed; do not claim it if omitted.

Proposed reversible host procedure, requiring the native owner's approval:

1. Confirm the selected simulator UUID, installed bundle `pl.solvro.testownik`, synthetic `native-qa@example.invalid` identity, and successful `downloaded` byte check. Terminate that app.
2. Resolve the exact app data container using the command above. Refuse symlinks or a path outside `~/Library/Developer/CoreSimulator/Devices/<selected UUID>/data/Containers/Data/Application/<container UUID>`. Verify simulator container metadata identifies the expected bundle.
3. Quarantine only that container's `Library/Caches` into a newly created sentinel-marked QA temporary directory outside the app container, preserving its mode when recreating the empty directory. This is reversible and leaves app Documents, Preferences, Application Support and keychain untouched.
4. Inspect `Library/WebKit/WebsiteData` before any extra move. If present, quarantine only verified `NetworkCache` or `CacheStorage` directories beneath it. Never move all of WebKit, cookies, LocalStorage or IndexedDB. If no verified cache directory exists, record that limitation.
5. Repeat the `downloaded` checker before relaunch to prove both app-managed PNGs remain exact. Relaunch under the fixture outage and capture pixels, image/error accessibility and request counters. Keep the quarantined data until the native owner decides it is no longer needed.

Source selectors: Home's native Saved Offline button remains available when the recent API request fails. Its label may include the numeric saved count. Saved rows combine their quiz title with `1 question`, so use a title-prefix match. Swipe the target row left and tap its `Remove` action; full-swipe deletion is disabled. The question image has label `Question image`; its failed replacement has button label `Reload: Question image`. Markdown has no dedicated test ID, so its distinct pixels must be verified in the captured WebView region.
