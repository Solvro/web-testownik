---
name: "Testownik mobile — native controls"
description: "Testownik identity expressed through actual Android and iOS platform controls."
colors:
  light-bg: "#F4F6FA"
  light-surface: "#FFFFFF"
  light-text: "#17243C"
  light-muted: "#526079"
  light-primary: "#215BBD"
  light-tint: "#E8EFFC"
  light-border: "#D7DFED"
  light-success: "#17663C"
  light-success-bg: "#E3F3E9"
  light-danger: "#B42D38"
  light-danger-bg: "#FDECEF"
  dark-bg: "#101826"
  dark-surface: "#192437"
  dark-text: "#F4F7FE"
  dark-muted: "#A9B8CF"
  dark-primary: "#91B7FF"
  dark-tint: "#243D62"
  dark-border: "#34445C"
  dark-success: "#88DCAD"
  dark-success-bg: "#193D2C"
  dark-danger: "#FF9CA6"
  dark-danger-bg: "#492731"
  ios-light-bg: "#F2F2F7"
  ios-light-text: "#1C1C1E"
  ios-light-muted: "#62626A"
  ios-light-border: "#D1D1D6"
  ios-dark-bg: "#000000"
  ios-dark-surface: "#1C1C1E"
  ios-dark-text: "#F2F2F7"
  ios-dark-muted: "#A1A1AA"
  ios-dark-border: "#38383A"
typography:
  headline:
    fontSize: "32px"
    fontWeight: 700
  title:
    fontSize: "21px"
    fontWeight: 700
  body:
    fontSize: "16px"
    lineHeight: "24px"
  rich-body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Roboto, sans-serif"
    fontSize: "17px"
    lineHeight: 1.55
  question:
    fontFamily: "-apple-system, BlinkMacSystemFont, Roboto, sans-serif"
    fontSize: "21px"
    lineHeight: 1.55
rounded:
  group: "16px"
  ios-field: "12px"
spacing:
  content-gap: "8px"
  group-gap: "12px"
  section: "16px"
  page: "20px"
  page-bottom: "40px"
components:
  native-primary-action:
    width: "100%"
  native-secondary-action:
    width: "100%"
  native-destructive-action:
    width: "100%"
  native-field:
    width: "100%"
  native-list-item:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    width: "100%"
  native-switch:
    width: "100%"
  native-tabs:
    textColor: "{colors.light-primary}"
  native-overflow-trigger:
    width: "48px"
    height: "48px"
  study-answer:
    backgroundColor: "{colors.light-surface}"
    textColor: "{colors.light-text}"
    rounded: "{rounded.group}"
    padding: "12px 14px"
  content-group:
    backgroundColor: "{colors.light-surface}"
    rounded: "{rounded.group}"
    padding: "20px"
---

# Design System: Testownik mobile

## Overview

**Creative North Star: "Testownik through native controls"**

The product uses actual platform components: Android Material 3 through Jetpack Compose, iOS SwiftUI actions and rows through Expo UI, and UIKit-backed text entry through React Native TextInput. Testownik blue and Polish copy provide continuity; platform controls provide the material, interaction states and navigation conventions. The user explicitly rejected the previous uniform card-and-button-list interface.

The operational hierarchy is one primary action per task, with contextual actions in native menus. Questions, lists and forms have distinct structures. Native controls own their behavior and appearance; shared React Native containers organize content without pretending to be native controls. Wrapped preserves the existing web experience inside the native shell.

**Key Characteristics:**

- Actual Jetpack Compose and SwiftUI/UIKit controls, not CSS lookalikes.
- Testownik blue, Polish labels and system appearance.
- Persistent task actions with secondary actions in native menus.
- Readable question content with native selection indicators and explicit feedback.

