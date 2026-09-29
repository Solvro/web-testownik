# iOS redesign — current working scope

The previous implementation is functional scaffolding, not an accepted design.
Android builds and simulator testing are deferred by the user. Keep iPad adaptation in the architecture, with iPhone verification first.

## Required outcomes

- Polish and English throughout native UI, including errors/accessibility; say quizy/quizzes, never bazy.
- Existing Testownik OAuth authorization server, authorization code + S256 PKCE, opaque access and rotating refresh tokens, revocation. A single system-browser sign-in entry uses the existing web login/consent. Old local mobile sessions can be discarded. Preserve the actual local database.
- Web development at http://localhost:3000. Keep only API, Next and Metro running outside bounded regression runs.
- Native navigation with collapsing large titles, correctly sized circular toolbar actions, responsive tab switching and platform search.
- Study: visible useful quick actions, compact layout, contextual inline hint, full chat conversation/composer, stable save states. Explain offline media actions.
- Profile: compact grouped settings, language control, photo action sheet with existing web options and working upload, visible bottom logout. No native account deletion or AI administration.
- Settings: native numeric steppers, clear section hierarchy, default mode/model parity with the web.
- Grades: investigate fetching, virtualize long data, visible semester selection, actual per-course what-if simulator and multi-semester calculation parity.
- Wrapped: use existing web page, adapt surrounding chrome to page theme. Statistics: embed existing web statistics, not a second native chart implementation.
- Library: sorting, usable folder editing/moving, native drag/drop, accessible non-drag alternatives. Sharing should use native share conventions and clear collaboration controls.
- Match Testownik web colors while using glass for controls/navigation only. Light/dark, scalable text, keyboard and error/empty states require native visual verification.

## Current pass

OAuth core migrated; 612 backend tests passed, 26 mobile unit tests passed. USOS OAuth sign-in and session persistence after relaunch passed on iOS. Locale provider and native Picker/Stepper primitives added; bilingual conversion and redesigned screens are not complete. Account deletion removed from mobile. Photo sheet, shared avatar choices, compact grouped settings and native model picker are implemented; native navigation/control checks pass. Full photo-library upload on a device remains unverified. Two test servers stopped; web moved to port 3000. Do not report the redesign as complete from these infrastructure checks.

Inline hint and conversation/composer layout implemented; native layout smoke check passes. Still required: streamed-response/retry/keyboard verification with mocked provider, complete localization, broader grades visual/error checks, additional Wrapped themes/menu checks, sorting/drag-and-drop, sharing/editor polish and cross-theme/large-text/iPad checks. Android remains deferred.

Statistics now embeds the existing web report; native personal metrics display verified. English report content, scope/chart interaction and expiration recovery still require work.

Wrapped slide-to-native color bridge now includes SwiftUI SF Symbol header controls with explicit foreground colors. Red/lime slides and return to Profile have been inspected in native screenshots; glyph contrast and color restoration are fixed. Additional slide palettes and community-menu interaction remain to be checked. Do not treat automated slide taps alone as visual acceptance.

## Toolbar contrast and study localization — 22 September 2026

Replaced Wrapped UIKit item-tint dependence with SwiftUI symbol controls inside the native header. The system still supplies the glass toolbar background. Explicit image foreground and SwiftUI color scheme follow each slide. Native red/lime screenshots show white/dark glyphs respectively; back navigation restores the dark Profile header and white status bar. Evidence: `.local/ios-wrapped-swiftui.xcresult`, exported attachments inspected. Native build, mobile typecheck/lint and all 40 mobile unit tests passed.

Localized tab-stack titles, home content, quiz answer/progress/completion/menu labels, and common loading/retry/sync messages. Full bilingual coverage remains incomplete: shared confirmation buttons/errors, library, grades, editor, assistant errors, and embedded web content need further work. Older native tests with Polish-only selectors must be updated alongside localization before running the broad suite.

## Grades redesign — 22 September 2026

