# Testownik mobile

Native Android UI regression tests use AndroidX UI Automator. After generating the native project, run `node scripts/install-android-ui-tests.cjs`, then `cd android && ./gradlew :app:assembleDebugAndroidTest`. Install the test APK and run `adb shell am instrument -w -e disposableFixture true -e class pl.solvro.testownik.NativeFlows pl.solvro.testownik.test/androidx.test.runner.AndroidJUnitRunner` against a development build with Metro and the disposable local API. Tests capture screenshots and hierarchies under the app's external `files/native-tests` directory. They do not clear app data or sign out existing accounts. They suppress the development-only Tools overlay during tests; system appearance and font size are restored after each test. Without the explicit disposable-fixture flag, regression tests skip before launching the app.

React Native and Expo share domain logic with the web app through `../../packages/core`. Android controls use Jetpack Compose Material 3 through `@expo/ui`; iOS uses SwiftUI controls, UIKit text entry and system navigation. The browser target is a development and regression-test preview; its controls are fallbacks, not the native app.

## Run locally

Use Node 22.13 or newer and the pnpm version declared in the root `package.json`, Android Studio with an emulator, and JDK 17. iOS requires full Xcode with the matching SDK and simulator runtime. Command Line Tools alone cannot build the iOS app.

```sh
cd apps/mobile
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm android
# On a Mac with Xcode:
pnpm ios
```

Set `EXPO_PUBLIC_API_URL` to the Django origin **including `/api`**, and `EXPO_PUBLIC_WEB_URL` to the Next.js origin. These values are public and bundled into the app. Never put signing keys, provider secrets, or backend API keys in them. Android emulators reach the host at `10.0.2.2`; real devices need a reachable LAN or HTTPS host. Expo Go cannot load the native UI modules: use the development build.

For local iOS OAuth, use the same hostname for the web page and browser-facing API: for example `http://localhost:3000` and `http://localhost:8765/api`. Set Django `FRONTEND_URL=http://localhost:3000`, `BACKEND_URL=http://localhost:8765`, and `OAUTH_ISSUER_URL=http://localhost:8765`, and Next.js `NEXT_PUBLIC_API_URL=http://localhost:8765/api`. Do not mix `localhost` with `127.0.0.1` in this browser flow: the provider callback sets host-scoped login cookies, and the authorization page must receive them. Restart Next.js after changing its public environment variables.

Stage the companion backend and apply its forward migrations through `mobile_api/0003_quiz_create_receipt` before routing requests to the new mobile endpoints or distributing this client. Migration 0003 adds the receipt table required for recoverable quiz creation and imports by both guest and permanent accounts using first-party OAuth. Deploy the receipt endpoint, scope allowlist, and atomic `expected_version` conflict checks together, then run `register_mobile_oauth` before the first mobile authorization. All 13 requested scopes match the paired backend source; deployed registration and scopes have not been verified. The web companion validates opaque OAuth credentials through the backend for AI; embedded statistics and Wrapped require the shared JWT verification configuration and `/auth/mobile` cookie exchange.

Retain receipts while active accounts may have pending local create journals; those journals have no expiry. After distributing this client, preserve the receipt endpoint and atomic version checks on backend rollback. Reversing migration 0003 or pruning outstanding receipts can cause duplicate creates, and older backend code does not enforce the current mobile conflict checks. Account deletion still removes its receipts; guest upgrade does not adopt receipts across identities.

### Existing local data

For simulator testing with your existing accounts and quizzes, start Django with
`DJANGO_SETTINGS_MODULE=mobile_api.local_settings` and set `MOBILE_LOCAL_DB` to the
absolute path of the existing SQLite database. This settings module refuses a
missing path instead of creating an empty database. It uses the database's
adjacent `media` directory and captures email in memory. Back up the database
before applying the mobile migrations, and keep credentials in your local
environment. Both simulators should point at this same API; Android can use
`adb reverse tcp:8765 tcp:8765` for the host's loopback address.