**Evidence boundary:** this document supersedes the rejected original UI and follows current `PRODUCT.md`. Source inspection covers the native adapters, navigation, study, editor, profile and Wrapped. Android captures `/tmp/testownik-native-study-clean.png`, `/tmp/testownik-native-menu.png`, `/tmp/testownik-native-editor.png` and `/tmp/testownik-native-wrapped-final.png` show light-mode study, native menus, editor and the Wrapped guest restriction; they do not establish a signed-in recap. The signed iOS build runs on the iOS 27 iPhone 17 Pro simulator with Xcode 27 beta 4. `/tmp/testownik-ios-accessible-flows.log` and `/tmp/testownik-ios-accessible-flows.xcresult` pass both native flows (2 tests, zero failures) in dark appearance with extra-extra-extra-large text: quiz creation and study, plus guest navigation, keyboard search, profile-row targets and loaded Wrapped guest restriction. Inspected native captures under `/tmp/testownik-ios-accessible-verified/` corroborate editor keyboard/Save visibility (`2DA75C8D-EEE0-4C9F-B8D6-5F540CFB4AA8.png`), study feedback (`F1310E2D-60E1-466E-9F2C-8FCD4582DD32.png`) and Profile (`6936B384-C947-4BE8-990F-D2B60C2A03A5.png`) in that configuration. `/tmp/testownik-ios-profile.png` and `/tmp/testownik-ios-wrapped.png` provide earlier native light-mode Profile and fully loaded guest-Wrapped visual evidence. The final light/default-text rerun also passes both native flows (2 tests, zero failures), recorded in `/tmp/testownik-ios-final-light.log` and `/tmp/testownik-ios-final-light.xcresult`. These bounded flows do not establish every screen, every text scale or every device. Signed-in Wrapped recaps, native offline behavior, Android keyboard/dark/large-text checks, physical devices and older iOS versions remain unverified. Browser phone/tablet PNGs under `mobile/test-results` are fallback evidence, not native evidence.

## Colors

### Primary

Testownik blue remains the brand anchor. Frontmatter colors exactly match `src/lib/theme.ts`. Android action buttons, fields and option indicators pass the light primary blue as a Compose `seedColor`: the native Material scheme derives its rendered palette from that seed, so an actual native button fill need not equal the source hex. SwiftUI actions use the same blue tint. Native tabs, Android ListItem hosts and universal Switch hosts receive the current semantic primary. iOS SwiftUI row labels explicitly use the current text and muted semantic colors.

### Neutral

The light/dark `bg`, `surface`, `text`, `muted` and `border` roles color shared React Native surfaces, labels and navigation. The paired `tint` roles indicate selected answers. Frontmatter component colors describe light shared surfaces; switch them to the matching dark roles through `useTheme()`.

### Semantic feedback

Success and danger foreground/background pairs mark correct and incorrect study answers. Native destructive controls also use platform semantics: SwiftUI declares a destructive role, MenuView receives a destructive attribute, and Android TextButton explicitly uses Material error red (`#BA1A1A`). That platform-specific override is not a new shared brand token.

**The Semantic Theme Rule.** Use semantic light/dark tokens for shared surfaces and feedback, while leaving native control palettes to their configured platform theme.

The sidecar's color ramps are synthesized swatch metadata only, not extra application tokens. Native light/dark control behavior remains platform-owned; the supplied Android screenshots document light appearance, not a complete native dark-mode audit.

## Typography

Shared React Native text retains platform typography. The frontmatter records only authored headings, labels and rich-text sizes; it does not impose those values on Compose Button/Text, OutlinedTextField, ListItem, native tabs or menus. Their native component defaults remain authoritative. iOS rows explicitly use SwiftUI Dynamic Type `body` for titles and `subheadline` for supporting text; these are semantic text styles rather than fixed-size font tokens. No custom native display face is established.

- **Headline / title:** shared page headings and smaller section headings.
- **Body:** labels and explanatory copy with explicit line height.
- **Question:** larger rich-text prompt in study.
- **Rich body:** answer and explanation Markdown with bundled KaTeX mathematics.