Existing `/api/grades/` now returns the signed-in account's results through OAuth (confirmed 200 responses); no new endpoint or credential path. Replaced the placeholder add-a-course calculator with per-course predictions, reset, and multi-semester selection. Native SwiftUI semester picker and segmented view selector are visible in the content. Grades use a virtualized course list, large native navigation title, pull-to-refresh, ECTS/average summary and expandable report/issuer/distribution details. Controls are bilingual; source course/report/semester names remain as returned by USOS. The explicit no-published-grades 404 now maps to the empty state, while authorization/outage/unrelated 404 errors remain errors.

Web and mobile use the same `packages/core/grade-utils.ts` calculations, including counts-into-average and ECTS weighting. Web uses the same projected-average helper. First native check caught unsupported Hermes `toSorted`; replaced both occurrences with sorting fresh arrays. Final evidence: `.local/ios-grades-details.xcresult` passed real-account load, report expansion, changed prediction, reset-to-original average, and empty multi-semester selection. Exported screenshots inspected. Mobile typecheck/lint, 46 mobile tests, web typecheck and 14 web grade tests passed; native build passed. No real grade/account changes. Remaining grades checks: Polish and light/large-text/iPad layouts, semester picker switching, pull-to-refresh/error recovery and full report detail parity (dates/comparison presentation). Do not treat this as completion of the full mobile goal.

## Library organization — 22 September 2026

Added persisted native sorting (recent activity, newest/oldest, natural A–Z/Z–A, folders first), bilingual library controls, native create/rename sheets and a folder destination picker. Save/create actions live in the native modal toolbar, keeping them away from the keyboard. Moving offers a new-folder action and prevents same-parent/self/descendant or protected destinations. Existing quiz/folder endpoints are reused; no new auth flow. Added a user-filtered aggregate `last_used_at` to the library response for recent sorting, with a privacy regression proving another user's activity is not exposed.

Native checks open sorting, type a draft folder name then cancel, open a quiz destination picker and verify its same-parent action is disabled. No real folder/quiz was created/moved/deleted by those checks. Backend isolated OAuth tests verify create/rename/quiz move/folder move/cycle rejection and read-only denial. 23 targeted backend tests and 49 mobile tests passed; mobile types/lint and native build passed. `.local/ios-library-transparent.xcresult` is the accepted native run; its library screenshot was inspected. Earlier screenshots exposed a hidden large title and a keyboard-adjacent create action. Moving create to the toolbar fixed the latter; source inspection identified the opaque iOS navigation background as the title cause. Using a transparent native header fixed it while retaining system search and circular toolbar controls. Merely changing title style/Stack.Title/search placement did not fix it.

Remaining: native drag/drop, end-to-end native committed moves/rename against disposable data, nested destination/new-folder return paths, grouped-row polish, loading/search cancel details, Polish/light/large-text/iPad checks. The move picker is the accessible non-drag path, not a replacement for requested drag/drop. Full mobile goal remains active.

### 26 September library continuation

UIKit drag/drop is now implemented through a local Expo module, preserving the destination picker. Native folder-to-folder moves passed from both icon and row text on the signed-in iPhone; exact temporary fixture IDs were cleaned afterwards. Rapid-entry checks exposed intermittent dropped characters. The iOS field now uses React Native controlled text input and native event-count synchronization, replacing manual text writes; both library tests assert exact text.

Library refinement adds grouped row corners, localized Archive/Trash labels, explicit initial loading and move status, and a search-clear action that clears the native search field. Redundant return-to-root content is omitted one level below the library; deeper folders retain the shortcut. See VERIFICATION.md for evidence and remaining native coverage.

### Assistant reliability and send control

The assistant now restores drafts after stop/request failure, preserves successful replies if local history saving fails, and avoids repeated SSE parsing and unchanged renders. The iOS send/stop control is a circular native SwiftUI button with SF Symbols and system glass. Error states distinguish temporary availability, rate limits, sign-in and missing access in both languages. Browser tests cover partial-stream cancellation and retry without paid AI; the signed-in iPhone verifies local failure recovery, inline hint placement and circular button bounds. Native successful-stream, software-keyboard, long-history and iPad checks remain open.

## Assistant local drafts — 26 September

Account/question-scoped drafts persist through closing/backgrounding and clear after successful replies. Shared pending-write ordering also protects editor draft reads on reopening. Verified with 55 unit tests, eight mocked phone/tablet browser checks, and the signed-in iPhone close/reopen/failure-recovery test (`ios-assistant-drafts-selection.xcresult`). Native fixture draft was cleared afterward. This completes draft persistence coverage, not the broader assistant keyboard/streaming or whole-app acceptance.