Use the interactive native USOS tests for real-account sign-in. On Android, run
the instrumentation command with `-e manualUSOS true -e class
pl.solvro.testownik.NativeFlows#manualUSOSSignIn`. On iOS, set
`TESTOWNIK_MANUAL_USOS=1` in the test runner's environment and select only
`NativeFlows/testManualUSOSSignIn`. Complete provider credentials yourself in the
simulator's system browser. These tests preserve existing accounts and do not
create sample quizzes. Broad regression tests belong on a separate disposable
database and simulator session.

To verify an already signed-in account without creating fixtures, select only
`NativeFlows#authenticatedAccountNavigation` with `-e realAccount true` on Android,
or `NativeFlows/testAuthenticatedAccountNavigation` with
`TESTOWNIK_REAL_ACCOUNT=1` in the iOS test runner. These checks inspect the native
profile and library; the iOS check also verifies sign-in survives a relaunch.

## Authentication and offline study

Mobile targets everyday user workflows. AI administration, including admin usage
reports and account-limit management, remains web-only. Personal AI preferences,
study hints, and the assistant remain part of the mobile app.

- Access and refresh tokens live in SecureStore on devices. The web preview uses sessionStorage.
- Mobile uses the existing Testownik OAuth authorization server with authorization-code PKCE, state validation, rotating refresh tokens, and revocation. Register the public client with `python manage.py register_mobile_oauth`. The existing web login handles USOS and email; the app returns through `testownik://auth`. Provider secrets remain on the backend.
- Email authentication stays in the existing web login. Tests use a disposable database and in-memory mail backend.
- Downloaded quiz text, math, sessions, and pending answers persist per account. Answer receipts make retries idempotent. Remote images still need a connection when first loaded.
- Logout removes credentials and retains account-scoped local study data for a later sign-in. Explicit account deletion also clears that owner’s downloads, pending answers, chats and editor drafts. Failed device cleanup can be retried and resumes on relaunch. A guest cannot recover the account after logout.
- Hints, explanations and the assistant resolve the selected quiz model first, then the account’s Study Settings, then the server default. Changing a quiz override leaves account preferences unchanged.
- Statistics and Wrapped use the existing web pages inside isolated WebViews. A separate 30-minute access token is sent in an authorization header to `/auth/mobile`; it becomes an HTTP-only cookie. No login token is put in a URL, and the app refresh token is never shared with the WebView.