Frontmatter `px` values represent React Native logical sizes or rich-content CSS sizes, not physical device pixels. Rich HTML scales its base size by `max(1, fontScale)`, wraps long text, and permits horizontal scrolling for code and display math. Its native WebView resizes to content; the browser iframe is a separate fallback.

**The Native Authority Rule.** Use the platform component implementation for control shape, type, focus, pressed and disabled behavior; browser fallbacks do not define the native design system.

## Layout

Shared screens use a centered scrolling column capped at (760 logical points), with (20-point) page padding and (40-point) bottom padding. Common content/group gaps are recorded in the frontmatter. Study has its own open question-and-answer layout, rather than nesting the full task in one generic card.

Study keeps Check/Next in a sibling footer outside the scroll area; completion replaces it with the results action. The editor uses the same persistent-footer pattern for Save. Footers use surface background, horizontal page padding, (12-point) top padding, a (0.5-point) top divider and bottom padding of `max(safeArea.bottom, 12)`. The shared screen uses keyboard-avoidance padding on iOS and reads `HeaderHeightContext` for `keyboardVerticalOffset`, intended to keep the persistent Save action above the keyboard. The dark/extra-extra-extra-large native flow now passes, and its editor capture shows Save visible above the active keyboard.

On native platforms, `NativeTabs` supplies the four destinations Nauka, Biblioteka, Oceny and Profil, with platform SF/Material icons and `minimizeBehavior="onScrollDown"`. Do not claim the old fixed tablet-sidebar breakpoint for native navigation: only the browser `AppTabs.tsx` fallback switches to left tabs above (800 logical/CSS pixels). Native tablet adaptation has not been demonstrated by the supplied screenshots. The inspected iPhone screenshot confirms the native bottom tab bar with Profil selected. `app.json` enables official `expo-build-properties` `ios.enableSceneSupport`; this is a startup prerequisite for the tested iOS 27 build after the scene-disabled startup crash, not a visual token.

Accessibility intent is (48-point) controls. The iOS button explicitly requests a (48-point) minimum height; the overflow trigger is (48 × 48 points); iOS navigation rows request a (48-point) minimum height and full available width; study answer rows have a (64-point) minimum height. Compose control dimensions remain native defaults rather than the old shared (50-point) recipe.

## Elevation & Depth

Native depth is now part of the system. Android screenshots show platform header separation and a raised native overflow menu. iOS source selects system `glassProminent` for primary buttons on iOS 26 and newer, with `borderedProminent` on earlier versions. The iOS 27 native test exercises the SwiftUI guest-login action, and the profile screenshot shows native tab-bar material. The dark/large-text editor and study captures now show the actual iOS primary button material; the older-iOS fallback remains source-only. Shared content groups and study answer surfaces themselves have no authored shadows. There are no app-owned duration, easing or shadow tokens in the inspected control adapters.

**The Platform Depth Rule.** Let native menus, navigation and supported system glass supply their own depth; do not replace them with invented shared shadow tokens.

## Shapes

Native buttons, switches, tabs and popup menus take their shape from the platform implementation. Android fields retain Material OutlinedTextField; the UIKit-backed iOS TextInput uses authored padding, surface color and rounding around native text entry. The observed Android primary action is a Material capsule, while OutlinedTextField uses Material's outlined form. Do not turn either screenshot geometry into a cross-platform radius token.

The frontmatter records only authored shared group/answer rounding and the iOS field wrapper rounding. Study answers have a (1-point) resting border and (1.5-point) chosen/correct border. These custom content containers coexist with native controls; they are not a universal card layout instruction.

## Components

### Jetpack Compose actions / SwiftUI actions

Android uses actual `Button` for primary actions and `TextButton` for secondary and destructive actions, through `@expo/ui/jetpack-compose`. Both fill the available width. Disabled or busy actions are disabled natively; busy copy becomes “Proszę czekać…”. SwiftUI uses a large `Button`: primary `glassProminent` on iOS 26+, otherwise `borderedProminent`; non-primary actions are `borderless`, with a destructive role when appropriate. Native components own focus, pressing and disabled visuals.