## Assistant scroll correction — 26 September

Explicit native header spacing plus an empty-conversation state reset prevent the first failed reply from leaving the question under the sheet header. Verified native frame assertion and screenshot in `ios-assistant-scroll-clean.xcresult` (one pass, no skips), with eight phone/tablet mocked browser checks and clean typecheck/lint. Software-keyboard and native text-selection reliability remain separate open checks.

## Editor localization and validation — 26 September

Editor controls, confirmations and schema validation are bilingual. Invalid saves show feedback beside Save and select the offending question. Form lifetime is scoped to account/quiz; submission uses the shared web payload preparation. Browser phone/tablet checks pass in both languages; native visual/performance and full editor parity remain open.

## Persistent editor navigation — 26 September

Previous/next/add-question controls now stay in the editor footer as native circular SwiftUI actions, with boundary disabled states and a persistent count. Native test and inspected screenshot verify exact draft typing, question creation/navigation, 44-point circular hit bounds and visibility above the software keyboard. Fixed primary-button text contrast and disabled-arrow color. Verified only English/dark iPhone in this native pass; larger text, iPad and broader editor interactions remain open.

## Editor media controls — 26 September

Question/answer images now preview with contextual Replace/Remove actions. Save waits for uploads; pending results are applied to their original question by ID. Browser delayed-upload/navigation and removal checks pass, as does isolated actual OAuth upload/attach/remove API coverage. Native picker/HEIC/layout verification remains open.

## Native upload verified — 26 September

Real system photo selection found and fixed the Expo multipart incompatibility. File-backed FormData now uploads successfully on the signed-in iPhone; the generated PNG is converted by the existing backend to AVIF and previews correctly. Native remove-preview action passes. Task-owned draft/upload cleaned; source fixture retained in simulator Photos. Profile endpoint/HEIC/answer upload checks remain open.

## Question overview — 26 September

The footer count opens a native page sheet for direct question selection and reordering. UIKit reusable summary rows provide standard reorder handles; selection and draft data track question identity through moves. English/dark iPhone drag and return-to-editor flow passed with screenshot review. Browser phone/tablet persistence coverage passes. This does not yet establish large-quiz performance, VoiceOver, Dynamic Type or iPad acceptance.

## OAuth regression and account language — 26 September

Account/privacy copy now follows the app's PL/EN preference, including confirmations and failure recovery. Full current browser regression uses opaque OAuth accounts in an automatically cleaned disposable backend, with 44 phone/tablet checks passing. A missing non-iOS folder save action was restored; iOS keeps its native toolbar. These browser results do not establish native account layout or Android appearance.

## Sharing and connected app permissions — 26 September

Sharing now separates link delivery, visibility and collaboration. Invitations have focused search and study/edit roles; existing anonymous-access/author settings are available. PL/EN failure/retry/browser and actual OAuth grant/revoke checks pass. Signed-in English/dark iPhone screenshots verify native sharing layout and the actual system share sheet, opened without sending. Account cards are compact and replace truncated OAuth strings with readable permission details. Native invitation interactions, large text, iPad and Android remain open.

# Import and student forms — 26 September

Import starts with file selection or an explicit paste action, validates before upload, and previews the first question with a persistent creation action. New imports are private. The signed-in iPhone preview and screenshot passed without creating a quiz; native file/ZIP upload acceptance remains open. Reviews, question reports and feedback now have bilingual controls and draft-preserving failure behavior; rating save waits for existing rating data. Browser checks use synthetic or mocked accounts. These changes do not close the remaining native UI, iPad, accessibility or Android acceptance gaps.

## Native archive selection — 26 September

The system Files picker now reads the legacy ZIP fixture successfully on iPhone. Native testing found and removed an unsupported `Intl.Segmenter` dependency in the parser. Preview screenshot is readable and the primary action remains reachable. Actual upload/create and image rendering need their own evidence beyond this preview check.