## Checks

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm export
pnpm dlx expo-doctor
```

The integration suite uses a temporary SQLite database and a fresh opaque OAuth account for each test. The runner starts its API on loopback port 8768 and redirects browser API requests there; it leaves the signed-in simulator and its populated local database unchanged. Keep the browser preview running (normally Metro on 8081), then run:

```sh
MOBILE_E2E_BACKEND=/absolute/path/to/testownik_core \
MOBILE_E2E_PYTHON=/absolute/path/to/backend/.venv/bin/python \
MOBILE_E2E_BASE_URL=http://localhost:8081 \
pnpm test:e2e:integration e2e/*.spec.ts
```

The runner refuses an occupied test API port and removes its own temporary database/media after the run. It never accepts personal session files. OAuth tokens are seeded for REST regression coverage; this does not replace the separate real USOS/PKCE sign-in checks. Assistant responses are mocked, and embedded report rendering is checked separately in native tests. Plain `pnpm test:e2e` runs mock-based coverage and explicitly skips the mutation suite unless its isolated fixture environment is configured.

Pass individual spec paths for a focused run. With no spec arguments, the integration runner runs only `e2e/mobile.spec.ts`; use the wildcard above for the complete browser suite.

Native verification must also cover system menus, inputs, tabs, keyboard handling, large text, dark mode, and the Wrapped WebView. Passing browser tests does not establish iOS behavior.

The native iOS smoke test uses XCTest and the installed development app. With
Metro and the disposable API running, generate the iOS project, use the Ruby
environment associated with CocoaPods to install the test target, then run it:

```sh
pnpm exec expo prebuild --platform ios
ruby scripts/install-ios-ui-tests.rb
xcodebuild -workspace ios/Testownik.xcworkspace -scheme Testownik \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -parallel-testing-enabled NO -collect-test-diagnostics never -jobs 2 \
  CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=- test
```

For current mutation checks, use a fresh simulator and the synthetic native
fixture. It creates its own SQLite database, local media directory, in-memory
email backend, and local OAuth issuer:

```sh
MOBILE_E2E_BACKEND=/absolute/path/to/testownik_core \
MOBILE_E2E_PYTHON=/absolute/path/to/backend/.venv/bin/python \
node scripts/run-native-fixture.cjs
```

Build the app with `EXPO_PUBLIC_API_URL=http://127.0.0.1:8768/api` and
`EXPO_PUBLIC_WEB_URL=http://127.0.0.1:8769`. A development build also needs Metro
on the launch URL configured in `NativeFlows.swift`; a Release build embeds its
JavaScript. The fixture refuses occupied ports and cleans up its own database
when stopped. Add `--verify` for its standalone consent/PKCE/REST checks.

Set both `TESTOWNIK_DISPOSABLE_FIXTURE=1` and `TESTOWNIK_SYNTHETIC_OAUTH=1` in
the XCTest runner environment, with `TESTOWNIK_LANGUAGE=en`, and select
`testSyntheticCreateQuizStudyAndRelaunch` and
`testSyntheticEditorKeyboardAndDraftRecovery`. These verify creation, study,
progress after relaunch, actual software keyboard clearance, draft restoration,
and explicit discard. The guard checks the synthetic account's identity before
any mutation. Existing-account checks use the separate read-only flags described
above. Older guest-specific tests require their own matching fixture and are not
part of this synthetic-account selection.
Keep local simulator signing enabled: unsigned builds cannot use Keychain.
XCTest retains a screenshot and the accessibility hierarchy. The
installer modifies only the generated, ignored Xcode project; rerun it after
regenerating that project. See `VERIFICATION.md` for the current evidence and
remaining checks.

## Distribution

`eas.json` provides development, internal APK preview, and production profiles. The production profile selects the EAS `production` environment and pins `https://testownik.solvro.pl/api` and `https://testownik.solvro.pl`. The verified local Release and native QA artifacts use disposable loopback services; a production artifact with these HTTPS origins and production signing has not been verified in this session. EAS project association, signing credentials, store records, and privacy declarations remain release checks. The preview profile does not itself pin API/web origins. Current OAuth uses the `testownik://auth` custom scheme; universal links are optional and require domain association files and signing identities.

The public website responds. Unauthenticated GET/HEAD of production `/api/mobile/quizzes/` returned HTTP404 on12October2026; the paired create endpoint implements POST, so these observations do not establish authenticated creation failure or deployed migration state. Verify authenticated HTTPS/OAuth behavior and the deployed receipt/version contract before distribution. See `VERIFICATION.md` for the recorded evidence.

iOS glass button styles are selected on iOS 26 and newer, with system bordered controls on older versions. The app uses Expo's `enableSceneSupport` configuration because iOS 27 requires scene-based startup. Current development uses stable Xcode 27 and the iOS 27 simulator. Native checks cover selected signed-in flows, including Polish/light and enlarged-text screens; see `VERIFICATION.md` for exact evidence and remaining checks.

### Native network-loss test

For the opt-in native offline test, start the disposable API on port 8765 and
run `python3 scripts/native-api-proxy.py`. Restart Metro with
`EXPO_PUBLIC_API_URL=http://127.0.0.1:8767/api`. The proxy binds only to loopback,
forwards to the disposable API and can close app connections while leaving
Metro available. It logs no tokens or request bodies. Never use it as a public
proxy or with production data.

`testOfflineAnswerSurvivesRelaunchAndSyncsOnce` creates a quiz, disconnects API
requests, records an answer, terminates/relaunches the app, verifies cached
completion and the pending answer, reconnects and verifies exactly one forwarded
answer across another relaunch. This tests native persistent storage and API
connection loss; it does not simulate every physical-device connectivity state.
The test restores proxy connectivity on exit and skips if the proxy is absent.

The signed-in Wrapped test requires a synthetic non-guest account with personal
and global reports in the disposable database; it skips on a guest account.
Run it separately from the guest Wrapped restriction test.