The browser ActionButton remains a Pressable fallback. Its capsule radius, opacity feedback and color fills are not the implementation of Android or iOS buttons. Documentation-panel HTML previews are semantic browser approximations, never proof of Compose or SwiftUI rendering.

### Material OutlinedTextField / UIKit-backed iOS TextInput

Android uses real `OutlinedTextField` with a floating label, native state, keyboard options and password transformation. Multiline input has at least two lines. The iOS adapter now uses React Native `TextInput`, backed by actual UIKit text entry, replacing the Expo SwiftUI input after rapid title replacement dropped characters. It retains a separate muted label, shared surface background, (14-point) padding, the recorded field radius and (17-point) text. Minimum height is (50 points) for single-line input and (80 points) for multiline input. The final adapter seeds UIKit with `defaultValue` and lets native selection remain authoritative. `NativeTextBinding` ignores React echoes of native typing and applies only external updates through `setNativeProps`, preserving the cursor during edits. Single-line fields expose the standard clear button while editing; multiline fields omit it. The visible label is not repeated as a placeholder. Submission forwards native event text, and multiline content aligns to the top. SwiftUI actions and navigation rows remain unchanged. The final light/default-text and dark/extra-extra-extra-large native tests pass quiz creation/study and Library keyboard search with this adapter; earlier intermediate failures do not describe the final implementation.

### Android ListItem, iOS SwiftUI rows and native Switch

Android retains the universal `@expo/ui` ListItem adapter for title/supporting text and native row interaction, with explicit shared surface/text/muted colors. iOS resolves to `NativeRow.ios.tsx`: an actual SwiftUI plain Button wraps an HStack label, with `maxWidth: Infinity`, `minHeight: 48` and a rectangular content shape. Its VStack uses a (3-point) title/detail gap, Dynamic Type body/subheadline styles and semantic text/muted colors; a Spacer fills the remaining width. Non-interactive rows render the same label without a Button. The expanded row hit area replaces the undersized previous iOS targets. Native XCTest now asserts all five guest-profile row buttons have height at least (48 points) and width greater than (250 points); that width is a tested iPhone geometry threshold, not a universal minimum-width token. Universal native Switch handles binary settings and editor answer correctness. Profile groups learning destinations under “Nauka” and account/help under “Konto i pomoc”; personal data/privacy live in the account route. Content groups remain useful for related rows, not as a mandate to render every action as a card.

### NativeTabs and native MenuView

NativeTabs owns the tab bar and platform icon treatment. `@expo/ui/community/menu` MenuView owns popup presentation and destructive/disabled menu attributes. A labeled (48-point) trigger opens it. Study exposes contextual quiz operations through the header menu; editor question and answer operations have contextual menus. Menus are actual native surfaces, not rows of full-width secondary buttons.

### Study answer rows and persistent action

Custom pressable answer rows contain the question content and a real Compose RadioButton or Checkbox before reveal. The enclosing row owns the interaction and radio/checkbox accessibility state; indicator hosts do not intercept touches. iOS uses SF Symbols for the selection indicator. After reveal, status icons, semantic colors and explicit “Poprawna odpowiedź” or “Twoja odpowiedź” text communicate correctness. The footer announces the result politely and presents the next action. Images remain opt-in for the session.

### Editor progressive details

Quiz title, current question and answer controls remain the main working surface. Optional description, image and explanation fields appear via the editor's details menu. Native switches mark correct answers; question/answer menus carry contextual changes. The persistent Save button remains the principal task action.

### Wrapped embedded web experience

Wrapped retains the existing website in an isolated native WebView, authenticated through the mobile web-session handoff. Incognito mode and disabled shared/third-party cookies separate it from ambient browser sessions. The native header menu switches personal/community scope; loading and retry states belong to the shell. The web experience retains its own typography, colors and motion rather than being restyled as native study UI. Android screenshot evidence confirms the guest-unavailable web state. The strengthened iOS native XCTest verifies the WebView, disappearance of the loading indicator and hittable guest-restriction heading; the refreshed iOS capture confirms the fully loaded guest page beneath the native header. The loading view uses an absolute-fill overlay so it does not divide the WebView viewport. Neither platform has evidence here of a completed signed-in recap.