Final native ZIP import now passes through creation and study, including rendering the uploaded image (`ios-import-native-create.xcresult`). The private quiz and image were independently verified in SQLite and then removed using exact-fixture guards; the corresponding local offline cache entry was also removed. This verifies the tested UTF-8 legacy ZIP path on English/dark iPhone, not every archive format, cancellation path or device size.

## Study image behavior — 26 September

Removed the blanket “Show images in this session” gate. Uploaded/API-host images and the web app's trusted media hosts now display automatically, including Markdown images. Other image sources get a compact explanation and source-host list beside the current question; approval is scoped to the current account/quiz and selected hosts. New hosts still require approval. Hidden-image text and web rich-content titles now follow PL/EN. Failed question/answer attachments show a labeled retry action; browser verification confirms answer-image retry does not select the answer. Full native retry/VoiceOver and Markdown-image failure treatment remain open.

Native automatic-image acceptance passed (`ios-study-media-visible.xcresult`) and the rendered fixture image was inspected. The capture also shows a blank back-button glyph immediately after navigation; verify after transition and correct if persistent in the next navigation polish pass. Image acceptance does not imply acceptance of the whole header. Temporary native quiz/upload/cache cleaned; signed-in app relaunched.

## Notification inbox and navigation verification — 26 September

Notifications now use compact virtualized rows, account-scoped data, PL/EN controls and dates, unread indicators, loading/empty/error/retry states, and pull-to-refresh. Notification HTML/Markdown is converted to native selectable text after screenshot review exposed blank WebView bodies. Link destinations remain readable text; tappable actions are a remaining refinement. Browser failure/read-state tests and isolated OAuth ownership/scope checks pass.

The normal Library/Study/Sharing back-navigation loop and the exact import-to-study replacement both show the back glyph after the transition settles and return correctly. The earlier blank glyph capture was transient in these verified paths; no custom navigation replacement was introduced. Import test data was cleaned.

Native notification content acceptance now passes with the actual account message asserted and screenshot inspected (`ios-notifications-native-content.xcresult`). No notification read state was mutated. Native refresh/mutation error interactions, broader accessibility/themes/device sizes and actionable message links remain open.

## Question search — 26 September

Search now uses the native system search bar with compact expandable question results, readable answers/correct-answer markers, PL/EN states, and accent-insensitive matching across question, answer and explanation text. Only the expanded question mounts its rich content/media. The first native capture caught a keyboard-dismissal defect that browser checks could not reveal; explicit native search-bar blur fixes it. Final iPhone test and screenshot confirm answers are readable with the keyboard closed. Broader themes/accessibility/iPad and Android remain unverified.

## Native language switch and light theme — 26 September

The language preference now refreshes native tab items as well as screen content, fixing the observed English tab labels remaining under a Polish profile. Browser-preview tabs are bilingual too, with clean accessibility labels. Clean iPhone screenshots and XCTest verify Polish/light profile and question search, including selected Profile-tab retention and keyboard dismissal. English/dark search was verified separately. Original language/appearance restored. This extends coverage for these flows only; other themes/screens, larger text, VoiceOver, native iPad and Android remain pending.

## Answer history — 26 September

Added the missing current-session answer review from the web study flow. Quiz options opens a native list with newest answers first and expandable details that distinguish your selections from correctness using both text and borders. Pending local answers remain reviewable; existing OAuth quiz data is reused. PL/EN browser failure/empty/pending checks and actual disposable OAuth integration pass. Final signed-in iPhone test and inspected screenshot verify the newest database record, answer distinctions and return to study without changing the account's answers. Native light/Polish/accessibility/iPad/offline/media variations remain pending.

## Edit the active question — 26 September

An editable quiz now has a visible circular pencil action alongside hint/assistant. It opens the full quiz editor at the exact active question, retaining unsaved quiz-wide edits. A removed target opens question selection with an explanation. Merely viewing the editor no longer creates a redundant local draft. Browser regression, isolated OAuth save/read-back, and signed-in iPhone navigation pass. Native screenshot confirms question 28 opens directly; draft baseline remains unchanged. Single-question quick-edit-sheet parity and broader native layout/accessibility coverage remain open.

## Regression and Dynamic Type — 26 September