## Do's and Don'ts

### Do:

- Do implement actions, fields, lists, switches, tabs and menus through their platform-native components.
- Do keep one primary task action and move contextual operations into native menus.
- Do retain Polish copy, scalable text, safe-area spacing and explicit answer feedback.
- Do distinguish verified native flows and screenshots from untested iOS surfaces and browser fallback checks.
- Do retain the existing Wrapped web experience inside its isolated native WebView.

### Don't:

- Don't restore the rejected uniform card-and-button-list composition.
- Don't impose browser button radii, opacity states or tablet breakpoints on native components.
- Don't imitate Liquid Glass in CSS or extend the iOS smoke-test result to untested screens, appearances or text scales.
- Don't copy Wrapped's web colors and display typography into the native study interface.
- Don't rely on answer color alone or hide the main task action below secondary commands.

### Grades browsing and local simulation

The grades tab extends the existing native system with a semester journal. Previous/next arrows flank a named semester selector; its page sheet lists each semester and its average. A two-way native segmented picker switches between actual grades and simulation. The actual average has open space and clear typography; passed courses and earned ECTS form a compact two-column summary. Course rows share a grouped surface and open report details in a native dismissible page sheet. Multi-semester averaging has its own sheet.

In simulation, every course has a visible SwiftUI grade picker. A pinned forecast compares the prediction to USOS and exposes Reset. The simulator owns a compact header and explicit scroll insets so the forecast stays fully below navigation; browsing retains the large title. Predictions stay local and are scoped to a semester. Browser fallback choices wrap instead of using per-grade full-width buttons. No new palette, typeface or global visual system is introduced.

## Study and Library collections — 26 September 2026

The Study landing screen uses a single Continue row, up to five recent quizzes, and a compact group linking to the library and saved-offline collection. Quiz titles belong inside their rows; the page does not repeat the active title as a hero or invent daily progress. Question counts and last-used dates come from the existing recent, library and search APIs. Missing metadata falls back to the available description rather than fabricated counts. Saved quizzes have a dedicated authenticated route with loading, empty and failure states.

Library separates regular folders, quizzes and archive/trash into titled groups. Native system search remains visible on entry; closing native search restores the toolbar and keyboard state; the redundant in-content clear action is kept only in the browser fallback. Sorting lives in a checked native toolbar menu, with a quiet current-sort caption. Quiz rows with an options menu omit a redundant disclosure arrow. iOS plain menu labels occupy a full 44-point target; the glyph remains 20 points. Existing permissions, move/archive/trash actions and native drag wrappers remain intact.

New iOS collection rows use SwiftUI buttons, SF Symbols, semantic body/footnote typography, at least 64-point row height, two-line titles at default sizes and unrestricted wrapping at enlarged sizes. Home groups use inset hairlines. Android retains the existing native Material ListItem adapter; browser rows are separate preview fallbacks. Shared iOS surfaces now use the neutral platform-specific values recorded above while Testownik blue remains the interaction tint. These are semantic app tokens selected by platform/appearance, not dynamic UIColor references. Other platforms retain the existing palette.

Native evidence and remaining device/accessibility limits are recorded in VERIFICATION.md. The user-authorized Claude screenshot consultation shaped this pass. The existing generated `.impeccable/design.json` metadata was already stale; it has not been regenerated as an unrelated side effect.

## Native root navigation — 26 September 2026

Study, Library, Grades browsing and Profile use native large titles that collapse with their scroll views. Root stack backgrounds are transparent on iOS so the operating system supplies scroll-edge separation and navigation material. Do not replace this with a fixed page heading or an opaque app-colored header. Non-collapsible scroll wrappers preserve native scroll discovery. Library retains system search below its compact title. Grades simulation deliberately uses a compact header and its existing explicit inset to keep the pinned forecast fully visible. Verified against the actual Apple Settings transition on iOS 27, in both app themes and with enlarged text.