Verified the current iPhone study/editor/history/photo/settings flows at enlarged text, then aligned Expo SDK 57 patch versions and rebuilt on stable Xcode 27. Native signed-in navigation/session persistence and the same core screens pass after rebuilding the bilingual XCTest harness. Production export, typecheck/lint, 72 unit tests, 60 mocked browser checks and four post-update actual OAuth smoke checks pass; the full 26 OAuth and 60 backend checks passed earlier in this pass. See VERIFICATION.md for exact results, the superseded test-binary failure, and remaining coverage. This is regression evidence, not completion of the full mobile UX/features goal.

## Reported button and AI fixes — 26 September

Header add/overflow actions now use explicit circular SwiftUI controls without a second wider UIKit background. Embedded row menus remain quiet plain controls. Local AI is enabled with the user's approved existing server key; mobile parses the existing structured hint contract and displays general/per-answer hints as native text. Live iPhone hint rendering and menu navigation are verified in `ios-ai-parsed.xcresult`. AI message formulas currently use textual notation; native chat success and broader native coverage remain separate checks.

## Grades journal and visible simulator — 26 September 2026

Reworked the grades tab inside the established native system. Browsing uses a semester pager with previous/next arrows and a full semester chooser showing averages, a clear weighted-average summary, compact passed/ECTS statistics, and one grouped course list. Course details open a dismissible native page sheet with dated reports, issuers and grade distributions. Multi-semester calculation is a separate sheet reached from the summary, instead of a third mutually exclusive top-level mode.

The simulator exposes SwiftUI segmented grade choices for every course, individual restoration to USOS, a semester-scoped reset and a persistent average with its difference from the real result. Local scenarios are scoped by semester to avoid leaking changes into repeated course IDs in another term. No prediction is written to the backend. Existing API, OAuth session and shared web grade calculations are reused. USOS-supplied semester/course/report names retain their source language; app controls and numeric formatting support Polish and English.

The simulator uses a compact native header with explicit scroll insets. The first native render exposed a partially hidden sticky forecast; the final geometry regression requires the whole average to be below the navigation bar after scrolling. Grades browsing retains the large native title. Light/dark semantic tokens and Dynamic Type are retained. This replaces the old inline expanded-report and per-course menu design described above.

## Home and Library hierarchy — 26 September 2026

Replaced the oversized home quiz headline/action and duplicate offline list with a compact Continue collection, recent quizzes with real question-count/date metadata, and dedicated library/offline destinations. Library now separates folders, quizzes and archive/trash; sorting is a native toolbar menu and system search is visible from entry. Native search dismissal restores the toolbar and keyboard state; the extra in-content clear action is retained only for the browser fallback. iOS collections use SwiftUI rows and SF Symbols on neutral grouped surfaces. Plain row menus now have an actual 44-point accessible target; editable quiz rows no longer carry both a disclosure arrow and an overflow action.

The backend change adds question counts to the existing library/recent/search serializers, using distinct question aggregation so sessions do not multiply counts. Existing endpoints, OAuth and populated local database remain in use. No migration or account-data write is needed. A user-authorized read-only Claude CLI review of actual home/library screenshots informed the design; unsupported assumptions about native search and circular add controls were rejected. Browser previews cover Polish and English; native acceptance and limitations are recorded in VERIFICATION.md.

## Native collapsing navigation — 26 September 2026

Compared the running Apple Settings app and implemented the same native large-title-to-compact-title behavior on all four root tabs. Scroll content extends beneath the system navigation material; the app no longer paints an opaque block behind it. Native scroll discovery requires non-collapsible wrappers on Study and Grades. Library keeps system search visible while its title collapses. The grade simulator retains a compact header with its forecast pinned below navigation. Dark/default-text and light/enlarged-text native checks pass, including editor navigation; exact evidence and remaining platform limits are in VERIFICATION.md.

## Assistant context and native sharing controls — 26 September, evening iteration

Assistant now keeps a compact current-question reference above the composer, with the exact answer order from study and full context available on demand. First-turn actions guide a student without revealing the answer. Per-turn question snapshots keep conversations coherent when the active question changes. New-conversation confirmation preserves drafts; completed messages remain stable while new content streams. At larger text, focusing the composer keeps the primary suggestion rows visible above the keyboard. Claude screenshot guidance informed these changes; native platform controls were retained where its generic critique suggested replacing them.

Sharing visibility now uses a full-row native selection menu with a value and picker affordance. Invitations precede long access lists, and explanatory link copy follows the actual permission mode. Settings navigation rows show disclosure chevrons and allow full supporting text at enlarged sizes. The signed-in iPhone light/XXXL run passes assistant answer-order/keyboard checks, sharing cancellation/invitation expansion and profile/photo/settings navigation (`ios-assistant-sharing-final.xcresult`, three tests). No sharing permission or photo was changed by that run.

## Four-hour continuation — 26 September evening

Continued the native student experience using multiple read-only Claude screenshot critiques. The assistant now combines exact question context, working structured practice, rendered mathematics, persistent drafts and a continuous sheet surface. Compact editor rows retain fast typing and grow with long content; native toolbar/footer actions stay consistent. Continue uses actual cached mastery when available, and Library rows separate navigation from management actions. Privacy and settings saves retain stable layout, handle failure and newer edits, and cannot silently discard a confirmed save because an optional device snapshot failed.

The simulator distinguishes effective predictions from original USOS values in each row, uses signed directional forecast feedback, and retains the original value without inventing a changed prediction. Enlarged Polish native verification confirms the last course's picker can scroll completely above the system tab bar. Native root headers continue using Apple's collapsing large-title behavior; the Library search placeholder fits at the maximum accessibility text size. See `VERIFICATION.md` for exact runs, screenshot evidence and limitations rather than treating old open-check lists above as the current status.

Remaining acceptance work after this bounded iteration:

- Resume native Android validation when requested; keep its emulator closed during this iOS pass.
- Exercise native iPad layouts, rotation and multitasking. Browser tablet viewports do not establish native iPad quality.
- Complete hands-on VoiceOver, reduced-motion and visible software-keyboard checks on an unlocked Mac/device. Automated selected accessibility audits are narrower evidence.
- Validate the latest photo/avatar flow through native permission and picker interactions, and notification link presentation through a real native browser transition. Current browser mutation checks and read-only native screens do not prove those complete flows.
- Measure tab animation responsiveness with a working hitch/frame instrument on a suitable device. Correct selection and memory sampling alone do not prove smoothness.

Admin AI configuration and account deletion remain on the web by explicit scope choice. The existing USOS OAuth session, local populated SQLite and normal web port 3000 remain the development setup. This pass is not a production-release or whole-app completion claim.

## Native redesign pass — 27 September 2026

The user judged the previous UI as web-like. This pass rebuilt the main surfaces on system components and added physical feedback. Apple HIG and Emil Kowalski's interaction guidance were the references; the web dashboard is being retired and was deliberately not ported.

- Shared: `expo-haptics` (selection, success/error) in `src/lib/haptics.ts`; `PressableScale` press feedback; chevron-only back buttons; `useConfirm` takes an action verb and a destructive flag (fixes Polish-only labels on the study screen).
- Home and Library: SwiftUI `List` (`HomeContent.ios`, `LibraryContent.ios`) with long-press menus, trailing swipe actions and native toolbar menus. Library search groups your, shared, group and public results. The React Native versions remain for the browser preview and Android.
- Drag and drop: SwiftUI `libraryDraggable` / `libraryDropDestination` modifiers are registered from the `library-drag` module. Automated simulator drags could not trigger a move; this still needs a hand check on a device.
- Study: native bottom toolbar (Edit, AI hint, Assistant, prominent Check/Next), a grouped quiz menu, answer shapes that stay the same after checking, an inline result card and haptics. The checked question is snapshotted, so a refetch can no longer swap in the next question before "Next".
- Grades: a toolbar semester menu with multi-semester average, and the summary in a card. Profile, Study Settings (auto-save, one request at a time), Account and privacy, and Notifications use native grouped lists. Feedback and question reports are compose sheets.
- expo-router 57 drops `accessibilityLabel` on `Stack.Toolbar` items on iOS, so icon buttons carry a text title instead; UIKit shows the icon and reads the title.
- Leading swipe actions compete with the iOS 26 full-width back gesture on pushed screens, so all swipe actions are on the trailing edge.

Open decisions: in-app account deletion (App Store guideline 5.1.1(v)); `user/delete-account/` accepts an arbitrary `transfer_to_user_id`.