## Assistant conversation and practice — 26 September evening

Use a compact native current-question reference above the composer, with full question/answer context on demand and answer numbering identical to study. First-turn actions explain, guide or generate one similar exercise. Keep the two primary suggestions reachable when the keyboard is open at larger text. Completed messages remain visually stable during streaming; user text stays literal, assistant Markdown supports completed offline typeset formulas.

Structured practice is a task within the conversation: one question at a time, native selection indicators, explicit Check answer and readable feedback/explanation. It does not affect quiz progress. Preserve tool results in local history and later AI context. Do not hide successful tool-only responses or apply AI-suggested settings/quiz mutations automatically. Native iOS sheet content must reserve the measured fixed-composer height, because the sheet's scroll-frame correction otherwise covers final reply actions. Native dark iPhone exercise/reopening acceptance and its limits are recorded in VERIFICATION.md.

### Compact native editor and meaningful Continue state

The iOS editor keeps quiz naming secondary when editing an existing quiz. Each answer is one compact card: correct-answer control, answer number, secondary menu, and an expanding text buffer. Save stays in the native top toolbar; persistent question navigation stays below the form, with Add separated from Next. Native fields retain UIKit's editing buffer to avoid lost keystrokes. Back uses the compact system chevron; controls remain locked during a save and a failed save leaves the draft in place.

Continue shows the current cached session's mastered-question count only when its quiz identity and version match. It otherwise uses existing quiz metadata. Study and Library share navigation chevrons, while overflow remains a separate management action. Claude's screenshot suggestions informed these changes; the suggestion to remove the Library/offline destination group was rejected because it misread that group as a duplicate quiz list.

### Native controls and action feedback (26 September release iteration)

Segmented iOS choices use SwiftUI's extra-large control size: the measured grade option is 49 points high. Keep the system picker, its selection behavior and material. Long-running actions retain their label's layout while showing a native spinner; repeated taps lock immediately, and sub-150-ms navigation does not flash progress. Assistant question labels identify quiz order explicitly, separate from the number of questions mastered in the active session. Notification body web links are selectable native text and open the system browser without changing read state.

### Final recovery and control decisions, 26 September

- Reviews ask for an explicit star rating; there is no preselected new five-star review. Keep saved and unsaved scores visibly distinct and keep the native stars at least 44 points high.
- Retain native segmented grade pickers at extra-large control size (49 points measured on iOS 27). Do not trade touch size for fitting more controls on one line.
- Saving privacy preferences keeps the switch and following sections in place. Successful profile/photo responses directly update the current user; avoid a second fetch that can make a successful save look undone.
- App-owned errors follow the chosen Polish/English language. Preserve actionable server validation rather than replacing every failure with a generic message.
- Offline wording promises cached questions, answers and progress; images and AI may still require internet. Do not imply an asset cache that is not implemented.

### Final assistant and simulator refinements

- Keep the iOS assistant body, toolbar and composer on the same neutral sheet surface. Use dividers for structure; avoid alternating large background bands. Preserve native sheet dismissal and system controls.
- In simulation mode, each course's headline is its effective predicted grade. Show the original as a smaller, explicitly labelled USOS value. Selecting the original value removes that prediction. Do not leave a stale passing-status caption beside a failing prediction.
- The forecast difference keeps its signed numeric value and uses red for a decrease, green for an increase, and muted text for a change that rounds to zero. Color supplements the value, never replaces it.
- Preserve the native Liquid Glass tab bar and automatic scroll-edge effects. Content may scroll beneath it, but the final course's entire grade picker must be reachable above it.
- Device profile snapshots are optional. A failed cache write must neither undo a confirmed server save nor block the next save in the current authenticated account. Account identity must remain separate from cache availability.
