import XCTest
import UIKit

final class NativeFlows: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "pl.solvro.testownik")

  override func setUpWithError() throws {
    continueAfterFailure = false
    if name.contains("testManualUSOSSignIn") {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_MANUAL_USOS"] == "1", "Interactive provider sign-in is opt-in.")
    } else if name.contains("testAuthenticatedAccountNavigation") || name.contains("testExistingQuizQuickActions") || name.contains("testProfilePhotoAndSettings") || name.contains("testInlineHintAndAssistantLayout") || name.contains("testEmbeddedStatistics") || name.contains("testWrappedSlideChrome") || name.contains("testStudyLocale") || name.contains("testGradesSimulator") || name.contains("testGradesAverageAccessibility") || name.contains("testLibraryOrganization") || name.contains("testLibraryDrag") || name.contains("testEditorNavigationLayout") || name.contains("testEditorNavigationCompactAnswers") || name.contains("testEditorImagePicker") || name.contains("testEditorQuestionOverview") || name.contains("testSharingAndAccountLayout") || name.contains("testImportPreview") {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_REAL_ACCOUNT"] == "1", "Existing-account verification is opt-in.")
    } else {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1", "Regression tests require an explicitly selected disposable database.")
    }
    if name.contains("testUIKitKeyboardControl") || name.contains("testPureRNKeyboardControl") { return }
    app.launchArguments = []
    // Release QA loads the signed embedded bundle. Dev-client launch arguments
    // are used only when that separate configuration is explicitly requested.
    if ProcessInfo.processInfo.environment["TESTOWNIK_DEV_CLIENT"] == "1" {
      app.launchArguments = [
        "--initialUrl", "http://127.0.0.1:8081",
        "-EXDevMenuIsOnboardingFinished", "YES",
        "-EXDevMenuShowsAtLaunch", "NO",
        "-EXDevMenuShowFloatingActionButton", "NO"
      ]
    }
    if let language = ProcessInfo.processInfo.environment["TESTOWNIK_LANGUAGE"], ["pl", "en"].contains(language) {
      app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", language == "pl" ? "pl_PL" : "en_GB"]
    }
    app.launch()
    if name.contains("testManualUSOSSignIn") { return }
    let library = app.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch
    if !library.waitForExistence(timeout: 30) {
      if ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
         ProcessInfo.processInfo.environment["TESTOWNIK_SYNTHETIC_OAUTH"] == "1" {
        let signIn = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zaloguj się do Testownika", "Sign in to Testownik"])).firstMatch
        XCTAssertTrue(signIn.waitForExistence(timeout: 15), app.debugDescription)
        signIn.tap()
        let consentLabels = NSPredicate(format: "label IN %@", ["Continue", "Kontynuuj", "Dalej"])
        let inAppPermission = app.alerts.buttons.matching(consentLabels).firstMatch
        let systemPermission = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.buttons.matching(consentLabels).firstMatch
        if inAppPermission.waitForExistence(timeout: 5) { inAppPermission.tap() }
        else if systemPermission.waitForExistence(timeout: 10) { systemPermission.tap() }
      }
    }
    XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
    if ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1" {
      // The environment flag alone does not prove which backend the app uses.
      // Fail before touching an editor or study answer unless the signed-in
      // account is the fresh native fixture's synthetic principal.
      XCTAssertEqual(ProcessInfo.processInfo.environment["TESTOWNIK_SYNTHETIC_OAUTH"], "1")
      let profile = app.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch
      profile.tap()
      let identity = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Disposable Native QA, ")).firstMatch
      XCTAssertTrue(identity.waitForExistence(timeout: 10), "Refusing mutations outside the synthetic native QA account")
      library.tap()
    }
  }

  override func tearDownWithError() throws {
    if name.contains("testUIKitKeyboardControl") || name.contains("testPureRNKeyboardControl") { return }
    if name.contains("testManualUSOSSignIn") { return }
    if ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] != "1" { return }
    // Some local-cache tests stop the app before the host verifies disk state.
    // Their screenshots are captured in the test before that explicit stop.
    if app.state == .notRunning { return }
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = name
    capture.lifetime = .keepAlways
    add(capture)
    let hierarchy = XCTAttachment(string: app.debugDescription)
    hierarchy.name = "Native accessibility hierarchy"
    hierarchy.lifetime = .keepAlways
    add(hierarchy)
  }

  private func element(_ label: String) -> XCUIElement {
    app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
  }

  private func syntheticNewEditor(clearRestored: Bool = false) {
    let library = app.buttons.matching(NSPredicate(format: "label == %@", "Library")).firstMatch
    XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
    library.tap()
    app.buttons["Add to Library"].tap()
    let create = app.buttons["New Quiz"]
    XCTAssertTrue(create.waitForExistence(timeout: 5)); create.tap()
    XCTAssertTrue(app.navigationBars["New Quiz"].waitForExistence(timeout: 10), app.debugDescription)
    let restored = app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A draft was restored")).firstMatch
    if clearRestored && restored.exists {
      app.buttons["Editor options"].tap()
      app.buttons["Discard Changes"].tap()
      app.alerts.buttons["Discard"].tap()
      XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Add a Title")).firstMatch.waitForExistence(timeout: 5))
    }
  }

  private func syntheticDetails(title: String) {
    let details = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Add a Title")).firstMatch
    XCTAssertTrue(details.waitForExistence(timeout: 5), app.debugDescription); details.tap()
    let field = app.textFields["Title"]
    XCTAssertTrue(field.waitForExistence(timeout: 5), app.debugDescription)
    field.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    XCTAssertGreaterThan(app.keyboards.firstMatch.frame.height, 150)
    XCTAssertLessThan(app.keyboards.firstMatch.frame.minY, app.frame.maxY - 150)
    field.typeText(title)
    XCTAssertEqual(field.value as? String, title)
    app.buttons["Done"].tap()
  }

  func testSyntheticEditorKeyboardAndDraftRecovery() throws {
    syntheticNewEditor(clearRestored: true)
    XCTAssertTrue(app.buttons["Question 1"].exists, app.debugDescription)
    XCTAssertTrue(app.staticTexts["Questions (1)"].exists)
    syntheticDetails(title: "Native keyboard recovery")
    app.buttons["Question 1"].tap()
    let question = app.textViews["Question"]
    XCTAssertTrue(question.waitForExistence(timeout: 5), app.debugDescription)
    question.tap(); question.typeText("Which answer remains after reopening?")
    let answer = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Answer 1")).firstMatch
    XCTAssertTrue(answer.exists); answer.tap()
    let longAnswer = "This answer keeps its text while the keyboard is open. A longer paragraph should wrap and grow without hiding the navigation toolbar."
    answer.typeText(longAnswer)
    XCTAssertEqual(answer.value as? String, longAnswer)
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "This regression must exercise the actual software keyboard")
    let add = app.buttons["Add Question"]
    XCTAssertTrue(add.isHittable)
    XCTAssertTrue(app.buttons["Save"].isHittable, "Save must remain reachable while typing")
    // UIKit reports the inner glass glyph as 36pt inside a 44pt native
    // toolbar item. Exercise the outer hit area instead of asserting glyph size.
    let addTarget = add.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0)).withOffset(CGVector(dx: 0, dy: -3))
    if app.keyboards.firstMatch.exists {
      XCTAssertLessThanOrEqual(add.frame.maxY, app.keyboards.firstMatch.frame.minY, "Question navigation must clear the keyboard")
    }
    let keyboardCapture = XCTAttachment(screenshot: app.screenshot())
    keyboardCapture.name = "Editor actions above software keyboard"
    keyboardCapture.lifetime = .keepAlways
    self.add(keyboardCapture)
    addTarget.tap()
    XCTAssertTrue(app.navigationBars["Question 2 of 2"].waitForExistence(timeout: 5))
    let secondText = "A second question also keeps its text."
    question.tap(); question.typeText(secondText)
    // The native bottom toolbar sits below the software keyboard. Exercise
    // the reachable question-menu action rather than an offscreen hit point.
    app.buttons["Question options"].tap()
    let previous = app.buttons.matching(identifier: "Previous Question").allElementsBoundByIndex.first(where: { $0.isHittable })
    XCTAssertNotNil(previous, "Previous Question must be reachable in the native menu while typing")
    previous?.tap()
    XCTAssertTrue(app.navigationBars["Question 1 of 2"].waitForExistence(timeout: 5))
    XCTAssertTrue(question.waitForExistence(timeout: 5))
    XCTAssertEqual(question.value as? String, "Which answer remains after reopening?")
    XCTAssertEqual(answer.value as? String, longAnswer)
    app.buttons["Question options"].tap()
    let nextQuestion = app.buttons.matching(identifier: "Next Question").allElementsBoundByIndex.first(where: { $0.isHittable })
    XCTAssertNotNil(nextQuestion)
    nextQuestion?.tap()
    XCTAssertTrue(app.navigationBars["Question 2 of 2"].waitForExistence(timeout: 5))
    XCTAssertEqual(question.value as? String, secondText)
    app.navigationBars.buttons["Back"].tap()
    XCTAssertTrue(app.staticTexts["Questions (2)"].waitForExistence(timeout: 5))
    app.terminate(); app.launch()
    syntheticNewEditor()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Native keyboard recovery")).firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["Questions (2)"].exists)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "A draft was restored")).firstMatch.exists)
    app.buttons["Editor options"].tap(); app.buttons["Discard Changes"].tap()
    app.alerts.buttons["Discard"].tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Add a Title")).firstMatch.waitForExistence(timeout: 5))
    XCTAssertTrue(app.staticTexts["Questions (1)"].exists)
  }

  func testSyntheticCreateQuizStudyAndRelaunch() throws {
    syntheticNewEditor(clearRestored: true)
    let title = "Native QA \(UUID().uuidString.prefix(8))"
    syntheticDetails(title: title)
    app.buttons["Question 1"].tap()
    let question = app.textViews["Question"]
    XCTAssertTrue(question.waitForExistence(timeout: 5)); question.tap(); question.typeText("Which answer is correct?")
    let first = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Answer 1")).firstMatch
    first.tap(); first.typeText("Correct fixture answer")
    let second = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Answer 2")).firstMatch
    second.tap(); second.typeText("Other fixture answer")
    let correct = app.buttons["Correct answer 1"]
    if correct.value as? String == "No" { correct.tap() }
    app.buttons["Save"].tap()
    let option = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label CONTAINS %@", "study-answer-", "Correct fixture answer")).firstMatch
    XCTAssertTrue(option.waitForExistence(timeout: 30), app.debugDescription)
    option.tap()
    app.buttons["Check"].tap()
    XCTAssertTrue(app.staticTexts["Correct!"].waitForExistence(timeout: 10), app.debugDescription)
    app.terminate(); app.launch()
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Continue: \(title)")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 15), app.debugDescription); resume.tap()
    XCTAssertTrue(app.staticTexts["Quiz Complete!"].waitForExistence(timeout: 10), "The acknowledged answer must remain mastered after relaunch")
    XCTAssertTrue(app.staticTexts["1 of 1 mastered"].exists)
  }

  private func nativeComposeControl() throws -> [String: Any] {
    let completed = expectation(description: "Fail-closed disposable compose fixture")
    var payload: Data?
    var response: HTTPURLResponse?
    var failure: Error?
    URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8768/__native_qa_control")!) { data, result, error in
      payload = data; response = result as? HTTPURLResponse; failure = error
      completed.fulfill()
    }.resume()
    wait(for: [completed], timeout: 10)
    XCTAssertNil(failure)
    guard response?.statusCode == 200,
          let payload,
          let value = try JSONSerialization.jsonObject(with: payload) as? [String: Any],
          value["mode"] as? String == "compose-503",
          value["block_delivery"] as? Bool == true else {
      XCTFail("Native Send requires the verified fail-closed local fixture")
      throw NSError(domain: "NativeQASafety", code: 1)
    }
    return value
  }

  private func qaTypeSoftwareWords(_ text: String) throws {
    for character in text {
      let label = character == " " ? "space" : String(character)
      let key = app.keyboards.keys.matching(NSPredicate(format: "label ==[c] %@", label)).firstMatch
      XCTAssertTrue(key.exists || key.waitForExistence(timeout: 3), "Missing actual software key \(label)")
      XCTAssertTrue(key.isHittable, "Software key must be visible: \(label)")
      key.tap()
    }
  }

  func testSyntheticFeedbackKeyboardAndDiscard() throws {
    try syntheticFeedbackKeyboardAndDiscard(softwareKeys: false)
  }

  func testSyntheticFeedbackSoftwareKeysAndDiscard() throws {
    try syntheticFeedbackKeyboardAndDiscard(softwareKeys: true)
  }

  private func syntheticFeedbackKeyboardAndDiscard(softwareKeys: Bool) throws {
    app.buttons.matching(NSPredicate(format: "label == %@", "Profile")).firstMatch.tap()
    let feedback = app.buttons["Send Feedback"]
    for _ in 0..<10 {
      if feedback.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(feedback.isHittable, app.debugDescription)
    feedback.tap()
    let subject = app.textFields["Subject"]
    XCTAssertTrue(subject.waitForExistence(timeout: 10), app.debugDescription)
    subject.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5), "Feedback must exercise the actual software keyboard")
    XCTAssertGreaterThan(app.keyboards.firstMatch.frame.height, 150)
    XCTAssertLessThan(app.keyboards.firstMatch.frame.minY, app.frame.maxY - 150)
    let subjectText = softwareKeys ? "Native keyboard subject" : "Native QA keyboard subject"
    if softwareKeys { try qaTypeSoftwareWords(subjectText) } else { subject.typeText(subjectText) }
    XCTAssertEqual(subject.value as? String, subjectText)
    let next = app.keyboards.buttons.matching(NSPredicate(format: "label ==[c] %@", "next")).firstMatch
    XCTAssertTrue(next.exists, "Subject should offer a keyboard Next action")
    next.tap()
    let message = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Message")).firstMatch
    let draft = softwareKeys ? "A native test message" : "An unsent synthetic message.\nThe keyboard must leave the native actions reachable."
    if softwareKeys { try qaTypeSoftwareWords(draft) } else { message.typeText(draft) }
    XCTAssertEqual(message.value as? String, draft)
    XCTAssertEqual(subject.value as? String, subjectText)
    XCTAssertTrue(app.keyboards.firstMatch.exists)
    let send = app.navigationBars.buttons["Send"]
    XCTAssertTrue(send.isHittable)
    XCTAssertTrue(send.isEnabled)
    XCTAssertLessThanOrEqual(send.frame.maxY, app.keyboards.firstMatch.frame.minY)
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Feedback software keyboard and native actions"
    capture.lifetime = .keepAlways
    add(capture)
    let before = try nativeComposeControl()
    let sentBefore = (before["intercepted"] as? [String: Int])?["feedback"] ?? -1
    XCTAssertGreaterThanOrEqual(sentBefore, 0)
    send.tap()
    let failed = app.staticTexts.matching(identifier: "Disposable native QA service unavailable.").firstMatch
    XCTAssertTrue(failed.waitForExistence(timeout: 10), app.debugDescription)
    // Informational alert text is not an interactive hit target. Check its
    // unobstructed on-screen geometry and keep the glyph screenshot below.
    XCTAssertGreaterThan(failed.frame.height, 0)
    XCTAssertTrue(app.frame.contains(failed.frame), "The failed-send explanation must be on screen")
    XCTAssertGreaterThanOrEqual(failed.frame.minY, app.navigationBars.firstMatch.frame.maxY)
    if app.keyboards.firstMatch.exists && app.keyboards.firstMatch.frame.minY < app.frame.maxY {
      let predictions = app.otherElements.matching(identifier: "SystemInputAssistantView").firstMatch
      let top = predictions.exists ? predictions.frame.minY : app.keyboards.firstMatch.frame.minY
      XCTAssertLessThanOrEqual(failed.frame.maxY, top, "The error must remain above the keyboard")
    }
    XCTAssertEqual(subject.value as? String, subjectText)
    XCTAssertEqual(message.value as? String, draft, "Failed sends must retain the exact draft")
    XCTAssertTrue(send.isEnabled, "A failed send must allow an explicit retry")
    let after = try nativeComposeControl()
    XCTAssertEqual((after["intercepted"] as? [String: Int])?["feedback"], sentBefore + 1)
    let failureCapture = XCTAttachment(screenshot: app.screenshot())
    failureCapture.name = "Feedback failed-send recovery and retained draft"
    failureCapture.lifetime = .keepAlways
    add(failureCapture)
    app.navigationBars.buttons["Cancel"].tap()
    let discard = app.alerts["Discard This Message?"]
    XCTAssertTrue(discard.waitForExistence(timeout: 5), app.debugDescription)
    discard.buttons["Cancel"].tap()
    XCTAssertEqual(message.value as? String, draft, "Cancelling discard must retain the message")
    app.navigationBars.buttons["Cancel"].tap()
    app.alerts.buttons["Discard"].tap()
    XCTAssertTrue(app.buttons["Send Feedback"].waitForExistence(timeout: 10))
  }

  // Compare bulk XCTest injection with individual software-key taps on the
  // same unchanged app artifact. This records a diagnosis, not an input fix.
  func testSyntheticTypingDiagnostic() throws {
    app.buttons.matching(NSPredicate(format: "label == %@", "Profile")).firstMatch.tap()
    let feedback = app.buttons["Send Feedback"]
    for _ in 0..<10 {
      if feedback.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(feedback.isHittable)
    var observations: [String] = []
    for mode in ["bulk-autofocus", "bulk-tap", "individual-injection", "software-keys"] {
      feedback.tap()
      let subject = app.textFields["Subject"]
      XCTAssertTrue(subject.waitForExistence(timeout: 10))
      XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
      if mode == "bulk-tap" { subject.tap() }
      let expected = mode == "software-keys" ? "Native" : "Native QA diagnostic"
      if mode == "software-keys" {
        let visible = app.keyboards.firstMatch.frame.intersects(app.frame) && app.keyboards.firstMatch.frame.minY < app.frame.maxY - 150
        if visible {
          for letter in "native" {
            let key = app.keyboards.keys.matching(NSPredicate(format: "label ==[c] %@", String(letter))).firstMatch
            XCTAssertTrue(key.exists, "Missing software key \(letter)")
            key.tap()
          }
        } else {
          observations.append("software-keys: unavailable; keyboard is outside app frame")
        }
      } else if mode == "individual-injection" {
        for letter in expected { subject.typeText(String(letter)) }
      } else {
        subject.typeText(expected)
      }
      let actual = subject.value as? String ?? "<missing>"
      observations.append("\(mode): expected=\(expected), actual=\(actual), exact=\(actual == expected)")
      print(observations.last!)
      let valueReport = XCTAttachment(string: observations.joined(separator: "\n"))
      valueReport.name = "Typing diagnostic values through \(mode)"
      valueReport.lifetime = .keepAlways
      add(valueReport)
      let capture = XCTAttachment(screenshot: app.screenshot())
      capture.name = "Typing diagnostic \(mode)"
      capture.lifetime = .keepAlways
      add(capture)
      app.navigationBars.buttons["Cancel"].tap()
      let discard = app.alerts["Discard This Message?"]
      if discard.waitForExistence(timeout: 2) { discard.buttons["Discard"].tap() }
      XCTAssertTrue(feedback.waitForExistence(timeout: 10))
    }
    let report = XCTAttachment(string: observations.joined(separator: "\n"))
    report.name = "Typing diagnostic results"
    report.lifetime = .keepAlways
    add(report)
    print(observations.joined(separator: "\n"))
  }

  private func openSyntheticImageQuiz(_ suffix: String, saved: Bool) {
    let title = "Native QA Image Cache \(suffix)"
    if saved {
      app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch.tap()
      let downloads = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Saved Offline")).firstMatch
      for _ in 0..<8 { if downloads.isHittable { break }; app.swipeUp() }
      XCTAssertTrue(downloads.isHittable, app.debugDescription)
      downloads.tap()
    } else {
      app.buttons.matching(NSPredicate(format: "label == %@", "Library")).firstMatch.tap()
    }
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    for _ in 0..<12 { if row.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(row.isHittable, app.debugDescription)
    row.tap()
    XCTAssertTrue(app.navigationBars[title].waitForExistence(timeout: 15), app.debugDescription)
    let image = app.images["Question image"].firstMatch
    XCTAssertTrue(image.waitForExistence(timeout: 15), app.debugDescription)
    XCTAssertFalse(app.buttons["Reload: Question image"].exists)
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Image fixture \(suffix) \(saved ? "saved after outage" : "online")"
    capture.lifetime = .keepAlways
    add(capture)
  }

  func testSyntheticFormattedQuestionSettles() throws {
    let control = try nativeComposeControl()
    XCTAssertEqual(control["network"] as? String, "online")
    openSyntheticImageQuiz("A", saved: false)
    let web = app.webViews.firstMatch
    XCTAssertTrue(web.waitForExistence(timeout: 20), app.debugDescription)
    let question = web.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "Native cached question image.")).firstMatch
    XCTAssertTrue(question.waitForExistence(timeout: 30), app.debugDescription)
    XCTAssertGreaterThan(question.frame.height, 0)
    XCTAssertTrue(app.frame.intersects(question.frame))
    let authoredImage = web.images.matching(NSPredicate(format: "label CONTAINS %@", "Native markdown cache image")).firstMatch
    XCTAssertTrue(authoredImage.waitForExistence(timeout: 20), app.debugDescription)
    XCTAssertGreaterThan(authoredImage.frame.height, 20)
    let settled = XCTAttachment(screenshot: app.screenshot())
    settled.name = "Current formatted question text and authored inline image after settling"
    settled.lifetime = .keepAlways; add(settled)
    let hierarchy = XCTAttachment(string: app.debugDescription)
    hierarchy.name = "Current settled formatted-question hierarchy"
    hierarchy.lifetime = .keepAlways; add(hierarchy)
  }

  func testSyntheticImageDownload() throws {
    let control = try nativeComposeControl()
    XCTAssertEqual(control["network"] as? String, "online")
    for suffix in ["A", "B"] {
      openSyntheticImageQuiz(suffix, saved: false)
      // Never answer: these fixtures only exercise downloaded media.
      app.navigationBars.buttons.firstMatch.tap()
    }
  }

  func testSyntheticImageOfflineRemoveA() throws {
    let control = try nativeComposeControl()
    XCTAssertEqual(control["network"] as? String, "offline")
    openSyntheticImageQuiz("A", saved: true)
    XCTAssertTrue(app.staticTexts["Saved copy. Couldn’t refresh this quiz."].waitForExistence(timeout: 15), app.debugDescription)
    let answer = app.descendants(matching: .any).matching(identifier: "study-answer-e121bd54-80ab-4dce-8b4b-5aa4d1aa0021").firstMatch
    for _ in 0..<6 { if answer.isHittable { break }; app.swipeUp() }
    XCTAssertTrue(answer.isHittable, app.debugDescription)
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Saved unique answer and Markdown image after cache quarantine"
    capture.lifetime = .keepAlways
    add(capture)
    app.navigationBars.buttons.firstMatch.tap()
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Native QA Image Cache A")).firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 10)); row.swipeLeft()
    let remove = app.buttons["Remove"].firstMatch
    XCTAssertTrue(remove.waitForExistence(timeout: 5)); remove.tap()
    XCTAssertFalse(row.waitForExistence(timeout: 2))
    let retained = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Native QA Image Cache B")).firstMatch
    XCTAssertTrue(retained.exists, "Removing A must retain B and its shared media reference")
    app.terminate()
  }

  func testSyntheticImageOfflineRemoveB() throws {
    let control = try nativeComposeControl()
    XCTAssertEqual(control["network"] as? String, "offline")
    openSyntheticImageQuiz("B", saved: true)
    app.navigationBars.buttons.firstMatch.tap()
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Native QA Image Cache B")).firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 10)); row.swipeLeft()
    let remove = app.buttons["Remove"].firstMatch
    XCTAssertTrue(remove.waitForExistence(timeout: 5)); remove.tap()
    XCTAssertFalse(row.waitForExistence(timeout: 2))
    app.terminate()
  }

  func testSyntheticHomeBrandHeader() throws {
    app.terminate()
    app.launch()
    let study = app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch
    XCTAssertTrue(study.waitForExistence(timeout: 30), app.debugDescription)
    // Check the initial screen before a tab switch can repair missing chrome.
    XCTAssertTrue(study.isSelected, "Fresh launch must begin on Study")
    let coldLogo = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Testownik")).firstMatch
    XCTAssertTrue(coldLogo.waitForExistence(timeout: 10), "Brand image must install on initial launch")
    app.buttons.matching(NSPredicate(format: "label == %@", "Library")).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch.tap()
    let logo = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Testownik")).firstMatch
    XCTAssertTrue(logo.waitForExistence(timeout: 10), "The expanded Study header must expose its brand image")
    XCTAssertGreaterThanOrEqual(logo.frame.height, 24)
    XCTAssertGreaterThanOrEqual(logo.frame.width, 120)
    XCTAssertGreaterThanOrEqual(logo.frame.minY, app.frame.minY)
    XCTAssertLessThanOrEqual(logo.frame.maxY, app.frame.maxY)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch.isSelected)
    let bar = app.navigationBars.firstMatch
    XCTAssertTrue(bar.frame.contains(logo.frame), "Expanded logo must remain inside the native header")
    let studyHeight = bar.frame.height
    app.buttons.matching(NSPredicate(format: "label == %@", "Grades")).firstMatch.tap()
    let grades = app.navigationBars["Grades"]
    XCTAssertTrue(grades.waitForExistence(timeout: 10))
    XCTAssertLessThanOrEqual(studyHeight, grades.frame.height + 16, "Brand slot should not inflate the native header")
    app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch.tap()
  }

  // Diagnostic observations only: exactness is reported, not asserted as acceptance.
  func testSyntheticColdTypingBaseRate() throws {
    let expected = "Native QA diagnostic"
    var observations: [String] = []
    for trial in 0..<10 {
      app.terminate(); app.launch()
      let profile = app.buttons.matching(NSPredicate(format: "label == %@", "Profile")).firstMatch
      XCTAssertTrue(profile.waitForExistence(timeout: 30)); profile.tap()
      let feedback = app.buttons["Send Feedback"]
      for _ in 0..<10 { if feedback.isHittable { break }; app.swipeUp() }
      XCTAssertTrue(feedback.isHittable); feedback.tap()
      let field = app.textFields["Subject"]
      XCTAssertTrue(field.waitForExistence(timeout: 10))
      XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
      field.typeText(expected)
      let actual = field.value as? String ?? "<missing>"
      let row = "RN real app cold trial=\(trial), expected=\(expected), actual=\(actual), exact=\(actual == expected), keyboard=\(app.keyboards.firstMatch.frame)"
      observations.append(row); print(row)
      app.terminate()
    }
    let report = XCTAttachment(string: observations.joined(separator: "\n"))
    report.name = "Real app cold typing base rate"
    report.lifetime = .keepAlways; add(report)
  }

  // Diagnostic-only replacement fragment. Do not run against a product bundle.
  // Each cell is recorded even if readiness/dump validation fails. Exactness is
  // an observation; invalid cells are excluded from any rate calculation.
  func testPureRNKeyboardControl() throws {
    let control = XCUIApplication(bundleIdentifier: "pl.solvro.testownik.rnkeyboardqa")
    let configuredRounds = ProcessInfo.processInfo.environment["RN_KEYBOARD_QA_ROUNDS"] ?? "2"
    guard let rounds = Int(configuredRounds), (1...3).contains(rounds) else {
      throw XCTSkip("Use 1–3 diagnostic rounds (16–48 cells); invalid counts never silently default.")
    }
    let expected = "Native keyboard subject"
    let oldContinue = continueAfterFailure
    continueAfterFailure = true
    var observations: [[String: Any]] = []
    func attachJSON(_ object: Any, name: String) {
      guard JSONSerialization.isValidJSONObject(object),
        let data = try? JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys]),
        let text = String(data: data, encoding: .utf8) else {
          let fallback = XCTAttachment(string: "JSON attachment encoding failed: " + String(describing: object))
          fallback.name = name + " (encoding failure)"; fallback.lifetime = .keepAlways; add(fallback)
          return
        }
      let attachment = XCTAttachment(string: text)
      attachment.name = name; attachment.lifetime = .keepAlways; add(attachment)
      print("RNKeyboardQA " + text)
    }
    defer {
      attachJSON(["schemaVersion": 2, "expectedText": expected, "rounds": rounds,
        "note": "Small diagnostic sample; same linked native binary, not an RN-only attribution or real-user typing result.",
        "expectedCells": rounds * 16,
        "validCells": observations.filter { $0["valid"] as? Bool == true }.count,
        "observations": observations], name: "Pure RN keyboard complete diagnostic summary")
      control.terminate()
      continueAfterFailure = oldContinue
    }
    func json(_ element: XCUIElement) -> [String: Any]? {
      guard element.exists, element.label != "No dump",
        let data = element.label.data(using: .utf8),
        let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
      return value
    }
    func wait(_ timeout: TimeInterval, _ predicate: @escaping () -> Bool) -> Bool {
      let expectation = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in predicate() }, object: nil)
      return XCTWaiter.wait(for: [expectation], timeout: timeout) == .completed
    }
    func rect(_ value: CGRect) -> [String: Any] {
      func finite(_ value: CGFloat) -> Any { let number = Double(value); return number.isFinite ? number as Any : NSNull() }
      return ["x": finite(value.minX), "y": finite(value.minY), "width": finite(value.width), "height": finite(value.height)]
    }
    func keyboardSnapshot() -> [String: Any] {
      let keyboard = control.keyboards.firstMatch
      return ["exists": keyboard.exists, "frame": keyboard.exists ? rect(keyboard.frame) as Any : NSNull()]
    }
    func keyboardVisible() -> Bool {
      let keyboard = control.keyboards.firstMatch
      return keyboard.exists && keyboard.frame.intersects(control.frame) &&
        keyboard.frame.height >= 100 && keyboard.frame.minY < control.frame.maxY - 100
    }
    func freshDump(trialID: String, after captureID: Int) -> ([String: Any], Int, Double)? {
      let button = control.buttons["Dump events"]
      guard button.exists else { return nil }
      let requestedWallMs = Date().timeIntervalSince1970 * 1000
      button.tap()
      let output = control.staticTexts["rn-control-events"]
      guard wait(5, {
        guard let manifest = json(output), manifest["trialID"] as? String == trialID,
          let current = manifest["captureID"] as? Int else { return false }
        return current > captureID
      }), let manifest = json(output),
        manifest["schemaVersion"] as? Int == 2,
        let current = manifest["captureID"] as? Int,
        let count = manifest["chunks"] as? Int, (1...256).contains(count),
        let characters = manifest["characters"] as? Int else { return nil }
      var body = ""
      for index in 0..<count {
        let chunk = control.staticTexts["rn-control-events-\(current)-\(index)"]
        guard chunk.waitForExistence(timeout: 3) else { return nil }
        body += chunk.label
      }
      guard body.utf16.count == characters, let data = body.data(using: .utf8),
        let value = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
        value["schemaVersion"] as? Int == 2,
        value["trialID"] as? String == trialID,
        value["captureID"] as? Int == current,
        value["expectedText"] as? String == expected,
        value["overflow"] as? Bool == false else { return nil }
      return (value, current, requestedWallMs)
    }
    func cell(arm: String, mode: String, round: Int, runID: String, sequence: Int) {
      let autoFocus = mode.hasSuffix("auto"), policy = autoFocus ? "auto" : "tap"
      let trialID = "\(runID):\(arm):\(policy):\(sequence)"
      var row: [String: Any] = ["arm": arm, "mode": mode, "round": round,
        "runID": runID, "trialID": trialID, "sequence": sequence,
        "autoFocus": autoFocus, "expected": expected, "valid": false]
      defer {
        observations.append(row.filter { $0.key != "firstDump" && $0.key != "settledDump" })
        attachJSON(row, name: "Pure RN \(arm) \(round) \(mode) \(trialID)")
      }
      if mode.hasPrefix("cold") {
        control.terminate()
        control.launchArguments = ["-RNKeyboardQAArm", arm,
          "-RNKeyboardQAAutoFocus", autoFocus ? "YES" : "NO",
          "-RNKeyboardQARunID", runID,
          "-AppleLanguages", "(en)", "-AppleLocale", "en_GB"]
        row["launchRequestedWallMs"] = Date().timeIntervalSince1970 * 1000
        control.launch()
        row["launchReturnedWallMs"] = Date().timeIntervalSince1970 * 1000
      } else {
        let previousID = "\(runID):\(arm):\(policy):\(sequence - 1)"
        guard json(control.staticTexts["rn-control-ready"])?["trialID"] as? String == previousID,
          control.buttons["Reset trial"].exists else {
          row["invalidReason"] = "Warm reset has no matching prior trial"; return
        }
        row["resetRequestedWallMs"] = Date().timeIntervalSince1970 * 1000
        control.buttons["Reset trial"].tap()
        row["resetReturnedWallMs"] = Date().timeIntervalSince1970 * 1000
      }
      let ready = control.staticTexts["rn-control-ready"]
      guard wait(10, {
        guard let meta = json(ready) else { return false }
        return meta["schemaVersion"] as? Int == 2 && meta["trialID"] as? String == trialID &&
          meta["runID"] as? String == runID && meta["arm"] as? String == arm &&
          meta["autoFocus"] as? Bool == autoFocus && meta["sequence"] as? Int == sequence &&
          meta["expectedText"] as? String == expected
      }) else {
        row["invalidReason"] = control.staticTexts["rn-control-invalid-config"].exists ?
          "Diagnostic launch configuration explicitly rejected" : "Fresh arm/policy/trial metadata not verified"
        return
      }
      let header = control.staticTexts["rn-control-header"]
      let expectedHeader = "RN keyboard control \(arm) \(policy) trial \(sequence) id \(trialID)"
      row["actualHeader"] = header.exists ? header.label : "<missing>"
      guard header.exists && header.label == expectedHeader else {
        row["invalidReason"] = "Rendered arm header mismatch"; return
      }
      let field = control.textFields["rn-control-subject"]
      guard field.waitForExistence(timeout: 10) else { row["invalidReason"] = "Missing fresh input"; return }
      let initial = field.value as? String ?? ""
      row["initialValue"] = initial
      guard initial.isEmpty || (initial == "Subject" && field.placeholderValue == "Subject") else {
        row["invalidReason"] = "Warm reset did not create an empty input"; return
      }
      row["configurationVerified"] = true
      row["fieldFrameBeforeTyping"] = rect(field.frame)
      row["keyboardBeforeTap"] = keyboardSnapshot()
      if !autoFocus {
        guard wait(10, { !keyboardVisible() }) else {
          row["invalidReason"] = "Tap-only input still has a visible keyboard before its tap"; return
        }
        row["keyboardHiddenBeforeTapWallMs"] = Date().timeIntervalSince1970 * 1000
        row["tapRequestedWallMs"] = Date().timeIntervalSince1970 * 1000
        field.tap()
        row["tapReturnedWallMs"] = Date().timeIntervalSince1970 * 1000
      }
      guard wait(10, keyboardVisible) else {
        row["invalidReason"] = "Software keyboard is not visibly inside the app before typing"; return
      }
      row["keyboardVisibleWallMs"] = Date().timeIntervalSince1970 * 1000
      row["keyboardBeforeTyping"] = keyboardSnapshot()
      row["appFrameBeforeTyping"] = rect(control.frame)
      row["typingStartedWallMs"] = Date().timeIntervalSince1970 * 1000
      field.typeText(expected)
      let typingReturned = Date().timeIntervalSince1970 * 1000
      row["typingReturnedWallMs"] = typingReturned
      row["immediateQueryStartedWallMs"] = Date().timeIntervalSince1970 * 1000
      let immediate = field.value as? String ?? "<missing>"
      row["immediate"] = immediate; row["immediateExact"] = immediate == expected
      row["immediateQueryReturnedWallMs"] = Date().timeIntervalSince1970 * 1000
      guard var captured = freshDump(trialID: trialID, after: 0) else {
        row["invalidReason"] = "No fresh, complete, matching JSON dump after typing"; return
      }
      row["firstDump"] = captured.0
      row["firstDumpRequestedWallMs"] = captured.2
      func quiet(_ snapshot: [String: Any], requestedAt: Double) -> Bool {
        guard requestedAt - typingReturned >= 500 else { return false }
        if let at = snapshot["capturedAtMs"] as? Double, let last = snapshot["lastInputAtMs"] as? Double { return at - last >= 500 }
        // No input delivered is a valid loss observation, not an excluded cell.
        return snapshot["lastInputAtMs"] is NSNull
      }
      let deadline = Date().addingTimeInterval(5)
      while Date() < deadline && !quiet(captured.0, requestedAt: captured.2) {
        guard let next = freshDump(trialID: trialID, after: captured.1) else {
          row["invalidReason"] = "Fresh settled dump failed validation"; return
        }
        captured = next
      }
      guard quiet(captured.0, requestedAt: captured.2), captured.0["arm"] as? String == arm,
        captured.0["autoFocus"] as? Bool == autoFocus,
        let events = captured.0["events"] as? [[String: Any]],
        let focusIndex = events.firstIndex(where: { $0["kind"] as? String == "focus" }) else {
        row["invalidReason"] = "Input did not reach quiescence with a fresh focus event"; return
      }
      let firstInput = events.firstIndex { ["key", "change", "onChangeText"].contains($0["kind"] as? String ?? "") }
      row["noInputEvents"] = firstInput == nil
      if let firstInput = firstInput, focusIndex > firstInput {
        row["invalidReason"] = "Fresh focus happened after input delivery"; return
      }
      let settled = field.value as? String ?? "<missing>"
      row["settled"] = settled; row["settledExact"] = settled == expected
      row["jsObservedText"] = captured.0["observedText"]
      let jsText = captured.0["observedText"] as? String
      row["jsNativeAgree"] = jsText == "<non-synthetic input omitted>" ? NSNull() : (jsText == settled) as Any
      row["settledDumpRequestedWallMs"] = captured.2
      row["settledDump"] = captured.0
      row["keyboardAfterTyping"] = keyboardSnapshot()
      row["valid"] = true
    }
    let arms = ["A", "B", "C", "D"]
    for round in 0..<rounds {
      for offset in 0..<arms.count {
        let arm = arms[(round + offset) % arms.count]
        let policies = offset % 2 == 0 ? ["auto", "tap"] : ["tap", "auto"]
        for policy in policies {
          let runID = UUID().uuidString
          cell(arm: arm, mode: "cold-\(policy)", round: round, runID: runID, sequence: 0)
          cell(arm: arm, mode: "warm-\(policy)", round: round, runID: runID, sequence: 1)
          control.terminate()
        }
      }
    }
    XCTAssertEqual(observations.filter { $0["valid"] as? Bool == true }.count, rounds * 16,
      "Some diagnostic cells failed readiness/dump integrity; inspect each row. Text exactness is an observation.")
  }

  func testUIKitKeyboardControl() throws {
    let control = XCUIApplication(bundleIdentifier: "pl.solvro.testownik.keyboardqa")
    var observations: [String] = []
    let expected = "Native QA diagnostic"
    for mode in ["bulk-1", "bulk-2", "bulk-3", "individual"] {
      control.launch()
      let field = control.textFields["control-subject"]
      XCTAssertTrue(field.waitForExistence(timeout: 10))
      XCTAssertTrue(control.keyboards.firstMatch.waitForExistence(timeout: 10))
      if mode == "individual" {
        for letter in expected { field.typeText(String(letter)) }
      } else { field.typeText(expected) }
      let actual = field.value as? String ?? "<missing>"
      let observation = "UIKit \(mode): expected=\(expected), actual=\(actual), exact=\(actual == expected), keyboard=\(control.keyboards.firstMatch.frame)"
      observations.append(observation)
      print(observation)
      let capture = XCTAttachment(screenshot: control.screenshot())
      capture.name = "UIKit keyboard control \(mode)"
      capture.lifetime = .keepAlways
      add(capture)
      control.terminate()
    }
    let report = XCTAttachment(string: observations.joined(separator: "\n"))
    report.name = "UIKit keyboard control values"
    report.lifetime = .keepAlways
    add(report)
  }

  func testSyntheticReviewsKeyboardAndAcknowledgements() throws {
    let library = app.buttons["Library"].firstMatch
    XCTAssertTrue(library.waitForExistence(timeout: 15)); library.tap()
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Native QA ")).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 15), "Run synthetic creation first so reviews target its disposable quiz")
    quiz.tap()
    let options = app.buttons["Quiz options"]
    XCTAssertTrue(options.waitForExistence(timeout: 15)); options.tap()
    app.buttons["Reviews & Comments"].tap()
    let field = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@", "Your comment")).firstMatch
    XCTAssertTrue(field.waitForExistence(timeout: 15), app.debugDescription)
    let comment = "Synthetic native review \(UUID().uuidString.prefix(8))"
    field.tap(); field.typeText(comment)
    XCTAssertEqual(field.value as? String, comment)
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    let post = app.buttons["Post comment"]
    // XCTest typing can transition between hardware/software keyboard frames.
    // Wait for settled reachability, and include the prediction bar in the bound.
    let reachable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in post.isHittable }, object: post)
    XCTAssertEqual(XCTWaiter.wait(for: [reachable], timeout: 10), .completed, "Posting must remain reachable after keyboard transitions settle")
    let predictions = app.otherElements.matching(identifier: "SystemInputAssistantView").firstMatch
    let keyboardTop = predictions.exists && predictions.frame.minY < app.keyboards.firstMatch.frame.minY
      ? predictions.frame.minY : app.keyboards.firstMatch.frame.minY
    XCTAssertLessThanOrEqual(post.frame.maxY, keyboardTop, "The comment composer must clear the keyboard including predictions")
    XCTAssertGreaterThanOrEqual(post.frame.width, 44, "Posting needs a full native touch target")
    XCTAssertGreaterThanOrEqual(post.frame.height, 44, "Posting needs a full native touch target")
    let keyboardCapture = XCTAttachment(screenshot: app.screenshot()); keyboardCapture.name = "Reviews software keyboard and composer"; keyboardCapture.lifetime = .keepAlways; add(keyboardCapture)
    // Exercise the expanded target near its left edge, not only its centre.
    post.coordinate(withNormalizedOffset: CGVector(dx: 0.08, dy: 0.5)).tap()
    XCTAssertTrue(app.staticTexts[comment].waitForExistence(timeout: 15), app.debugDescription)
    XCTAssertNotEqual(field.value as? String, comment, "The submitted draft should clear after acknowledgement")
    app.swipeDown()
    let rating = app.buttons["Rate 4 out of 5"]
    XCTAssertTrue(rating.isHittable); rating.tap()
    XCTAssertTrue(app.staticTexts["Your rating: 4/5"].waitForExistence(timeout: 10), app.debugDescription)
    let remove = app.buttons["Delete comment"].firstMatch
    XCTAssertTrue(remove.isHittable)
    XCTAssertGreaterThanOrEqual(remove.frame.width, 44)
    XCTAssertGreaterThanOrEqual(remove.frame.height, 44)
    remove.tap()
    let alert = app.alerts["Delete Comment?"]
    XCTAssertTrue(alert.waitForExistence(timeout: 5)); alert.buttons["Delete"].tap()
    let deleted = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: app.staticTexts[comment])
    XCTAssertEqual(XCTWaiter.wait(for: [deleted], timeout: 15), .completed)
  }

  func testProfilePhotoAndSettingsBrandingReview() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let attribution = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@ AND (label CONTAINS %@ OR label CONTAINS %@)", "Antoni Czaplicki", "Mobile app", "Aplikacja mobilna")).firstMatch
    for _ in 0..<12 {
      if attribution.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(attribution.isHittable, app.debugDescription)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Solvro")).firstMatch.exists)
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Actual Solvro logo and mobile attribution"
    capture.lifetime = .keepAlways
    add(capture)
    app.terminate(); app.launch()
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let photo = app.buttons.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "Zmień zdjęcie", "Change Photo")).firstMatch
    XCTAssertTrue(photo.waitForExistence(timeout: 10)); photo.tap()
    let gallery = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wybierz z Galerii", "Choose from Photos"])).firstMatch
    XCTAssertTrue(gallery.waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.isEnabled)
    let picker = XCTAttachment(screenshot: app.screenshot()); picker.name = "Native profile photo choices"; picker.lifetime = .keepAlways; add(picker)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.tap()
  }

  func testExistingQuizQuickActionsModelPickerReview() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Kontynuuj: ", "Continue: ")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 10)); resume.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Model AI", "AI Model"])).firstMatch.tap()
    let defaultModel = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@", "Domyślny", "Default", "Użyj ustawień nauki", "Use Study Settings")).firstMatch
    XCTAssertTrue(defaultModel.waitForExistence(timeout: 20), app.debugDescription)
    let modelList = XCTAttachment(screenshot: app.screenshot()); modelList.name = "Quiz AI model picker"; modelList.lifetime = .keepAlways; add(modelList)
    let closeModel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij wybór modelu", "Close model picker"])).firstMatch
    XCTAssertTrue(closeModel.waitForExistence(timeout: 10), app.debugDescription)
    closeModel.tap()
    let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
    XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
    let model = app.buttons.matching(NSPredicate(format: "label IN %@", ["Model AI", "AI Model"])).firstMatch
    XCTAssertTrue(model.waitForExistence(timeout: 10), app.debugDescription); model.tap()
    XCTAssertTrue(defaultModel.waitForExistence(timeout: 20), app.debugDescription)
    XCTAssertTrue(closeModel.waitForExistence(timeout: 10), app.debugDescription)
    closeModel.tap()
    let composer = app.descendants(matching: .any).matching(identifier: "assistant-composer").firstMatch
    XCTAssertTrue(composer.waitForExistence(timeout: 10), app.debugDescription)
    XCTAssertTrue(composer.isHittable)
    let assistantCapture = XCTAttachment(screenshot: app.screenshot()); assistantCapture.name = "Assistant with native model control"; assistantCapture.lifetime = .keepAlways; add(assistantCapture)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch.tap()
  }

  func testEditorNavigationLayout() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    let create = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowy quiz", "New Quiz"])).firstMatch
    XCTAssertTrue(create.waitForExistence(timeout: 5))
    create.tap()
    let title = app.textFields.matching(NSPredicate(format: "label IN %@", ["Tytuł quizu", "Quiz title"])).firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    try XCTSkipUnless(["", "Tytuł quizu", "Quiz title"].contains(title.value as? String ?? ""), "Preserve an existing editor draft")
    title.tap()
    title.typeText("Mobile editor UI fixture 0926")
    XCTAssertEqual(title.value as? String, "Mobile editor UI fixture 0926")
    let previous = app.buttons.matching(NSPredicate(format: "label IN %@", ["Poprzednie pytanie", "Previous Question"])).firstMatch
    let next = app.buttons.matching(NSPredicate(format: "label IN %@", ["Następne pytanie", "Next Question"])).firstMatch
    let addQuestion = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj pytanie", "Add Question"])).firstMatch
    for control in [previous, next, addQuestion] {
      XCTAssertTrue(control.exists)
      XCTAssertGreaterThanOrEqual(control.frame.width, 44)
      XCTAssertGreaterThanOrEqual(control.frame.height, 44)
      XCTAssertEqual(control.frame.width, control.frame.height, accuracy: 2)
    }
    XCTAssertFalse(previous.isEnabled)
    XCTAssertFalse(next.isEnabled)
    addQuestion.tap()
    XCTAssertTrue(previous.isEnabled)
    XCTAssertFalse(next.isEnabled)
    previous.tap()
    XCTAssertTrue(next.isEnabled)
    XCTAssertFalse(previous.isEnabled)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Editor persistent question navigation"
    screenshot.lifetime = .keepAlways
    add(screenshot)
  }

  func testEditorNavigationCompactAnswers() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    func openEditor() {
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowy quiz", "New Quiz"])).firstMatch.tap()
    }
    openEditor()
    let back = app.navigationBars.buttons.matching(NSPredicate(format: "label IN %@", ["Wstecz", "Back"])).firstMatch
    XCTAssertTrue(back.waitForExistence(timeout: 5), "The editor must expose its native back action")
    let title = app.textFields.matching(NSPredicate(format: "label IN %@", ["Tytuł quizu", "Quiz title"])).firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    try XCTSkipUnless(["", "Tytuł quizu", "Quiz title"].contains(title.value as? String ?? ""), "Preserve an existing new-quiz draft")
    title.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    title.typeText("Mobile compact editor fixture 0926")
    XCTAssertEqual(title.value as? String, "Mobile compact editor fixture 0926")
    let question = app.textViews.matching(NSPredicate(format: "label IN %@", ["Treść pytania", "Question text"])).firstMatch
    let questionText = "Which bit is set? Explain how the binary position changes its value when shifted left, and compare that operation with adding the same number to itself. Include enough context to distinguish the two examples without changing any answer text."
    question.tap(); question.typeText(questionText)
    XCTAssertEqual(question.value as? String, questionText)
    let grownQuestion = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in question.frame.height > 100 }, object: question)
    XCTAssertEqual(XCTWaiter.wait(for: [grownQuestion], timeout: 5), .completed)
    let first = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Odpowiedź 1", "Answer 1")).firstMatch
    for _ in 0..<3 { if first.isHittable { break }; app.swipeUp() }
    first.tap(); first.typeText("The first bit")
    let second = app.textViews.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Odpowiedź 2", "Answer 2")).firstMatch
    for _ in 0..<3 { if second.isHittable { break }; app.swipeUp() }
    second.tap()
    let typed = "Rapid typing stays intact. One answer can wrap across several lines without resetting the cursor or changing another answer."
    second.typeText(typed)
    XCTAssertEqual(second.value as? String, typed)
    Thread.sleep(forTimeInterval: 1)
    let typingCapture = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); typingCapture.name = "Long answer while typing"; typingCapture.lifetime = .keepAlways; add(typingCapture)
    let typingHierarchy = XCTAttachment(string: app.debugDescription); typingHierarchy.name = "Editor keyboard layout"; typingHierarchy.lifetime = .keepAlways; add(typingHierarchy)
    // XCTest reports the visible portion when a growing field meets the footer.
    // Scroll at the margin so this moves the form, not the nested text editor.
    if second.frame.height <= 60 {
      let form = app.scrollViews.firstMatch
      form.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.8)).press(forDuration: 0.1, thenDragTo: form.coordinate(withNormalizedOffset: CGVector(dx: 0.98, dy: 0.35)))
    }
    XCTAssertGreaterThan(second.frame.height, 60, "A multiline answer should grow while typing")
    let correct = app.buttons.matching(NSPredicate(format: "label IN %@", ["Poprawna odpowiedź 2", "Correct answer 2"])).firstMatch
    for _ in 0..<3 {
      if correct.isHittable { break }
      if correct.frame.minY < 116 { app.scrollViews.firstMatch.swipeDown() }
      else { app.scrollViews.firstMatch.swipeUp() }
    }
    XCTAssertTrue(correct.isHittable); correct.tap()
    let checked = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value IN %@", ["Yes", "Tak"]), object: correct)
    XCTAssertEqual(XCTWaiter.wait(for: [checked], timeout: 5), .completed)
    let save = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zapisz quiz", "Save Quiz"])).firstMatch
    XCTAssertTrue(save.isHittable); XCTAssertTrue(save.isEnabled)
    second.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    XCTAssertLessThanOrEqual(save.frame.maxY, app.keyboards.firstMatch.frame.minY)
    Thread.sleep(forTimeInterval: 1)
    let capture = XCTAttachment(screenshot: XCUIScreen.main.screenshot()); capture.name = "Compact answer editing above keyboard"; capture.lifetime = .keepAlways; add(capture)
    let addQuestion = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj pytanie", "Add Question"])).firstMatch
    XCTAssertTrue(addQuestion.isHittable); addQuestion.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Poprzednie pytanie", "Previous Question"])).firstMatch.tap()
    XCTAssertEqual(first.value as? String, "The first bit")
    XCTAssertEqual(second.value as? String, typed)
    back.tap()
    openEditor()
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    XCTAssertEqual(title.value as? String, "Mobile compact editor fixture 0926")
    XCTAssertEqual(second.value as? String, typed)
    let restored = XCTAttachment(screenshot: app.screenshot()); restored.name = "Compact editor draft restored"; restored.lifetime = .keepAlways; add(restored)
    // Leave the unsaved task fixture for guarded cleanup; never press Save on the personal database.
    back.tap()
  }

  func testImportPreviewLayout() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Importuj quiz", "Import Quiz"])).firstMatch.tap()
    let paste = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wklej JSON", "Paste JSON"])).firstMatch
    XCTAssertTrue(paste.waitForExistence(timeout: 8)); paste.tap()
    let input = app.textViews.matching(NSPredicate(format: "label IN %@", ["JSON quizu", "Quiz JSON"])).firstMatch
    XCTAssertTrue(input.waitForExistence(timeout: 5)); input.tap()
    input.typeText(#"{"title":"Native import preview","questions":[{"text":"Preview question","answers":[{"text":"Yes","is_correct":true},{"text":"No","is_correct":false}]}]}"#)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Sprawdź quiz", "Preview Quiz"])).firstMatch.tap()
    XCTAssertTrue(element("Native import preview").waitForExistence(timeout: 8))
    XCTAssertTrue(element("Preview question").exists)
    let save = app.buttons.matching(NSPredicate(format: "label IN %@", ["Importuj i rozpocznij naukę", "Import and Start Studying"])).firstMatch
    XCTAssertTrue(save.exists); XCTAssertTrue(save.isHittable)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native import preview before creation"; capture.lifetime = .keepAlways; add(capture)
    // Inspect a temporary in-memory preview only; never create a quiz in the personal database.
  }

  func testImportPreviewDocumentPicker() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Importuj quiz", "Import Quiz"])).firstMatch.tap()
    let choose = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wybierz plik", "Choose File"])).firstMatch
    XCTAssertTrue(choose.waitForExistence(timeout: 8)); choose.tap()
    let browse = app.buttons.matching(NSPredicate(format: "label IN %@", ["Browse", "Przeglądaj"])).firstMatch
    XCTAssertTrue(browse.waitForExistence(timeout: 20), app.debugDescription); browse.tap()
    let local = app.descendants(matching: .any).matching(NSPredicate(format: "label IN %@", ["On My iPhone", "Na moim iPhonie"])).firstMatch
    XCTAssertTrue(local.waitForExistence(timeout: 10), app.debugDescription); local.tap()
    let hierarchy = XCTAttachment(string: app.debugDescription); hierarchy.name = "Import document picker hierarchy"; hierarchy.lifetime = .keepAlways; add(hierarchy)
    let fixture = app.descendants(matching: .any).matching(NSPredicate(format: "label BEGINSWITH %@", "Testownik import fixture 0926")).firstMatch
    XCTAssertTrue(fixture.waitForExistence(timeout: 8), app.debugDescription); fixture.tap()
    XCTAssertTrue(element("Native archive question").waitForExistence(timeout: 10), app.debugDescription)
    let save = app.buttons.matching(NSPredicate(format: "label IN %@", ["Importuj i rozpocznij naukę", "Import and Start Studying"])).firstMatch
    XCTAssertTrue(save.isHittable)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native ZIP picker preview"; capture.lifetime = .keepAlways; add(capture)
    // Creation is opt-in and requires the snapshot/cleanup workflow for this exact fixture.
    if ProcessInfo.processInfo.environment["TESTOWNIK_IMPORT_FIXTURE"] == "1" {
      save.tap()
      let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
      XCTAssertTrue(options.waitForExistence(timeout: 30), app.debugDescription)
      XCTAssertTrue(element("Testownik import fixture 0926").exists)
      let showImages = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wczytaj obrazy w tej sesji", "Show images in this session"])).firstMatch
      XCTAssertFalse(showImages.exists, "Uploaded quiz images should load automatically")
      let image = app.images.matching(NSPredicate(format: "label IN %@", ["Ilustracja pytania", "Question image"])).firstMatch
      XCTAssertTrue(image.waitForExistence(timeout: 10), app.debugDescription)
      Thread.sleep(forTimeInterval: 1)
      let imported = XCTAttachment(screenshot: app.screenshot()); imported.name = "Native imported ZIP quiz"; imported.lifetime = .keepAlways; add(imported)
      let back = app.navigationBars.buttons.element(boundBy: 0)
      XCTAssertTrue(back.isHittable); back.tap()
      XCTAssertTrue(app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.waitForExistence(timeout: 10))
    }
  }

  func testExistingQuizQuickActionsAssistantContext() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
    XCTAssertTrue(assistant.waitForExistence(timeout: 10))
    let answerIds = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@", "study-answer-")).allElementsBoundByIndex.sorted { $0.frame.minY < $1.frame.minY }.map { String($0.identifier.dropFirst("study-answer-".count)) }
    XCTAssertGreaterThanOrEqual(answerIds.count, 2)
    assistant.tap()
    let composer = app.textViews["assistant-composer"]
    XCTAssertTrue(composer.waitForExistence(timeout: 10))
    let initial = XCTAttachment(screenshot: app.screenshot()); initial.name = "Assistant contextual start"; initial.lifetime = .keepAlways; add(initial)
    composer.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    let send = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij wiadomość", "Send message"])).firstMatch
    XCTAssertTrue(send.isHittable)
    XCTAssertLessThanOrEqual(send.frame.maxY, app.keyboards.firstMatch.frame.minY)
    let guide = app.buttons.matching(NSPredicate(format: "label IN %@", ["Naprowadź mnie na rozwiązanie", "Guide Me Through It"])).firstMatch
    XCTAssertTrue(guide.isHittable, "First-turn actions remain visible above the context and keyboard")
    let keyboard = XCTAttachment(screenshot: app.screenshot()); keyboard.name = "Assistant context above keyboard"; keyboard.lifetime = .keepAlways; add(keyboard)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch.tap()
    XCTAssertTrue(assistant.waitForExistence(timeout: 10))
  }

  func testExistingQuizQuickActionsAssistantLiveConversation() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_LIVE_AI"] == "1", "Live verification requires approved key reuse")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
    XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
    let composer = app.textViews["assistant-composer"]
    XCTAssertTrue(composer.waitForExistence(timeout: 10))
    let starter = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyjaśnij pojęcie", "Explain the Concept"])).firstMatch
    try XCTSkipUnless(starter.waitForExistence(timeout: 5), "Preserve an existing conversation")
    let emptyValues = ["", "Ask about this question…", "Zapytaj o to pytanie…"]
    try XCTSkipUnless(emptyValues.contains(composer.value as? String ?? ""), "Preserve an existing draft")
    composer.tap(); composer.typeText("Explain the concept behind this question in two short sentences. Do not reveal the answer.")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij wiadomość", "Send message"])).firstMatch.tap()
    let newChat = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowa rozmowa", "New Conversation"])).firstMatch
    XCTAssertTrue(newChat.waitForExistence(timeout: 90), "A nonempty response must commit before the new-conversation action appears")
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: newChat)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch
    close.tap(); XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
    XCTAssertTrue(newChat.waitForExistence(timeout: 10), "Successful exchange survives reopening")
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Live assistant conversation restored"; capture.lifetime = .keepAlways; add(capture)
    // Earlier conversations stay in history, so a new one starts without a confirmation.
    newChat.tap()
    XCTAssertTrue(starter.waitForExistence(timeout: 10))
    close.tap()
  }

  func testExistingQuizQuickActionsAssistantLivePractice() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_LIVE_AI"] == "1", "Live verification requires approved key reuse")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
    XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
    let composer = app.textViews["assistant-composer"]
    XCTAssertTrue(composer.waitForExistence(timeout: 10))
    let starter = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyjaśnij pojęcie", "Explain the Concept"])).firstMatch
    let testPrompt = "Use generate_practice_questions to create one very short English practice question about binary numbers, with two answer options and a one-sentence explanation. Do not print the correct answer outside the exercise."
    if ProcessInfo.processInfo.environment["TESTOWNIK_RESUME_PRACTICE"] == "1" {
      XCTAssertTrue(element(testPrompt).waitForExistence(timeout: 10), "Resume only the exact exchange created by the prior test")
    } else {
      try XCTSkipUnless(starter.waitForExistence(timeout: 5), "Preserve an existing conversation")
      try XCTSkipUnless(["", "Ask about this question…", "Zapytaj o to pytanie…"].contains(composer.value as? String ?? ""), "Preserve an existing draft")
      composer.tap(); composer.typeText(testPrompt)
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij wiadomość", "Send message"])).firstMatch.tap()
    }
    let newChat = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowa rozmowa", "New Conversation"])).firstMatch
    XCTAssertTrue(newChat.waitForExistence(timeout: 90))
    let ready = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: newChat)
    XCTAssertEqual(XCTWaiter.wait(for: [ready], timeout: 15), .completed)
    let exercise = app.otherElements["assistant-practice"]
    XCTAssertTrue(exercise.waitForExistence(timeout: 10), "The server tool result must render as a native exercise")
    let conversation = app.scrollViews.containing(.any, identifier: "assistant-practice").firstMatch
    XCTAssertTrue(conversation.exists)
    let check = conversation.buttons.matching(NSPredicate(format: "label IN %@", ["Sprawdź", "Check"])).firstMatch
    for _ in 0..<4 { if check.isHittable && check.frame.maxY <= composer.frame.minY - 12 { break }; conversation.swipeUp() }
    XCTAssertLessThanOrEqual(check.frame.maxY, composer.frame.minY - 12, "Exercise actions must scroll fully above the fixed composer")
    XCTAssertFalse(check.isEnabled)
    let answer = conversation.descendants(matching: .any)["practice-answer-0"].firstMatch
    if !answer.isHittable { conversation.swipeDown() }
    XCTAssertTrue(answer.isHittable); answer.tap()
    let selected = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: check)
    let tapCapture = XCTAttachment(screenshot: app.screenshot()); tapCapture.name = "Practice after selection"; tapCapture.lifetime = .keepAlways; add(tapCapture)
    let tree = XCTAttachment(string: app.debugDescription); tree.name = "Practice hierarchy after selection"; tree.lifetime = .keepAlways; add(tree)
    XCTAssertEqual(XCTWaiter.wait(for: [selected], timeout: 5), .completed)
    let questionCapture = XCTAttachment(screenshot: app.screenshot()); questionCapture.name = "Live native AI practice question"; questionCapture.lifetime = .keepAlways; add(questionCapture)
    check.tap()
    let retry = conversation.buttons.matching(NSPredicate(format: "label IN %@", ["Spróbuj ponownie", "Try Again"])).firstMatch
    XCTAssertTrue(retry.waitForExistence(timeout: 5))
    let feedbackCapture = XCTAttachment(screenshot: app.screenshot()); feedbackCapture.name = "Live native AI practice feedback"; feedbackCapture.lifetime = .keepAlways; add(feedbackCapture)
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch
    close.tap(); XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
    XCTAssertTrue(exercise.waitForExistence(timeout: 10), "Tool results survive reopening")
    // Only the exchange created from the verified empty initial conversation is removed.
    newChat.tap(); app.alerts.buttons.matching(NSPredicate(format: "label IN %@", ["Potwierdź", "Confirm"])).firstMatch.tap()
    XCTAssertTrue(starter.waitForExistence(timeout: 10)); close.tap()
  }

  func testExistingQuizQuickActionsSharingPicker() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Udostępnij", "Share"])).firstMatch.tap()
    let picker = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zmień widoczność", "Change Visibility"])).firstMatch
    XCTAssertTrue(picker.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(picker.frame.height, 44)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Sharing native visibility picker"; capture.lifetime = .keepAlways; add(capture)
    picker.tap()
    let privateOption = app.buttons.matching(NSPredicate(format: "label IN %@", ["Prywatny", "Private"])).firstMatch
    XCTAssertTrue(privateOption.waitForExistence(timeout: 5)); privateOption.tap()
    let alert = app.alerts.firstMatch
    if alert.waitForExistence(timeout: 2) {
      alert.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.tap()
    }
    XCTAssertTrue(picker.waitForExistence(timeout: 5))
    let invite = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj osoby lub grupy", "Add people or groups"])).firstMatch
    XCTAssertTrue(invite.isHittable, "Invitation action precedes the full access list")
    invite.tap()
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij zapraszanie", "Close invitations"])).firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 5)); close.tap()
    app.navigationBars.buttons.element(boundBy: 0).tap()
    XCTAssertTrue(options.waitForExistence(timeout: 10))
  }

  func testExistingQuizQuickActionsUXAudit() throws {
    func capture(_ name: String) {
      Thread.sleep(forTimeInterval: 0.7)
      let image = XCTAttachment(screenshot: app.screenshot())
      image.name = name; image.lifetime = .keepAlways; add(image)
    }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
    XCTAssertTrue(assistant.waitForExistence(timeout: 10)); capture("Study before iteration")
    assistant.tap()
    let composer = app.textViews["assistant-composer"]
    XCTAssertTrue(composer.waitForExistence(timeout: 10)); capture("Assistant before iteration")
    composer.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5)); capture("Assistant keyboard before iteration")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Udostępnij", "Share"])).firstMatch.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij link", "Share Link"])).firstMatch.waitForExistence(timeout: 10))
    capture("Sharing before iteration")
    app.navigationBars.buttons.element(boundBy: 0).tap()
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    app.navigationBars.buttons.element(boundBy: 0).tap()
    XCTAssertTrue(quiz.waitForExistence(timeout: 10))
  }

  func testExistingQuizQuickActionsCircularMenusAndLiveHint() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_LIVE_AI"] == "1", "Requires explicit live provider verification authorization")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let addButton = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch
    XCTAssertTrue(addButton.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(addButton.frame.width, 44)
    XCTAssertGreaterThanOrEqual(addButton.frame.height, 44)
    XCTAssertEqual(addButton.frame.width, addButton.frame.height, accuracy: 2)
    let libraryCapture = XCTAttachment(screenshot: app.screenshot()); libraryCapture.name = "Circular library add control"; libraryCapture.lifetime = .keepAlways; add(libraryCapture)
    addButton.tap()
    let importButton = app.buttons.matching(NSPredicate(format: "label IN %@", ["Importuj quiz", "Import Quiz"])).firstMatch
    XCTAssertTrue(importButton.waitForExistence(timeout: 5)); importButton.tap()
    XCTAssertTrue(app.navigationBars.buttons.element(boundBy: 0).waitForExistence(timeout: 10))
    app.navigationBars.buttons.element(boundBy: 0).tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    XCTAssertEqual(options.frame.width, options.frame.height, accuracy: 2)
    options.tap()
    let history = app.buttons.matching(NSPredicate(format: "label IN %@", ["Historia odpowiedzi", "Answer History"])).firstMatch
    XCTAssertTrue(history.waitForExistence(timeout: 5)); history.tap()
    XCTAssertTrue(app.navigationBars.buttons.element(boundBy: 0).waitForExistence(timeout: 10)); app.navigationBars.buttons.element(boundBy: 0).tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Podpowiedź AI", "AI Hint"])).firstMatch.tap()
    XCTAssertTrue(app.otherElements["hint-response"].waitForExistence(timeout: 90), "Live provider must return nonempty rendered text")
    let preparing = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Przygotowuję odpowiedź…", "Preparing a response…"])).firstMatch
    let complete = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: preparing)
    XCTAssertEqual(XCTWaiter.wait(for: [complete], timeout: 90), .completed)
    let readable = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      self.app.otherElements["hint-response"].label.count > 20 && !self.app.otherElements["hint-response"].label.contains("<hint") && !self.app.otherElements["hint-response"].label.contains("<general_hint")
    }, object: app)
    XCTAssertEqual(XCTWaiter.wait(for: [readable], timeout: 15), .completed, "The response must contain visible native or WebView text, not merely an empty container")
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Live native AI hint"; capture.lifetime = .keepAlways; add(capture)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij podpowiedź", "Close hint"])).firstMatch.tap()
  }

  func testExistingQuizQuickActionsEditorFocus() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let edit = app.buttons.matching(NSPredicate(format: "label IN %@", ["Edytuj to pytanie", "Edit This Question"])).firstMatch
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(edit.frame.width, 44); XCTAssertGreaterThanOrEqual(edit.frame.height, 44)
    XCTAssertEqual(edit.frame.width, edit.frame.height, accuracy: 2)
    Thread.sleep(forTimeInterval: 1)
    let action = XCTAttachment(screenshot: app.screenshot()); action.name = "Study edit quick action"; action.lifetime = .keepAlways; add(action)
    edit.tap()
    let field = app.textViews.matching(NSPredicate(format: "label IN %@", ["Treść pytania", "Question text"])).firstMatch
    XCTAssertTrue(field.waitForExistence(timeout: 15))
    XCTAssertEqual(field.value as? String, ProcessInfo.processInfo.environment["TESTOWNIK_FOCUS_QUESTION_TEXT"])
    Thread.sleep(forTimeInterval: 1)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Editor opens the active question"; capture.lifetime = .keepAlways; add(capture)
    app.navigationBars.buttons.element(boundBy: 0).tap()
    XCTAssertTrue(edit.waitForExistence(timeout: 10))
  }

  func testExistingQuizQuickActionsHistory() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Historia odpowiedzi", "Answer History"])).firstMatch.tap()
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@", "Correct:", "Incorrect:", "Poprawnie:", "Niepoprawnie:")).firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 15))
    let newest = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_HISTORY_FIRST_QUESTION"])
    XCTAssertTrue(row.label.hasSuffix(newest), "Newest history row must match the independent database record")
    row.tap()
    let correct = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "Correct answer", "Poprawna odpowiedź")).firstMatch
    XCTAssertTrue(correct.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 2)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native answer history review"; capture.lifetime = .keepAlways; add(capture)
    app.navigationBars.buttons.element(boundBy: 0).tap()
    XCTAssertTrue(options.waitForExistence(timeout: 10))
  }

  func testExistingQuizQuickActionsUnavailableBackend() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_UNAVAILABLE_BACKEND"] == "1", "Requires a release bundle pointed at a verified unused local port.")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    let saved = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zapisane offline", "Saved Offline"])).firstMatch
    for _ in 0..<8 {
      if saved.exists && saved.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(saved.isHittable, "Downloaded quizzes must remain reachable when the server is unavailable")
    saved.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let check = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sprawdź", "Check"])).firstMatch
    XCTAssertTrue(check.waitForExistence(timeout: 20), "Cached study content should open without the API")
    let study = XCTAttachment(screenshot: app.screenshot()); study.name = "Saved quiz with unavailable API"; study.lifetime = .keepAlways; add(study)
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Historia odpowiedzi", "Answer History"])).firstMatch.tap()
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@", "Correct:", "Incorrect:", "Poprawnie:", "Niepoprawnie:")).firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 20), "Saved session history must survive an unavailable API")
    row.tap()
    let history = XCTAttachment(screenshot: app.screenshot()); history.name = "Saved answer history with unavailable API"; history.lifetime = .keepAlways; add(history)
    // Read-only: deliberately never select or submit an answer.
  }

  func testExistingQuizQuickActionsReviews() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let title = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Opinie i komentarze", "Reviews & Comments"])).firstMatch.tap()
    // Tapping a star saves at once; this test uses a personal account, so it only
    // inspects the controls and never taps a star.
    XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label IN %@", ["Zapisz ocenę", "Save rating"])).firstMatch.exists)
    for n in 1...5 {
      let star = app.buttons.matching(NSPredicate(format: "label IN %@", ["Ocena \(n) z 5", "Rate \(n) out of 5"])).firstMatch
      XCTAssertTrue(star.waitForExistence(timeout: 10))
      XCTAssertGreaterThanOrEqual(star.frame.width, 44)
      XCTAssertGreaterThanOrEqual(star.frame.height, 44)
    }
    let screenshot = XCTAttachment(screenshot: app.screenshot()); screenshot.name = "Native quiz reviews"; screenshot.lifetime = .keepAlways; add(screenshot)
    let back = app.navigationBars.buttons.matching(NSPredicate(format: "label IN %@", ["Back", "Wstecz"])).firstMatch
    XCTAssertTrue(back.exists); back.tap()
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    // No save, comment or delete: the personal account remains unchanged.
  }

  func testExistingQuizQuickActionsSearch() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let quizTitle = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", quizTitle)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Szukaj w pytaniach", "Search Questions"])).firstMatch.tap()
    let search = app.searchFields.matching(NSPredicate(format: "placeholderValue IN %@", ["Pytanie, odpowiedź lub wyjaśnienie", "Question, answer or explanation"])).firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 10)); search.tap(); search.typeText("Zenera")
    let result = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Zenera")).firstMatch
    XCTAssertTrue(result.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 1)
    let searching = XCTAttachment(screenshot: app.screenshot()); searching.name = "Native question search and keyboard"; searching.lifetime = .keepAlways; add(searching)
    result.tap()
    let keyboardClosed = NSPredicate(format: "exists == false")
    expectation(for: keyboardClosed, evaluatedWith: app.keyboards.firstMatch)
    waitForExpectations(timeout: 5)
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label IN %@", ["✓ Poprawna odpowiedź", "✓ Correct answer"])).firstMatch.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 2)
    let expanded = XCTAttachment(screenshot: app.screenshot()); expanded.name = "Expanded question search result"; expanded.lifetime = .keepAlways; add(expanded)
    search.tap(); search.typeText(" qqqnomatchzz")
    let clear = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyczyść wyszukiwanie", "Clear Search"])).firstMatch
    XCTAssertTrue(clear.waitForExistence(timeout: 10)); clear.tap()
    XCTAssertFalse(clear.exists)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Question 1:", "Pytanie 1:")).firstMatch.waitForExistence(timeout: 10))
  }

  func testSharingAndAccountLayoutNavigation() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let quizTitle = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"])
    let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", quizTitle)).firstMatch
    XCTAssertTrue(row.waitForExistence(timeout: 10)); row.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    // Capture a settled navigation bar, not the initial push-animation frame.
    Thread.sleep(forTimeInterval: 1)
    let initial = XCTAttachment(screenshot: app.screenshot()); initial.name = "Settled study header"; initial.lifetime = .keepAlways; add(initial)
    options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Udostępnij", "Share"])).firstMatch.tap()
    let share = app.buttons.matching(NSPredicate(format: "label IN %@", ["Udostępnij link", "Share Link"])).firstMatch
    XCTAssertTrue(share.waitForExistence(timeout: 10))
    let back = app.navigationBars.buttons.element(boundBy: 0)
    XCTAssertTrue(back.isHittable); back.tap()
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 1)
    let returned = XCTAttachment(screenshot: app.screenshot()); returned.name = "Study header after returning from sharing"; returned.lifetime = .keepAlways; add(returned)
    XCTAssertTrue(back.isHittable); back.tap()
    XCTAssertTrue(row.waitForExistence(timeout: 10))
  }

  func testSharingAndAccountLayout() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let account = app.buttons.matching(NSPredicate(format: "label IN %@", ["Konto i prywatność", "Account & Privacy"])).firstMatch
    XCTAssertTrue(account.waitForExistence(timeout: 8)); account.tap()
    let privacy = app.switches.matching(NSPredicate(format: "label IN %@", ["Ukryj profil", "Hide Profile"])).firstMatch
    XCTAssertTrue(privacy.waitForExistence(timeout: 8))
    let accountCapture = XCTAttachment(screenshot: app.screenshot()); accountCapture.name = "Bilingual native account controls"; accountCapture.lifetime = .keepAlways; add(accountCapture)
    app.navigationBars.buttons.element(boundBy: 0).tap()
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let quizTitle = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_SHARE_QUIZ_TITLE"], "Select an existing quiz for read-only share layout verification")
    let quiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", quizTitle)).firstMatch
    XCTAssertTrue(quiz.waitForExistence(timeout: 10)); quiz.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10)); options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Udostępnij", "Share"])).firstMatch.tap()
    let share = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij link", "Share Link"])).firstMatch
    XCTAssertTrue(share.waitForExistence(timeout: 10)); XCTAssertTrue(share.isHittable)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native sharing overview"; capture.lifetime = .keepAlways; add(capture)
    share.tap()
    let copyAction = app.descendants(matching: .any).matching(NSPredicate(format: "label IN %@", ["Copy", "Kopiuj"])).firstMatch
    XCTAssertTrue(copyAction.waitForExistence(timeout: 10), app.debugDescription)
    let system = XCTAttachment(screenshot: app.screenshot()); system.name = "System share sheet opened without sending"; system.lifetime = .keepAlways; add(system)
    let hierarchy = XCTAttachment(string: app.debugDescription); hierarchy.name = "System share hierarchy"; hierarchy.lifetime = .keepAlways; add(hierarchy)
    // No recipient, activity or permission mutation is selected.
  }

  func testEditorQuestionOverview() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    let create = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowy quiz", "New Quiz"])).firstMatch
    XCTAssertTrue(create.waitForExistence(timeout: 5)); create.tap()
    let title = app.textFields.matching(NSPredicate(format: "label IN %@", ["Tytuł quizu", "Quiz title"])).firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    try XCTSkipUnless(["", "Tytuł quizu", "Quiz title"].contains(title.value as? String ?? ""), "Preserve an existing draft")
    title.tap(); title.typeText("Mobile overview fixture 0926")
    let addQuestion = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj pytanie", "Add Question"])).firstMatch
    addQuestion.tap(); addQuestion.tap()
    let overview = app.buttons.matching(NSPredicate(format: "label IN %@", ["Pytanie 3 z 3", "Question 3 of 3"])).firstMatch
    XCTAssertTrue(overview.exists); overview.tap()
    let table = app.tables.firstMatch
    XCTAssertTrue(table.waitForExistence(timeout: 5))
    XCTAssertEqual(table.cells.count, 3)
    table.cells.element(boundBy: 0).tap()
    let first = app.buttons.matching(NSPredicate(format: "label IN %@", ["Pytanie 1 z 3", "Question 1 of 3"])).firstMatch
    XCTAssertTrue(first.waitForExistence(timeout: 5)); first.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zmień kolejność", "Reorder"])).firstMatch.tap()
    let source = table.cells.element(boundBy: 0)
    let destination = table.cells.element(boundBy: 2)
    let firstId = source.identifier
    source.coordinate(withNormalizedOffset: CGVector(dx: 0.94, dy: 0.5)).press(forDuration: 0.6, thenDragTo: destination.coordinate(withNormalizedOffset: CGVector(dx: 0.94, dy: 0.9)), withVelocity: .slow, thenHoldForDuration: 0.4)
    XCTAssertEqual(table.cells.element(boundBy: 2).identifier, firstId, app.debugDescription)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native question overview after reorder"; capture.lifetime = .keepAlways; add(capture)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Gotowe", "Done"])).firstMatch.tap()
    XCTAssertTrue(overview.waitForExistence(timeout: 5), "Keep the same question selected after a move")
  }

  func testEditorImagePicker() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    let create = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowy quiz", "New Quiz"])).firstMatch
    XCTAssertTrue(create.waitForExistence(timeout: 5))
    create.tap()
    let title = app.textFields.matching(NSPredicate(format: "label IN %@", ["Tytuł quizu", "Quiz title"])).firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 10))
    let initialTitle = title.value as? String ?? ""
    try XCTSkipUnless(["", "Tytuł quizu", "Quiz title", "Mobile image UI fixture 0926"].contains(initialTitle), "Preserve an existing editor draft")
    if initialTitle != "Mobile image UI fixture 0926" {
      title.tap()
      title.typeText("Mobile image UI fixture 0926")
    }
    XCTAssertEqual(title.value as? String, "Mobile image UI fixture 0926")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje pytania", "Question options"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj zdjęcie pytania", "Add Question Image"])).firstMatch.tap()
    let cancel = app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch
    XCTAssertTrue(cancel.waitForExistence(timeout: 15))
    let fixtureLabel = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_PHOTO_FIXTURE_LABEL"], "Select only the inspected test photo")
    let fixture = app.images[fixtureLabel]
    let loaded = fixture.waitForExistence(timeout: 30)
    let screenshot = XCTAttachment(screenshot: app.screenshot())
    screenshot.name = "Native image picker fixture inspection"
    screenshot.lifetime = .keepAlways
    add(screenshot)
    let hierarchy = XCTAttachment(string: app.debugDescription)
    hierarchy.name = "Native image picker hierarchy"
    hierarchy.lifetime = .keepAlways
    add(hierarchy)
    XCTAssertTrue(loaded, "The native photo picker must load the inspected fixture")
    fixture.tap()
    let preview = app.images.matching(NSPredicate(format: "label IN %@", ["Ilustracja pytania", "Question image"])).firstMatch
    XCTAssertTrue(preview.waitForExistence(timeout: 30), app.debugDescription)
    let upload = XCTAttachment(screenshot: app.screenshot())
    upload.name = "Native uploaded image preview"
    upload.lifetime = .keepAlways
    add(upload)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Usuń obraz", "Remove Image"])).firstMatch.tap()
    XCTAssertFalse(preview.exists)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Zapisz quiz", "Save Quiz"])).firstMatch.isEnabled)
  }

  func testProfilePhotoAndSettingsPolishLight() throws {
    let original = try XCTUnwrap(ProcessInfo.processInfo.environment["TESTOWNIK_RESTORE_LANGUAGE"])
    func chooseLanguage(_ value: String) {
      app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
      let language = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Language", "Język")).firstMatch
      XCTAssertTrue(language.waitForExistence(timeout: 10), app.debugDescription)
      if !language.isHittable { app.swipeUp() }
      language.tap()
      let labels = value == "system" ? ["System Default", "Jak w systemie"] : [value == "pl" ? "Polski" : "English"]
      let choice = app.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch
      XCTAssertTrue(choice.waitForExistence(timeout: 5), app.debugDescription); choice.tap()
    }
    chooseLanguage(original)
    chooseLanguage("pl")
    defer {
      app.terminate(); app.launch()
      XCTAssertTrue(app.tabBars.buttons["Profil"].waitForExistence(timeout: 30))
      chooseLanguage(original)
    }
    XCTAssertTrue(app.tabBars.buttons["Profil"].waitForExistence(timeout: 10))
    XCTAssertTrue(app.tabBars.buttons["Profil"].isSelected, "Changing language must keep the current tab selected")
    for title in ["Nauka", "Biblioteka", "Oceny", "Profil"] { XCTAssertTrue(app.tabBars.buttons[title].exists) }
    Thread.sleep(forTimeInterval: 1)
    let profile = XCTAttachment(screenshot: app.screenshot()); profile.name = "Polish light profile"; profile.lifetime = .keepAlways; add(profile)
    try testExistingQuizQuickActionsSearch()
  }

  func testProfilePhotoAndSettingsNotifications() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let notifications = app.buttons.matching(NSPredicate(format: "label IN %@", ["Powiadomienia", "Notifications"])).firstMatch
    XCTAssertTrue(notifications.waitForExistence(timeout: 10)); notifications.tap()
    let loaded = app.staticTexts.matching(NSPredicate(format: "label IN %@ OR label BEGINSWITH %@ OR label BEGINSWITH %@", ["Nie masz jeszcze powiadomień", "No Notifications Yet", "Wszystko przeczytane", "All caught up"], "Unread: ", "Nieprzeczytane: ")).firstMatch
    XCTAssertTrue(loaded.waitForExistence(timeout: 15), app.debugDescription)
    if let body = ProcessInfo.processInfo.environment["TESTOWNIK_NOTIFICATION_BODY"] {
      let content = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@ OR value == %@", body, body)).firstMatch
      XCTAssertTrue(content.waitForExistence(timeout: 10), "The notification message must be rendered, not only its card header")
    }
    Thread.sleep(forTimeInterval: 1)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native notifications inbox"; capture.lifetime = .keepAlways; add(capture)
    // Read-only: never mark real user notifications as read/unread in this test.
  }

  func testProfilePhotoAndSettings() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let changePhoto = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zmień zdjęcie", "Change Photo"])).firstMatch
    XCTAssertTrue(changePhoto.waitForExistence(timeout: 10))
    changePhoto.tap()
    let library = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wybierz z biblioteki zdjęć", "Choose from photo library"])).firstMatch
    XCTAssertTrue(library.waitForExistence(timeout: 10))
    let photo = XCTAttachment(screenshot: app.screenshot())
    photo.name = "Native profile photo choices"
    photo.lifetime = .keepAlways
    add(photo)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Ustawienia nauki", "Study Settings")).firstMatch.tap()
    XCTAssertTrue(app.steppers.firstMatch.waitForExistence(timeout: 10))
    let settings = XCTAttachment(screenshot: app.screenshot())
    settings.name = "Native settings steppers"
    settings.lifetime = .keepAlways
    add(settings)
  }

  func testProfilePhotoAndSettingsAccessibility() throws {
    guard #available(iOS 17.0, *) else { throw XCTSkip("Apple accessibility audits require iOS 17 or newer") }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Ustawienia nauki", "Study Settings")).firstMatch.tap()
    XCTAssertTrue(app.sliders.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
    var issues: [String] = []
    for position in ["Repetition controls", "Notification controls"] {
      try app.performAccessibilityAudit(for: [.hitRegion, .sufficientElementDescription, .textClipped, .trait]) { issue in
        issues.append("\(position): \(issue.compactDescription) — \(issue.detailedDescription) — \(issue.element?.debugDescription ?? "no element")")
        return true
      }
      let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Settings accessibility: \(position)"; capture.lifetime = .keepAlways; add(capture)
      app.swipeUp()
    }
    let report = XCTAttachment(string: issues.joined(separator: "\n\n")); report.name = "Settings accessibility audit"; report.lifetime = .keepAlways; add(report)
    XCTAssertTrue(issues.isEmpty, issues.joined(separator: "\n\n"))
  }

  func testProfilePhotoAndSettingsSignOutCancellation() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    let signOut = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyloguj się", "Sign Out"])).firstMatch
    for _ in 0..<12 {
      if signOut.isHittable && signOut.frame.maxY < app.tabBars.firstMatch.frame.minY { break }
      app.swipeUp()
    }
    XCTAssertTrue(signOut.isHittable)
    signOut.tap()
    let alert = app.alerts.firstMatch
    XCTAssertTrue(alert.waitForExistence(timeout: 5))
    let polish = ProcessInfo.processInfo.environment["TESTOWNIK_LANGUAGE"] == "pl"
    let cancel = alert.buttons[polish ? "Anuluj" : "Cancel"]
    let confirm = alert.buttons[polish ? "Wyloguj się" : "Sign Out"]
    XCTAssertTrue(cancel.exists)
    XCTAssertTrue(confirm.exists)
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Native localized sign-out confirmation (cancelled)"; capture.lifetime = .keepAlways; add(capture)
    cancel.tap()
    XCTAssertTrue(alert.waitForNonExistence(timeout: 5))
    XCTAssertTrue(signOut.exists)
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    XCTAssertTrue(app.searchFields.firstMatch.waitForExistence(timeout: 10))
  }

  func testAuthenticatedAccountNavigation() throws {
    let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch
    let accountHeading = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Konto i pomoc", "Account & Support"])).firstMatch
    profileTab.tap()
    XCTAssertTrue(accountHeading.waitForExistence(timeout: 10))
    XCTAssertFalse(element("Konto gościa").exists)
    XCTAssertFalse(element("Guest account").exists)
    XCTAssertFalse(element("Administracja AI").exists)
    XCTAssertFalse(element("AI administration").exists)
    let profile = XCTAttachment(screenshot: app.screenshot())
    profile.name = "Signed-in native profile"
    profile.lifetime = .keepAlways
    add(profile)
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    for titles in [["Nauka", "Study"], ["Biblioteka", "Library"], ["Oceny", "Grades"], ["Profil", "Profile"]] {
      XCTAssertTrue(app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", titles)).firstMatch.exists)
    }
    XCTAssertTrue(app.searchFields.matching(NSPredicate(format: "label IN %@", ["Szukaj quizu", "Szukaj quizów", "Search quizzes", "Search Quizzes", "Szukaj", "Search"])).firstMatch.waitForExistence(timeout: 10))
    let library = XCTAttachment(screenshot: app.screenshot())
    library.name = "Signed-in native library"
    library.lifetime = .keepAlways
    add(library)
    app.terminate()
    app.launch()
    XCTAssertTrue(profileTab.waitForExistence(timeout: 30), "Native sign-in must survive relaunch.")
    profileTab.tap()
    XCTAssertTrue(accountHeading.waitForExistence(timeout: 10))
    XCTAssertFalse(element("Konto gościa").exists)
    XCTAssertFalse(element("Guest account").exists)
  }

  func testLibraryDrag() throws {
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_DRAG_FIXTURES"] == "1", "Creates two temporary folders; run with the fixture cleanup workflow.")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let sourceName = "AAA Mobile drag source 0922"
    let targetName = "AAA Mobile drag target 0922"
    for name in [sourceName, targetName] {
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Nowy folder", "New Folder"])).firstMatch.tap()
      let field = app.textFields.firstMatch
      XCTAssertTrue(field.waitForExistence(timeout: 10))
      field.tap()
      field.typeText(name)
      XCTAssertEqual(field.value as? String, name, "Rapid input must retain every character before saving")
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Utwórz folder", "Create Folder"])).firstMatch.tap()
      XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", name)).firstMatch.waitForExistence(timeout: 10))
    }
    let source = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", sourceName)).firstMatch
    let target = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", targetName)).firstMatch
    source.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).press(forDuration: 0.5, thenDragTo: target.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)), withVelocity: .slow, thenHoldForDuration: 1)
    let disappeared = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: source)
    XCTAssertEqual(XCTWaiter.wait(for: [disappeared], timeout: 15), .completed, app.debugDescription)
    target.tap()
    XCTAssertTrue(source.waitForExistence(timeout: 10), "Dragged folder must appear inside its destination")
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Native folder drag completed"
    capture.lifetime = .keepAlways
    add(capture)
  }

  func testLibraryOrganization() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let sort = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Sort", "Sortuj")).firstMatch
    XCTAssertTrue(sort.waitForExistence(timeout: 20), app.debugDescription)
    sort.tap()
    element("A → Z").tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "A → Z")).firstMatch.waitForExistence(timeout: 5))
    Thread.sleep(forTimeInterval: 1)
    let sorted = XCTAttachment(screenshot: app.screenshot())
    sorted.name = "Native library sorting"
    sorted.lifetime = .keepAlways
    add(sorted)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch.tap()
    element(app.tabBars.buttons["Library"].exists ? "New Folder" : "Nowy folder").tap()
    let create = app.buttons.matching(NSPredicate(format: "label IN %@", ["Utwórz folder", "Create Folder"])).firstMatch
    XCTAssertTrue(create.waitForExistence(timeout: 10), app.debugDescription)
    XCTAssertFalse(create.isEnabled)
    let folderName = app.textFields.firstMatch
    XCTAssertTrue(folderName.waitForExistence(timeout: 10))
    folderName.tap()
    folderName.typeText("Mobile folder draft")
    XCTAssertEqual(folderName.value as? String, "Mobile folder draft", "Rapid input must retain every character")
    XCTAssertTrue(create.isEnabled)
    XCTAssertTrue(create.isHittable)
    if app.keyboards.firstMatch.exists { XCTAssertLessThan(create.frame.maxY, app.keyboards.firstMatch.frame.minY) }
    let sheet = XCTAttachment(screenshot: app.screenshot())
    sheet.name = "New folder native sheet"
    sheet.lifetime = .keepAlways
    add(sheet)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.tap()
    let options = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Quiz options:", "Opcje quizu")).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10), app.debugDescription)
    options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Przenieś do folderu", "Move to folder"])).firstMatch.tap()
    let move = app.buttons.matching(NSPredicate(format: "label IN %@", ["Przenieś tutaj", "Move Here"])).firstMatch
    XCTAssertTrue(move.waitForExistence(timeout: 10), app.debugDescription)
    XCTAssertFalse(move.isEnabled, "Moving to the current parent should be disabled")
    let destination = XCTAttachment(screenshot: app.screenshot())
    destination.name = "Native folder destination picker"
    destination.lifetime = .keepAlways
    add(destination)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Anuluj", "Cancel"])).firstMatch.tap()
    sort.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Ostatnio używane", "Recently Used"])).firstMatch.tap()
  }

  func testExistingQuizQuickActionsHomeLibraryDesign() throws {
    func capture(_ name: String) {
      let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = name; shot.lifetime = .keepAlways; self.add(shot)
    }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Kontynuuj: ", "Continue: ")).firstMatch.waitForExistence(timeout: 20), app.debugDescription)
    Thread.sleep(forTimeInterval: 2)
    capture("Home design")
    app.swipeUp()
    let offline = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zapisane offline", "Saved Offline"])).firstMatch
    if offline.exists {
      offline.tap()
      XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier IN %@", ["Zapisane offline", "Saved Offline"])).firstMatch.waitForExistence(timeout: 10), app.debugDescription)
      capture("Saved offline design")
      app.navigationBars.buttons.firstMatch.tap()
    }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let add = app.buttons.matching(NSPredicate(format: "label IN %@", ["Dodaj do biblioteki", "Add to Library"])).firstMatch
    XCTAssertTrue(add.waitForExistence(timeout: 10))
    XCTAssertEqual(add.frame.width, add.frame.height, accuracy: 2, "Add control stays circular")
    Thread.sleep(forTimeInterval: 2)
    capture("Library design")
    let search = app.searchFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 5), "Search should be visible without a discovery gesture")
    search.tap()
    search.typeText("Testowy test")
    let result = app.buttons["Testowy test"]
    XCTAssertTrue(result.waitForExistence(timeout: 10))
    capture("Library search design")
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Zamknij", "Cancel", "Anuluj"])).firstMatch.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5))
    let sort = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sortuj", "Sort"])).firstMatch
    XCTAssertTrue(sort.waitForExistence(timeout: 5), app.debugDescription)
    // Rows have one tap target; management lives in the long-press menu and swipe actions.
    XCTAssertFalse(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Quiz options:", "Opcje quizu")).firstMatch.exists)
    sort.tap()
    let byName = app.buttons.matching(NSPredicate(format: "label IN %@", ["Nazwa A–Z", "Name A–Z"])).firstMatch
    XCTAssertTrue(byName.waitForExistence(timeout: 5)); byName.tap()
    capture("Library sort design")
    sort.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Ostatnio używane", "Recently Used"])).firstMatch.tap()
    let trash = app.buttons.matching(NSPredicate(format: "label IN %@", ["Kosz", "Trash"])).firstMatch
    for _ in 0..<10 {
      if trash.isHittable && trash.frame.maxY < app.tabBars.firstMatch.frame.minY { break }
      app.swipeUp()
    }
    XCTAssertTrue(trash.exists, app.debugDescription)
    XCTAssertTrue(trash.isHittable)
    XCTAssertLessThan(trash.frame.maxY, app.tabBars.firstMatch.frame.minY, "The final row must scroll clear of tabs")
    capture("Library lower rows")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    Thread.sleep(forTimeInterval: 1)
    capture("Profile palette")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Symulator", "Simulator"])).firstMatch.waitForExistence(timeout: 60))
    capture("Grades palette")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
  }

  func testExistingQuizQuickActionsAppleHeaderReference() throws {
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    settings.launch()
    XCTAssertTrue(settings.navigationBars.firstMatch.waitForExistence(timeout: 15))
    Thread.sleep(forTimeInterval: 2)
    let expanded = XCTAttachment(screenshot: settings.screenshot()); expanded.name = "Apple Settings expanded header"; expanded.lifetime = .keepAlways; add(expanded)
    print("Apple Settings expanded navigation: \(settings.navigationBars.firstMatch.frame)")
    settings.swipeUp()
    Thread.sleep(forTimeInterval: 1)
    let collapsed = XCTAttachment(screenshot: settings.screenshot()); collapsed.name = "Apple Settings collapsed header"; collapsed.lifetime = .keepAlways; add(collapsed)
    print("Apple Settings collapsed navigation: \(settings.navigationBars.firstMatch.frame)")
    app.activate()
  }

  func testExistingQuizQuickActionsLargestTextSearch() throws {
    guard #available(iOS 17.0, *) else { throw XCTSkip("Apple accessibility audits require iOS 17 or newer") }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch.tap()
    let search = app.searchFields.firstMatch
    XCTAssertTrue(search.waitForExistence(timeout: 10))
    XCTAssertGreaterThanOrEqual(search.frame.height, 44)
    let expanded = XCTAttachment(screenshot: app.screenshot()); expanded.name = "Library maximum accessibility text"; expanded.lifetime = .keepAlways; add(expanded)
    var findings: [String] = []
    try app.performAccessibilityAudit(for: [.textClipped]) { issue in
      findings.append("Library: \(issue.compactDescription) — \(issue.detailedDescription) — \(issue.element?.debugDescription ?? "no element")")
      return true
    }
    search.tap(); search.typeText("Testowy")
    XCTAssertEqual(search.value as? String, "Testowy")
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Testowy test")).firstMatch.waitForExistence(timeout: 10))
    let filtered = XCTAttachment(screenshot: app.screenshot()); filtered.name = "Library maximum text search result"; filtered.lifetime = .keepAlways; add(filtered)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Close", "Zamknij", "Cancel", "Anuluj"])).firstMatch.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForNonExistence(timeout: 5))
    let settings = XCUIApplication(bundleIdentifier: "com.apple.Preferences")
    settings.launch()
    XCTAssertTrue(settings.navigationBars.firstMatch.waitForExistence(timeout: 15))
    let reference = XCTAttachment(screenshot: settings.screenshot()); reference.name = "Apple Settings maximum accessibility text reference"; reference.lifetime = .keepAlways; add(reference)
    try settings.performAccessibilityAudit(for: [.textClipped]) { issue in
      findings.append("Apple Settings: \(issue.compactDescription) — \(issue.detailedDescription) — \(issue.element?.debugDescription ?? "no element")")
      return true
    }
    let report = XCTAttachment(string: findings.joined(separator: "\n\n")); report.name = "Search clipping comparison (findings recorded, not waived)"; report.lifetime = .keepAlways; add(report)
    app.activate()
  }

  func testExistingQuizQuickActionsRepeatedTabMetrics() throws {
    guard #available(iOS 26.0, *) else { throw XCTSkip("Hitch metrics require iOS 26 or newer") }
    try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_PERFORMANCE"] == "1", "Release performance sampling is opt-in")
    let options = XCTMeasureOptions()
    options.iterationCount = min(20, max(5, Int(ProcessInfo.processInfo.environment["TESTOWNIK_PERFORMANCE_ITERATIONS"] ?? "5") ?? 5))
    let names = [["Biblioteka", "Library"], ["Oceny", "Grades"], ["Profil", "Profile"], ["Nauka", "Study"]]
    // Prime the four screens before measuring repeated navigation.
    for labels in names {
      app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch.tap()
      XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier IN %@", labels)).firstMatch.waitForExistence(timeout: 15))
    }
    measure(metrics: [XCTHitchMetric(application: app), XCTMemoryMetric(application: app)], options: options) {
      for labels in names {
        let tab = app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", labels)).firstMatch
        tab.tap()
        XCTAssertTrue(tab.isSelected)
        XCTAssertTrue(app.navigationBars.matching(NSPredicate(format: "identifier IN %@", labels)).firstMatch.exists)
      }
    }
    let capture = XCTAttachment(screenshot: app.screenshot()); capture.name = "Study after repeated tab navigation"; capture.lifetime = .keepAlways; add(capture)
  }

  func testExistingQuizQuickActionsAccessibilityAudit() throws {
    guard #available(iOS 17.0, *) else { throw XCTSkip("Apple accessibility audits require iOS 17 or newer") }
    var issues: [String] = []
    for names in [["Nauka", "Study"], ["Biblioteka", "Library"], ["Oceny", "Grades"], ["Profil", "Profile"]] {
      app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", names)).firstMatch.tap()
      Thread.sleep(forTimeInterval: 2)
      try app.performAccessibilityAudit(for: [.hitRegion, .sufficientElementDescription, .textClipped, .trait]) { issue in
        issues.append("\(names[1]): \(issue.compactDescription) — \(issue.detailedDescription) — \(issue.element?.debugDescription ?? "no element")")
        return true
      }
    }
    let report = XCTAttachment(string: issues.joined(separator: "\n\n"))
    report.name = "Root navigation accessibility audit"
    report.lifetime = .keepAlways
    add(report)
    XCTAssertTrue(issues.isEmpty, issues.joined(separator: "\n\n"))
  }

  func testExistingQuizQuickActionsCollapsingRootHeaders() throws {
    for names in [["Nauka", "Study"], ["Biblioteka", "Library"], ["Oceny", "Grades"], ["Profil", "Profile"]] {
      app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", names)).firstMatch.tap()
      let bar = app.navigationBars.matching(NSPredicate(format: "identifier IN %@", names)).firstMatch
      XCTAssertTrue(bar.waitForExistence(timeout: 20), app.debugDescription)
      Thread.sleep(forTimeInterval: 2)
      let height = bar.frame.height
      print("Expanded \(names[1]): \(bar.frame)")
      let expanded = XCTAttachment(screenshot: app.screenshot()); expanded.name = "Expanded \(names[1]) header"; expanded.lifetime = .keepAlways; add(expanded)
      app.swipeUp()
      Thread.sleep(forTimeInterval: 1)
      print("Collapsed \(names[1]): \(bar.frame)")
      XCTAssertLessThan(bar.frame.height, height - 20, "\(names[1]) should collapse to a compact native header")
      let collapsed = XCTAttachment(screenshot: app.screenshot()); collapsed.name = "Collapsed \(names[1]) header"; collapsed.lifetime = .keepAlways; add(collapsed)
    }
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    app.swipeDown()
  }

  // Run with simctl content_size accessibility-extra-extra-extra-large as well
  // as the default size. Navigation changes here never edit grades or predictions.
  func testGradesAverageAccessibility() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    let average = app.staticTexts["grade-average"]
    XCTAssertTrue(average.waitForExistence(timeout: 30))
    XCTAssertTrue(average.label.lowercased().contains("average") || average.label.lowercased().contains("średnia"))
    XCTAssertNotNil(average.value as? String)
    XCTAssertLessThan(average.frame.height, average.frame.width * 0.65, "Keep the numeric average on one line at accessibility sizes")
    let actual = XCTAttachment(screenshot: app.screenshot())
    actual.name = "Grade average at accessibility text size"; actual.lifetime = .keepAlways; add(actual)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Symulator", "Simulator"])).firstMatch.tap()
    XCTAssertLessThan(average.frame.height, average.frame.width * 0.65, "Keep the predicted average together too")
    app.segmentedControls.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    let combinedButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Wszystkie semestry,", "All Semesters,")).firstMatch
    for _ in 0..<10 {
      if combinedButton.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(combinedButton.isHittable, app.debugDescription)
    combinedButton.tap()
    let combined = app.staticTexts["combined-average"]
    XCTAssertTrue(combined.waitForExistence(timeout: 10))
    XCTAssertLessThan(combined.frame.height, combined.frame.width * 0.65, "Keep the combined average together too")
    let combinedShot = XCTAttachment(screenshot: app.screenshot())
    combinedShot.name = "Combined average at accessibility text size"; combinedShot.lifetime = .keepAlways; add(combinedShot)
  }

  func testGradesSimulator() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    let simulator = app.buttons.matching(NSPredicate(format: "label IN %@", ["Symulator", "Simulator"])).firstMatch
    XCTAssertTrue(simulator.waitForExistence(timeout: 60), app.debugDescription)
    let grades = XCTAttachment(screenshot: app.screenshot())
    grades.name = "Grades overview redesigned"
    grades.lifetime = .keepAlways
    add(grades)
    let actualAverage = app.staticTexts["grade-average"].value as? String
    XCTAssertNotNil(actualAverage)
    let course = app.buttons.matching(NSPredicate(format: "identifier BEGINSWITH %@", "grade-course-")).firstMatch
    if !course.isHittable { app.swipeUp() }
    course.tap()
    XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@ OR label CONTAINS %@", "Counts towards the average", "Wliczana do średniej")).firstMatch.waitForExistence(timeout: 5))
    let detail = XCTAttachment(screenshot: app.screenshot())
    detail.name = "Grade detail native sheet"
    detail.lifetime = .keepAlways
    add(detail)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Gotowe", "Done"])).firstMatch.tap()
    if !simulator.isHittable { app.swipeDown() }
    simulator.tap()
    let reset = app.buttons.matching(NSPredicate(format: "label IN %@", ["Resetuj prognozę", "Reset predictions"])).firstMatch
    XCTAssertTrue(reset.waitForExistence(timeout: 10), app.debugDescription)
    XCTAssertFalse(reset.isEnabled)
    let predictedGrade = app.segmentedControls.buttons.matching(NSPredicate(format: "label MATCHES %@ AND selected == NO", "[2-5][.,][05]")).firstMatch
    if !predictedGrade.isHittable { app.swipeUp() }
    XCTAssertTrue(predictedGrade.waitForExistence(timeout: 10), app.debugDescription)
    XCTAssertGreaterThanOrEqual(predictedGrade.frame.height, 44, "Grade choices must have a comfortable native touch target")
    let pickerBounds = XCTAttachment(string: "Grade option frame: \(predictedGrade.frame); segmented controls: \(app.segmentedControls.debugDescription)")
    pickerBounds.name = "Native grade selector bounds"
    pickerBounds.lifetime = .keepAlways
    add(pickerBounds)
    let predictedLabel = predictedGrade.label
    predictedGrade.tap()
    XCTAssertTrue(course.label.contains("\(predictedLabel), USOS:"), "The row headline must describe the predicted value and the original USOS grade")
    XCTAssertTrue(reset.isEnabled)
    XCTAssertNotEqual(app.staticTexts["grade-average"].value as? String, actualAverage)
    let simulated = XCTAttachment(screenshot: app.screenshot())
    simulated.name = "Visible grade choices and pinned forecast"
    simulated.lifetime = .keepAlways
    add(simulated)
    app.swipeUp()
    XCTAssertTrue(reset.isHittable, "Forecast reset stays accessible while scrolling")
    XCTAssertTrue(app.staticTexts["grade-average"].isHittable)
    XCTAssertGreaterThanOrEqual(app.staticTexts["grade-average"].frame.minY, app.navigationBars.firstMatch.frame.maxY, "Forecast must be fully below navigation, not partially covered")
    let pinned = XCTAttachment(screenshot: app.screenshot())
    pinned.name = "Forecast fully visible after scrolling"
    pinned.lifetime = .keepAlways
    add(pinned)
    let lastPicker = app.segmentedControls.element(boundBy: app.segmentedControls.count - 1)
    for _ in 0..<10 {
      if lastPicker.frame.maxY <= app.tabBars.firstMatch.frame.minY && lastPicker.buttons.firstMatch.isHittable { break }
      app.swipeUp()
    }
    XCTAssertTrue(lastPicker.buttons.firstMatch.isHittable, "The final course's grade choices remain reachable")
    XCTAssertLessThanOrEqual(lastPicker.frame.maxY, app.tabBars.firstMatch.frame.minY, "The complete final grade picker must clear the native tab bar")
    let lastCourse = XCTAttachment(screenshot: app.screenshot()); lastCourse.name = "Final simulator grade choices clear the tab bar"; lastCourse.lifetime = .keepAlways; add(lastCourse)
    reset.tap()
    XCTAssertFalse(reset.isEnabled)
    XCTAssertEqual(app.staticTexts["grade-average"].value as? String, actualAverage)
    for _ in 0..<10 {
      if simulator.isHittable { break }
      app.swipeDown()
    }
    app.segmentedControls.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    let combinedButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Wszystkie semestry,", "All Semesters,")).firstMatch
    combinedButton.tap()
    let deselect = app.buttons.matching(NSPredicate(format: "label IN %@", ["Odznacz wszystkie", "Deselect All"])).firstMatch
    if !deselect.exists { app.buttons.matching(NSPredicate(format: "label IN %@", ["Zaznacz wszystkie", "Select All"])).firstMatch.tap() }
    deselect.tap()
    XCTAssertTrue(app.staticTexts["combined-average"].label.contains("—"), app.debugDescription)
    let combined = XCTAttachment(screenshot: app.screenshot())
    combined.name = "Multi semester calculator sheet"
    combined.lifetime = .keepAlways
    add(combined)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Gotowe", "Done"])).firstMatch.tap()
    app.buttons["choose-semester"].tap()
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Gotowe", "Done"])).firstMatch.waitForExistence(timeout: 5))
    let semesters = XCTAttachment(screenshot: app.screenshot())
    semesters.name = "Semester chooser with averages"
    semesters.lifetime = .keepAlways
    add(semesters)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Gotowe", "Done"])).firstMatch.tap()
  }

  func testStudyLocale() throws {
    let profileTab = app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch
    profileTab.tap()
    let english = profileTab.label == "Profile"
    XCTAssertTrue(app.navigationBars[english ? "Profile" : "Profil"].waitForExistence(timeout: 10))
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    XCTAssertTrue(app.navigationBars[english ? "Study" : "Nauka"].waitForExistence(timeout: 10))
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", english ? "Continue: " : "Kontynuuj: ")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 15))
    resume.tap()
    XCTAssertTrue(app.buttons[english ? "AI Hint" : "Podpowiedź AI"].waitForExistence(timeout: 15))
    XCTAssertTrue(app.buttons[english ? "Check" : "Sprawdź"].exists)
    XCTAssertTrue(app.staticTexts[english ? "SESSION PROGRESS" : "POSTĘP SESJI"].exists)
    app.buttons[english ? "Quiz options" : "Opcje quizu"].tap()
    XCTAssertTrue(element(english ? "Search Questions" : "Szukaj w pytaniach").waitForExistence(timeout: 5))
    let capture = XCTAttachment(screenshot: app.screenshot())
    capture.name = "Localized study controls and menu"
    capture.lifetime = .keepAlways
    add(capture)
  }

  func testWrappedSlideChrome() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Wrapped")).firstMatch.tap()
    let slide2 = app.webViews.buttons["Slajd 2"]
    XCTAssertTrue(slide2.waitForExistence(timeout: 60), app.debugDescription)
    expectation(for: NSPredicate(format: "hittable == true"), evaluatedWith: slide2)
    waitForExpectations(timeout: 30)
    slide2.tap()
    XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "UIViewControllerBasedStatusBarAppearance")).firstMatch.exists)
    // Capture after the web entrance and UIKit tint transitions settle.
    Thread.sleep(forTimeInterval: 1)
    let second = XCTAttachment(screenshot: app.screenshot())
    second.name = "Wrapped slide 2 and native chrome"
    second.lifetime = .keepAlways
    add(second)
    app.webViews.buttons["Slajd 3"].tap()
    XCTAssertFalse(app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "UIViewControllerBasedStatusBarAppearance")).firstMatch.exists)
    Thread.sleep(forTimeInterval: 1)
    let third = XCTAttachment(screenshot: app.screenshot())
    third.name = "Wrapped slide 3 and native chrome"
    third.lifetime = .keepAlways
    add(third)
    let back = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wstecz", "Back"])).firstMatch
    XCTAssertTrue(back.waitForExistence(timeout: 10), app.debugDescription)
    back.tap()
    XCTAssertTrue(app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.waitForExistence(timeout: 10))
    Thread.sleep(forTimeInterval: 1)
    let restored = XCTAttachment(screenshot: app.screenshot())
    restored.name = "Profile colors restored after Wrapped"
    restored.lifetime = .keepAlways
    add(restored)
  }

  func testEmbeddedStatistics() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Kontynuuj: ", "Continue: ")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 10))
    resume.tap()
    let options = app.buttons.matching(NSPredicate(format: "label IN %@", ["Opcje quizu", "Quiz options"])).firstMatch
    XCTAssertTrue(options.waitForExistence(timeout: 10))
    options.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Statystyki", "Statistics"])).firstMatch.tap()
    XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
    // The embedded web page hides its duplicate heading under the native bar.
    // Assert the report content that is visible in the canonical page.
    let title = app.webViews.staticTexts["Informacje"]
    XCTAssertTrue(title.waitForExistence(timeout: 60), app.debugDescription)
    let visible = NSPredicate(format: "hittable == true")
    expectation(for: visible, evaluatedWith: title)
    waitForExpectations(timeout: 30)
    let metric = app.webViews.staticTexts["Liczba uruchomień"]
    XCTAssertTrue(metric.waitForExistence(timeout: 30), app.debugDescription)
    // This existing fixture has study activity. A metric label also appears
    // while its values and charts are still loading; wait for the hourly axis.
    let hour = app.webViews.staticTexts["00"].firstMatch
    XCTAssertTrue(hour.waitForExistence(timeout: 60), app.debugDescription)
    app.webViews.firstMatch.swipeUp()
    let report = XCTAttachment(screenshot: app.screenshot())
    report.name = "Existing web statistics inside iOS"
    report.lifetime = .keepAlways
    add(report)
  }

  func testInlineHintAndAssistantLayout() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Nauka", "Study"])).firstMatch.tap()
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Kontynuuj: ", "Continue: ")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 10))
    resume.tap()
    let hint = app.buttons.matching(NSPredicate(format: "label IN %@", ["Podpowiedź AI", "AI Hint"])).firstMatch
    XCTAssertTrue(hint.waitForExistence(timeout: 15))
    hint.tap()
    let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij podpowiedź", "Close hint"])).firstMatch
    XCTAssertTrue(close.waitForExistence(timeout: 10))
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Sprawdź", "Check"])).firstMatch.exists, "Answer action stays on the study screen.")
    let inline = XCTAttachment(screenshot: app.screenshot())
    inline.name = "Inline hint beside the question"
    inline.lifetime = .keepAlways
    add(inline)
    close.tap()
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch.tap()
    let composer = app.textViews["assistant-composer"]
    XCTAssertTrue(composer.waitForExistence(timeout: 10))
    XCTAssertTrue(composer.isHittable)
    let send = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij wiadomość", "Send message"])).firstMatch
    XCTAssertTrue(send.exists)
    let emptyValues = ["", "Ask about this question…", "Zapytaj o to pytanie…"]
    let cleared = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
      emptyValues.contains(composer.value as? String ?? "")
    }, object: composer)
    try XCTSkipIf(XCTWaiter.wait(for: [cleared], timeout: 3) != .completed, "Preserve an existing user draft")
    XCTAssertFalse(send.isEnabled)
    XCTAssertGreaterThanOrEqual(send.frame.width, 44)
    XCTAssertGreaterThanOrEqual(send.frame.height, 44)
    XCTAssertEqual(send.frame.width, send.frame.height, accuracy: 2, "Native send button must remain circular")
    if ProcessInfo.processInfo.environment["TESTOWNIK_AI_DISABLED"] == "1" {
      composer.tap()
      composer.typeText("Explain this question")
      XCTAssertEqual(composer.value as? String, "Explain this question")
      send.tap()
      XCTAssertTrue(app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Asystent jest chwilowo niedostępny. Spróbuj ponownie później.", "The assistant is temporarily unavailable. Try again later."])).firstMatch.waitForExistence(timeout: 20))
      XCTAssertTrue(send.waitForExistence(timeout: 20), app.debugDescription)
      XCTAssertTrue(send.isEnabled)
      XCTAssertEqual(composer.value as? String, "Explain this question", "A failed local request must preserve the draft")
      let context = app.staticTexts.matching(NSPredicate(format: "label IN %@", ["Rozmawiasz o tym pytaniu", "Discuss this question"])).firstMatch
      XCTAssertTrue(context.waitForExistence(timeout: 5))
      let header = app.navigationBars.matching(NSPredicate(format: "identifier IN %@", ["Asystent", "Assistant"])).firstMatch
      XCTAssertTrue(header.exists)
      let visibleContext = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
        context.frame.minY >= header.frame.maxY - 1
      }, object: context)
      XCTAssertEqual(XCTWaiter.wait(for: [visibleContext], timeout: 5), .completed, "Failed first reply must leave the question context below the sheet header")

    }
    let chat = XCTAttachment(screenshot: app.screenshot())
    chat.name = "Assistant conversation and composer"
    chat.lifetime = .keepAlways
    add(chat)
    app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch.tap()
    XCTAssertTrue(hint.waitForExistence(timeout: 10))
    if ProcessInfo.processInfo.environment["TESTOWNIK_AI_DISABLED"] == "1" {
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch.tap()
      XCTAssertTrue(composer.waitForExistence(timeout: 10))
      let restored = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", "Explain this question"), object: composer)
      XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 10), .completed, "Closing the assistant must preserve its draft")
      app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch.tap()
    }
  }

  func testExistingQuizQuickActions() throws {
    app.tabBars.buttons["Nauka"].tap()
    let resume = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Kontynuuj: ")).firstMatch
    XCTAssertTrue(resume.waitForExistence(timeout: 10))
    resume.tap()
    let hint = element("Podpowiedź AI")
    XCTAssertTrue(hint.waitForExistence(timeout: 15), "An unfinished recent quiz is required.")
    hint.tap()
    let back = app.buttons["Wróć do pytania"]
    XCTAssertTrue(back.waitForExistence(timeout: 15))
    XCTAssertTrue(back.isHittable)
    back.tap()
    element("Asystent").tap()
    let prompt = app.textViews["Pytanie do asystenta"]
    XCTAssertTrue(prompt.waitForExistence(timeout: 10))
    prompt.tap()
    prompt.typeText("Explain this question")
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    XCTAssertGreaterThan(app.keyboards.firstMatch.frame.height, 150, "The on-screen keyboard must be visible.")
    let send = app.buttons["Wyślij pytanie"]
    XCTAssertTrue(send.isHittable)
    XCTAssertLessThanOrEqual(send.frame.maxY, app.keyboards.firstMatch.frame.minY)
    XCTAssertLessThan(app.keyboards.firstMatch.frame.minY, app.frame.maxY - 150)
    let screenshot = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    screenshot.name = "Existing-account assistant with native keyboard"
    screenshot.lifetime = .keepAlways
    add(screenshot)
    // Inspect layout without sending a paid request or submitting a quiz answer.
    element("Zamknij asystenta").tap()
    XCTAssertTrue(hint.waitForExistence(timeout: 10))
  }

  func testGuestNavigationAndKeyboardSearch() throws {
    let library = app.tabBars.buttons["Biblioteka"]
    XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
    library.tap()

    let field = app.searchFields.matching(NSPredicate(format: "label IN %@", ["Szukaj quizu", "Szukaj quizów", "Search quizzes", "Search Quizzes", "Szukaj", "Search"])).firstMatch
    XCTAssertTrue(field.waitForExistence(timeout: 10), app.debugDescription)
    field.tap()
    field.typeText("Native keyboard search")
    app.keyboards.buttons["Search"].tap()
    XCTAssertTrue(element("WYNIKI WYSZUKIWANIA").waitForExistence(timeout: 10))
    XCTAssertTrue(element("Nie znaleziono quizów").waitForExistence(timeout: 10))

    app.tabBars.buttons["Profil"].tap()
    XCTAssertTrue(element("Konto i pomoc").waitForExistence(timeout: 10))
    XCTAssertTrue(element("Wrapped").exists)
    for title in ["Ustawienia nauki", "Wrapped", "Powiadomienia", "Konto i prywatność", "Prześlij opinię"] {
      let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
      XCTAssertTrue(row.exists, "Missing native action: \(title)")
      XCTAssertGreaterThanOrEqual(row.frame.height, 48, "Small native hit target: \(title)")
      XCTAssertGreaterThan(row.frame.width, 250, "Narrow native hit target: \(title)")
    }

    let profile = XCTAttachment(screenshot: app.screenshot())
    profile.name = "iOS native Profile"
    profile.lifetime = .keepAlways
    add(profile)

    element("Wrapped").tap()
    XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 30))
    let guestNotice = app.webViews.staticTexts.matching(
      NSPredicate(format: "label CONTAINS[c] %@", "Wrapped nie jest dostępne dla gości")
    ).firstMatch
    XCTAssertTrue(guestNotice.waitForExistence(timeout: 30), app.debugDescription)
    let loaded = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"),
      object: app.activityIndicators.firstMatch
    )
    XCTAssertEqual(XCTWaiter.wait(for: [loaded], timeout: 30), .completed)
    XCTAssertTrue(guestNotice.isHittable)
  }

  private func createQuiz() throws -> String {
    let library = app.tabBars.buttons["Biblioteka"]
    XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
    library.tap()
    element("Dodaj do biblioteki").tap()
    XCTAssertTrue(element("Nowy quiz").waitForExistence(timeout: 5))
    element("Nowy quiz").tap()

    let titleField = app.textFields["Tytuł quizu"]
    XCTAssertTrue(titleField.waitForExistence(timeout: 10), app.debugDescription)
    titleField.tap()
    if let previous = titleField.value as? String, previous != "Tytuł quizu", !previous.isEmpty {
      let clear = titleField.buttons["Clear text"]
      XCTAssertTrue(clear.exists, app.debugDescription)
      clear.tap()
    }
    let title = "Native iOS " + UUID().uuidString.prefix(8)
    titleField.typeText(title)
    XCTAssertEqual(titleField.value as? String, title)

    for (label, text) in [("Treść pytania", "Native question"), ("Odpowiedź 1", "Correct native answer"), ("Odpowiedź 2", "Wrong native answer")] {
      let field = app.textViews[label]
      XCTAssertTrue(field.exists, app.debugDescription)
      field.tap()
      if let previous = field.value as? String, previous != label, !previous.isEmpty {
        field.typeText(String(repeating: XCUIKeyboardKey.delete.rawValue, count: previous.count))
      }
      field.typeText(text)
      XCTAssertEqual(field.value as? String, text)
    }
    let editor = XCTAttachment(screenshot: app.screenshot())
    editor.name = "iOS native editor with keyboard"
    editor.lifetime = .keepAlways
    add(editor)
    XCTAssertLessThanOrEqual(app.buttons["Zapisz quiz"].frame.maxY, app.keyboards.firstMatch.frame.minY)
    app.buttons["Zapisz quiz"].tap()
    XCTAssertTrue(element("Native question").waitForExistence(timeout: 15), app.debugDescription)
    return title
  }

  func testCreateQuizAndStudy() throws {
    _ = try createQuiz()
    let check = app.buttons["Sprawdź"]
    XCTAssertTrue(check.isEnabled, "Checking with nothing selected is allowed")
    element("Correct native answer").tap()
    XCTAssertTrue(check.isEnabled)
    check.tap()
    XCTAssertTrue(element("Dobrze!").waitForExistence(timeout: 10), app.debugDescription)
    let feedback = XCTAttachment(screenshot: app.screenshot())
    feedback.name = "iOS native study feedback"
    feedback.lifetime = .keepAlways
    add(feedback)
    app.buttons["Dalej"].tap()
    XCTAssertFalse(element("Dobrze!").exists)
    XCTAssertTrue(app.buttons["Sprawdź"].exists || element("Quiz ukończony!").exists)
  }

  private func proxyControl(_ mode: String) throws -> [String: Any] {
    var request = URLRequest(url: URL(string: "http://127.0.0.1:8767/__control")!)
    request.httpMethod = "POST"
    request.timeoutInterval = 5
    request.httpBody = try JSONSerialization.data(withJSONObject: ["mode": mode])
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    let completed = expectation(description: "Local test proxy control")
    var payload: Data?
    var failure: Error?
    URLSession.shared.dataTask(with: request) { data, _, error in
      payload = data
      failure = error
      completed.fulfill()
    }.resume()
    wait(for: [completed], timeout: 6)
    if let failure { throw failure }
    return try JSONSerialization.jsonObject(with: XCTUnwrap(payload)) as! [String: Any]
  }

  func testOfflineAnswerSurvivesRelaunchAndSyncsOnce() throws {
    // Opt-in: point the development app at the disposable native API proxy.
    do { _ = try proxyControl("reset") }
    catch { throw XCTSkip("Start scripts/native-api-proxy.py and configure API port 8767.") }
    defer { _ = try? proxyControl("online") }
    let title = try createQuiz()
    _ = try proxyControl("offline")
    element("Correct native answer").tap()
    app.buttons["Sprawdź"].tap()
    XCTAssertTrue(element("Dobrze!").waitForExistence(timeout: 15))
    let pendingLabel = "1 odpowiedzi czeka na synchronizację."
    XCTAssertTrue(element(pendingLabel).waitForExistence(timeout: 15), app.debugDescription)
    app.buttons["Dalej"].tap()
    app.terminate()
    app.launch()
    XCTAssertTrue(element(pendingLabel).waitForExistence(timeout: 30), app.debugDescription)
    let cachedQuiz = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
    XCTAssertTrue(cachedQuiz.waitForExistence(timeout: 10))
    cachedQuiz.tap()
    XCTAssertTrue(element("Quiz ukończony!").waitForExistence(timeout: 15))
    XCTAssertEqual(try proxyControl("online")["answers_forwarded"] as? Int, 0)
    app.buttons["Synchronizuj"].tap()
    let synced = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: element(pendingLabel))
    XCTAssertEqual(XCTWaiter.wait(for: [synced], timeout: 15), .completed)
    XCTAssertEqual(try proxyControl("online")["answers_succeeded"] as? Int, 1)
    app.terminate()
    app.launch()
    XCTAssertTrue(app.tabBars.buttons["Nauka"].waitForExistence(timeout: 30))
    XCTAssertTrue(cachedQuiz.waitForExistence(timeout: 10))
    cachedQuiz.tap()
    XCTAssertTrue(element("Quiz ukończony!").waitForExistence(timeout: 15))
    XCTAssertFalse(element(pendingLabel).exists)
    XCTAssertEqual(try proxyControl("online")["answers_forwarded"] as? Int, 1)
  }

  func testManualUSOSSignIn() throws {
    let signIn = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zaloguj się do Testownika", "Sign in to Testownik"])).firstMatch
    XCTAssertTrue(signIn.waitForExistence(timeout: 20), "Expected the new OAuth sign-in screen.")
    signIn.tap()
    let continueButton = XCUIApplication(bundleIdentifier: "com.apple.springboard").alerts.buttons["Continue"]
    if continueButton.waitForExistence(timeout: 5) { continueButton.tap() }
    let handoff = XCTAttachment(screenshot: app.screenshot())
    handoff.name = "Native OAuth handoff before credentials"
    handoff.lifetime = .keepAlways
    add(handoff)
    // The user enters credentials in the provider's system-browser screen.
    XCTAssertTrue(app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.waitForExistence(timeout: 300), "OAuth did not return to the native app.")
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.tap()
    XCTAssertFalse(element("mobile-ios@example.invalid").exists)
    XCTAssertFalse(element("Konto gościa").exists)
    app.terminate()
    app.launch()
    XCTAssertTrue(app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch.waitForExistence(timeout: 30), "Native session did not survive relaunch.")
  }

  func testSignedInWrappedReportAndCommunity() throws {
    app.tabBars.buttons["Profil"].tap()
    XCTAssertTrue(element("Konto i pomoc").waitForExistence(timeout: 10))
    if element("Konto gościa").exists {
      throw XCTSkip("Seed a synthetic signed-in account and Wrapped report in the disposable database.")
    }
    element("Wrapped").tap()
    let skip = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] %@", "Pomiń")).firstMatch
    XCTAssertTrue(skip.waitForExistence(timeout: 45), app.debugDescription)
    skip.tap()
    let summary = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Taki był Twój semestr")).firstMatch
    XCTAssertTrue(summary.waitForExistence(timeout: 15), app.debugDescription)
    XCTAssertTrue(summary.isHittable)
    XCTAssertTrue(app.webViews.buttons["Udostępnij"].exists)
    let personal = XCTAttachment(screenshot: app.screenshot())
    personal.name = "iOS signed-in Wrapped report"
    personal.lifetime = .keepAlways
    add(personal)
    element("Opcje Wrapped").tap()
    element("Cała społeczność").tap()
    XCTAssertTrue(skip.waitForExistence(timeout: 30), app.debugDescription)
    skip.tap()
    let community = app.webViews.staticTexts.matching(NSPredicate(format: "label CONTAINS[c] %@", "Taki był Testownik")).firstMatch
    XCTAssertTrue(community.waitForExistence(timeout: 15), app.debugDescription)
    XCTAssertTrue(community.isHittable)
  }

// INSERT INSIDE NativeFlows. Root owns integration/compilation/native execution.
// Test-only: navigation, scrolling, current-app permission expansion. No toggles,
// sliders, disconnect, sign-out, photo, notification-read or account/cache writes.
// Host must verify max Dynamic Type + dark with simctl before interpreting captures.
private func qaFooterCapture(_ name: String, note: String = "") {
  let screenshot = XCTAttachment(screenshot: app.screenshot())
  screenshot.name = name; screenshot.lifetime = .keepAlways; add(screenshot)
  let hierarchy = XCTAttachment(string: note + "\n" + app.debugDescription)
  hierarchy.name = name + " — geometry and hierarchy"
  hierarchy.lifetime = .keepAlways; add(hierarchy)
}

private func qaFooterViewport() -> CGRect {
  let bounds = app.frame
  let bar = app.navigationBars.firstMatch
  let top = bar.exists && bar.frame.intersects(bounds)
    ? max(bounds.minY, bar.frame.maxY) : bounds.minY + 50
  let tabs = app.tabBars.firstMatch
  // Use one bottom exclusion: visible tabs or the home-indicator band.
  // The former -40 plus rectangle -8 rejected readable native footers at y810.
  let bottom = tabs.exists && tabs.frame.height > 0 && tabs.frame.intersects(bounds)
    ? min(bounds.maxY - 20, tabs.frame.minY - 8) : bounds.maxY - 20
  let contentTop = top + 8
  return CGRect(x: bounds.minX, y: contentTop,
                width: bounds.width, height: max(1, bottom - contentTop))
}

private func qaFooterScroll(up: Bool, large: Bool = false) {
  // Start in the list gutter, away from sliders, switches and action labels.
  let from = app.coordinate(withNormalizedOffset: CGVector(dx: 0.04, dy: up ? 0.76 : 0.34))
  let to = app.coordinate(withNormalizedOffset: CGVector(dx: 0.04, dy: up ? (large ? 0.30 : 0.56) : (large ? 0.86 : 0.54)))
  let start = CGPoint(x: app.frame.minX + app.frame.width * 0.04,
                      y: app.frame.minY + app.frame.height * (up ? 0.76 : 0.34))
  let controls = app.sliders.allElementsBoundByIndex + app.switches.allElementsBoundByIndex
  guard !controls.contains(where: { $0.exists && $0.frame.contains(start) }) else {
    XCTFail("Scroll start overlaps a settings control; choose a clear gutter before proceeding"); return
  }
  from.press(forDuration: 0.05, thenDragTo: to)
  qaFooterSettle(0.3)
}

private func qaFooterSettle(_ seconds: TimeInterval) {
  // UI settling only, never an assertion that asynchronous content has loaded.
  _ = XCTWaiter.wait(for: [XCTestExpectation(description: "Native layout settling")], timeout: seconds)
}

private func qaFooterText(_ complete: String) -> XCUIElement {
  app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", String(complete.prefix(80)))).firstMatch
}

private func qaFooterTop() {
  for _ in 0..<10 { qaFooterScroll(up: false, large: true) }
}

// Maximum-text captures use adaptive point travel. Keep qaFooterScroll unchanged:
// the signed R11/R12 brand order comparison deliberately uses its original gestures.
@discardableResult
private func qaFooterDragPoints(_ requested: CGFloat) -> Bool {
  let viewport = qaFooterViewport()
  guard viewport.height > 100, requested.isFinite else {
    XCTFail("Invalid maximum-text viewport/travel"); return false
  }
  let distance = min(max(abs(requested), 40), viewport.height * 0.55)
  let x = app.frame.minX + 8
  let startY = requested >= 0 ? viewport.maxY - 18 : viewport.minY + 18
  let endY = startY + (requested >= 0 ? -distance : distance)
  let start = CGPoint(x: x, y: startY)
  let controls = app.sliders.allElementsBoundByIndex + app.switches.allElementsBoundByIndex
  guard !controls.contains(where: { $0.exists && $0.frame.contains(start) }) else {
    XCTFail("Adaptive scroll start overlaps a settings control; no gesture performed"); return false
  }
  let origin = app.coordinate(withNormalizedOffset: .zero)
  let from = origin.withOffset(CGVector(dx: x - app.frame.minX, dy: startY - app.frame.minY))
  let to = origin.withOffset(CGVector(dx: x - app.frame.minX, dy: endY - app.frame.minY))
  // Hold the endpoint to avoid the inertial fling that caused narrow-fit ping-pong.
  from.press(forDuration: 0.05, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.15)
  qaFooterSettle(0.45)
  return true
}

private func qaFooterReveal(_ element: XCUIElement, name: String) {
  let deadline = ProcessInfo.processInfo.systemUptime + 70
  var previous: CGRect?
  var stationary = 0
  // Bounded forward search/retrace followed by adaptive alignment. Re-read
  // viewport and element geometry after every gesture; clipped AX remains diagnostic.
  for attempt in 0..<16 {
    guard ProcessInfo.processInfo.systemUptime < deadline else { break }
    let viewport = qaFooterViewport()
    guard element.exists && element.frame.width > 0 && element.frame.height > 0 else {
      guard qaFooterDragPoints(viewport.height * (attempt < 8 ? 0.5 : -0.5)) else { return }
      continue
    }
    let frame = element.frame
    if let prior = previous, abs(prior.minY - frame.minY) < 2,
       abs(prior.maxY - frame.maxY) < 2 { stationary += 1 } else { stationary = 0 }
    previous = frame
    guard stationary < 3 else { break }
    let inset: CGFloat = 8
    let top = viewport.minY + inset
    let bottom = viewport.maxY
    if frame.height <= bottom - top - 48 && frame.minY >= top && frame.maxY <= bottom {
      qaFooterCapture(name, note: "Element label: \(element.label)\nFrame: \(frame)\nUnobstructed viewport: \(viewport)")
      XCTAssertTrue(element.isHittable, "Positioned element must remain exposed")
      return
    }
    if frame.height > bottom - top - 48 && frame.minY >= top && frame.minY <= top + 48 {
      // Oversized text needs overlapping pages, not impossible full containment.
      // Screenshots remain the glyph evidence; AX labels/frames are diagnostics.
      qaFooterCapture(name + " — first lines", note: "Frame: \(frame)\nViewport: \(viewport)")
      for page in 1...8 {
        guard ProcessInfo.processInfo.systemUptime < deadline else { break }
        let currentViewport = qaFooterViewport()
        let current = element.frame
        if current.maxY <= currentViewport.maxY {
          qaFooterCapture(name + " — last lines", note: "Frame: \(current)\nViewport: \(currentViewport)")
          XCTAssertGreaterThan(current.maxY, currentViewport.minY + inset)
          return
        }
        let travel = min(currentViewport.height * 0.55, current.maxY - currentViewport.maxY)
        guard qaFooterDragPoints(travel) else { return }
        let after = element.frame
        let moved = max(current.minY - after.minY, current.maxY - after.maxY)
        let bothEdgesClipped = current.minY <= currentViewport.minY && current.maxY >= currentViewport.maxY
          && after.minY <= currentViewport.minY && after.maxY >= currentViewport.maxY
        if moved <= 1 && bothEdgesClipped {
          qaFooterCapture(name + " — displacement not measurable page \(page)", note: "AX spans both viewport edges; screenshots required, no movement/coverage claim")
          continue
        }
        guard moved > 1 && moved <= currentViewport.height * 0.8 else {
          qaFooterCapture(name + " — pagination inconclusive", note: "Observed displacement: \(moved)")
          XCTFail("Footer pagination stalled or left a coverage gap; inspect captures before diagnosing product truncation"); return
        }
        qaFooterCapture(name + " — overlapping page \(page)", note: "Frame: \(element.frame)\nViewport: \(qaFooterViewport())")
      }
      break
    }
    let delta: CGFloat
    if frame.height > bottom - top - 48 { delta = frame.minY - (top + 24) }
    else { delta = frame.midY - (top + bottom) / 2 }
    guard qaFooterDragPoints(delta) else { return }
  }
  qaFooterCapture(name + " — positioning inconclusive", note: "Viewport: \(qaFooterViewport())\nElement: \(element.debugDescription)")
  XCTFail("Could not position \(name) within bounded gestures; inspect captures before diagnosing truncation")
}

private func qaFooterRecordAudit(_ name: String) throws {
  guard #available(iOS 17.0, *) else { return }
  var observations: [String] = []
  // Diagnostics only. Full labels/frames and Apple's audit are not glyph proof;
  // root must review screenshots and unresolved issues before release sign-off.
  try app.performAccessibilityAudit(for: [.textClipped]) { issue in
    observations.append("\(issue.compactDescription) — \(issue.detailedDescription) — \(issue.element?.debugDescription ?? "unknown")")
    return true
  }
  let record = XCTAttachment(string: observations.isEmpty ? "No textClipped finding at this scroll position. Screenshot review still required." : observations.joined(separator: "\n\n"))
  record.name = name + " — Apple text-clipping observations"
  record.lifetime = .keepAlways; add(record)
}

private func qaMaximumSettings(_ language: String) throws {
  guard ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
        ProcessInfo.processInfo.environment["TESTOWNIK_SYNTHETIC_OAUTH"] == "1" else {
    XCTFail("Refusing UI actions without explicit disposable synthetic fixture guards"); return
  }
  guard ProcessInfo.processInfo.environment["TESTOWNIK_QA_DARK_VERIFIED"] == "1",
        ProcessInfo.processInfo.environment["TESTOWNIK_QA_MAXIMUM_TEXT_VERIFIED"] == "1" else {
    XCTFail("Root must verify actual simulator dark mode and AX-XXXL before running captures"); return
  }
  let control = try nativeComposeControl()
  guard control["network"] as? String == "online" else {
    XCTFail("Settings captures require the online disposable fixture"); return
  }
  let previous = app.launchArguments
  var arguments = previous
  for flag in ["-AppleLanguages", "-AppleLocale", "-AppleInterfaceStyle", "-UIPreferredContentSizeCategoryName"] {
    while let index = arguments.firstIndex(of: flag) {
      let end = min(index + 2, arguments.count)
      arguments.removeSubrange(index..<end)
    }
  }
  arguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", language == "pl" ? "pl_PL" : "en_GB",
                "-AppleInterfaceStyle", "Dark", "-UIPreferredContentSizeCategoryName", "UICTContentSizeCategoryAccessibilityXXXL"]
  app.terminate(); app.launchArguments = arguments; app.launch()
  defer { app.terminate(); app.launchArguments = previous; app.launch() }
  let pl = language == "pl"
  let profile = app.buttons.matching(NSPredicate(format: "label == %@", pl ? "Profil" : "Profile")).firstMatch
  XCTAssertTrue(profile.waitForExistence(timeout: 30)); profile.tap()
  let synthetic = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Disposable Native QA, ")).firstMatch
  guard synthetic.waitForExistence(timeout: 10) else {
    XCTFail("No settings navigation outside synthetic principal"); return
  }
  qaFooterCapture("\(language) dark maximum text — Profile top")
  let settings = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", pl ? "Ustawienia nauki" : "Study Settings")).firstMatch
  qaFooterReveal(settings, name: "\(language) — Study Settings navigation target"); settings.tap()
  let repetitionText = pl
    ? "Pytanie jest opanowane po tylu poprawnych odpowiedziach. Błędna odpowiedź dodaje kolejne powtórki. Limit określa, ile razy jedno pytanie może wrócić."
    : "A question is mastered after this many correct answers. A wrong answer adds more repetitions. The limit caps how many times one question can come back."
  let repetition = qaFooterText(repetitionText)
  qaFooterReveal(repetition, name: "\(language) dark maximum text — Repetition footer")
  XCTAssertEqual(repetition.label, repetitionText)
  try qaFooterRecordAudit("\(language) Repetition")
  let aiText = pl ? "Podpowiedzi i asystent w quizach. Odpowiedzi AI mogą zawierać błędy." : "Hints and the assistant in quizzes. AI answers can contain mistakes."
  let aiFooter = qaFooterText(aiText)
  qaFooterReveal(aiFooter, name: "\(language) dark maximum text — AI explanation footer")
  let notificationText = pl ? "Wybierz, które powiadomienia chcesz otrzymywać. Zmiany zapisują się automatycznie." : "Choose which notifications you get. Changes are saved automatically."
  let notificationFooter = qaFooterText(notificationText)
  qaFooterReveal(notificationFooter, name: "\(language) dark maximum text — Notifications footer fully scrolled")
  XCTAssertEqual(notificationFooter.label, notificationText)
  XCTAssertGreaterThan(notificationFooter.frame.height, 60, "Expected wrapped accessibility text; verify host DynamicType configuration if this is still default-sized")
  try qaFooterRecordAudit("\(language) Notifications after full scroll")
  let back = app.navigationBars.buttons.firstMatch
  guard back.waitForExistence(timeout: 10), back.isHittable else {
    XCTFail("No reachable back action after Study Settings captures"); return
  }
  back.tap()
  XCTAssertTrue(settings.waitForExistence(timeout: 10))
  let account = app.buttons.matching(NSPredicate(format: "label == %@", pl ? "Konto i prywatność" : "Account & Privacy")).firstMatch
  qaFooterReveal(account, name: "\(language) — Account navigation target"); account.tap()
  let privacyText = pl
    ? "Ukryty profil nie pojawia się w wyszukiwaniu po imieniu i nazwisku ani w rankingach. Nadal można cię znaleźć po pełnym numerze indeksu."
    : "Hiding your profile removes it from name searches and leaderboards. People can still find you by your full student number."
  let privacyFooter = qaFooterText(privacyText)
  qaFooterReveal(privacyFooter, name: "\(language) dark maximum text — Account privacy footer")
  XCTAssertEqual(privacyFooter.label, privacyText)
  try qaFooterRecordAudit("\(language) Account privacy")
  let current = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", pl ? "Używasz jej teraz" : "You’re using this app")).firstMatch
  qaFooterReveal(current, name: "\(language) dark maximum text — Current connected app")
  XCTAssertEqual(current.value as? String, pl ? "Zwinięte" : "Collapsed")
  current.tap() // Local expansion only. Never swipe or disconnect.
  let expanded = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", pl ? "Rozwinięte" : "Expanded"), object: current)
  XCTAssertEqual(XCTWaiter.wait(for: [expanded], timeout: 5), .completed)
  qaFooterCapture("\(language) dark maximum text — Connected app expanded permissions")
  let connectedText = pl
    ? "Aplikacje z dostępem do Twojego konta Testownika. Dotknij, aby zobaczyć uprawnienia, lub przesuń w lewo, aby odłączyć. Aplikacji, której używasz, nie można odłączyć — wyloguj się."
    : "Apps with access to your Testownik account. Tap to see permissions or swipe left to disconnect. To remove this app, sign out instead."
  let connectedFooter = qaFooterText(connectedText)
  qaFooterReveal(connectedFooter, name: "\(language) dark maximum text — Connected Apps footer")
  XCTAssertEqual(connectedFooter.label, connectedText)
  try qaFooterRecordAudit("\(language) Connected Apps")
  let accountBack = app.navigationBars.buttons.firstMatch
  guard accountBack.waitForExistence(timeout: 10), accountBack.isHittable else {
    XCTFail("No reachable back action after Account captures"); return
  }
  accountBack.tap()
  XCTAssertTrue(account.waitForExistence(timeout: 10))
  let attribution = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", pl ? "Aplikacja mobilna: Antoni Czaplicki." : "Mobile app by Antoni Czaplicki.")).firstMatch
  qaFooterReveal(attribution, name: "\(language) dark maximum text — Profile attribution footer")
  XCTAssertTrue(attribution.label.hasSuffix(pl ? "Aplikacja mobilna: Antoni Czaplicki." : "Mobile app by Antoni Czaplicki."))
  try qaFooterRecordAudit("\(language) Profile attribution")
}

func testSyntheticMaximumTextSettingsEnglishDark() throws { try qaMaximumSettings("en") }
func testSyntheticMaximumTextSettingsPolishDark() throws { try qaMaximumSettings("pl") }

func testSyntheticStudyBrandCollapseAndExpand() throws {
  guard ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
        ProcessInfo.processInfo.environment["TESTOWNIK_SYNTHETIC_OAUTH"] == "1" else {
    XCTFail("Refusing UI actions without explicit disposable synthetic fixture guards"); return
  }
  guard #available(iOS 26.0, *) else { throw XCTSkip("Native title image is installed only on iOS26+") }
  guard ProcessInfo.processInfo.environment["TESTOWNIK_QA_STUDY_SCROLLABLE"] == "1" else {
    throw XCTSkip("Root must verify synthetic Study content exceeds viewport; sparse refreshable bounce is not a collapse proof")
  }
  let pl = ProcessInfo.processInfo.environment["TESTOWNIK_LANGUAGE"] == "pl"
  let study = app.buttons.matching(NSPredicate(format: "label == %@", pl ? "Nauka" : "Study")).firstMatch
  XCTAssertTrue(study.waitForExistence(timeout: 30)); study.tap()
  qaFooterScroll(up: false); qaFooterScroll(up: false)
  qaFooterSettle(1)
  let logo = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Testownik")).firstMatch
  XCTAssertTrue(logo.waitForExistence(timeout: 10))
  let bar = app.navigationBars.firstMatch // Native blank title removes Study AX identifier.
  XCTAssertTrue(bar.exists); XCTAssertTrue(bar.frame.contains(logo.frame))
  XCTAssertGreaterThanOrEqual(logo.frame.height, 30)
  XCTAssertLessThanOrEqual(logo.frame.height, 38)
  let expandedHeight = bar.frame.height
  qaFooterCapture("Study brand expanded", note: "Header: \(bar.frame)\nLogo: \(logo.frame)")
  qaFooterScroll(up: true, large: true)
  let collapsed = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    bar.frame.height < expandedHeight - 15
  }, object: bar)
  XCTAssertEqual(XCTWaiter.wait(for: [collapsed], timeout: 5), .completed, "Study must have scrollable fixture content; do not fabricate a collapse when content fits")
  qaFooterSettle(1)
  XCTAssertLessThan(bar.frame.height, expandedHeight - 15, "A transient rubber-band collapse must not pass")
  qaFooterCapture("Study brand collapsed", note: "Header: \(bar.frame)\nLogo AX: \(logo.debugDescription)")
  XCTAssertTrue(study.isSelected)
  // Inline brand can have another AX representation; screenshot is mandatory.
  let inline = bar.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Testownik")).allElementsBoundByIndex
    .first(where: { $0.frame.height > 0 && $0.frame.height <= 24 && bar.frame.contains($0.frame) })
  qaFooterCapture("Study inline brand AX observation", note: inline?.debugDescription ?? "Inline NSTextAttachment not exposed separately; judge collapsed screenshot")
  qaFooterScroll(up: false, large: true); qaFooterScroll(up: false)
  qaFooterSettle(1)
  let restored = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    bar.frame.height >= expandedHeight - 2 && logo.exists && bar.frame.contains(logo.frame)
  }, object: bar)
  XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed)
  qaFooterCapture("Study brand re-expanded", note: "Header: \(bar.frame)\nLogo: \(logo.frame)")
}


// Proposal to insert INSIDE NativeFlows. Root owns NativeFlows.swift and compilation.
// Name intentionally follows the disposable-fixture setup branch, never REAL_ACCOUNT.
// Catalog GET8768 was verified200 with2 models/default via existing synthetic token.
// No Send/AI Hint/model selection action exists in this method.
func testSyntheticAssistantModelPickerDraftRecovery() throws {
  XCTAssertEqual(ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"], "1")
  XCTAssertEqual(ProcessInfo.processInfo.environment["TESTOWNIK_SYNTHETIC_OAUTH"], "1")
  let expectedState = ProcessInfo.processInfo.environment["TESTOWNIK_MODEL_EXPECTATION"] ?? "list"
  XCTAssertTrue(["list", "error", "loading"].contains(expectedState))
  let control = try nativeComposeControl()
  XCTAssertEqual(control["network"] as? String, expectedState == "error" ? "offline" : "online")
  // Root runs online first to cache A. For error, relaunch under existing global
  // offline control so catalog memory cache is empty but quiz/profile are saved.
  // Loading REQUIRES the reviewed catalog-only hold plus waiter/counter proof;
  // the opt-in helper below supplies Close/late-response acceptance separately.
  openSyntheticImageQuiz("A", saved: expectedState == "error")
  let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
  XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
  let composer = app.descendants(matching: .any).matching(identifier: "assistant-composer").firstMatch
  XCTAssertTrue(composer.waitForExistence(timeout: 10), app.debugDescription)
  XCTAssertTrue(composer.isHittable)
  let placeholder = ["", "Ask about this question…", "Zapytaj o to pytanie…"]
  let original = composer.value as? String ?? ""
  try XCTSkipUnless(placeholder.contains(original) || original.hasPrefix("Native QA model draft "), "Preserve an unrelated existing draft")
  let draft = placeholder.contains(original) ? "Native QA model draft " + String(UUID().uuidString.prefix(6)) : original
  if placeholder.contains(original) {
    composer.tap()
    XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 5))
    // Type individual characters and assert the exact value. Keyboard-control
    // comparison belongs to root; this test does not diagnose an input defect.
    for character in draft { composer.typeText(String(character)) }
  }
  let retainedDraft = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", draft), object: composer)
  XCTAssertEqual(XCTWaiter.wait(for: [retainedDraft], timeout: 5), .completed)
  let send = app.buttons.matching(NSPredicate(format: "label IN %@", ["Wyślij wiadomość", "Send message"])).firstMatch
  XCTAssertTrue(send.exists)
  XCTAssertGreaterThanOrEqual(send.frame.width, 44)
  XCTAssertGreaterThanOrEqual(send.frame.height, 44)
  let model = app.buttons.matching(NSPredicate(format: "label IN %@", ["Model AI", "AI Model"])).firstMatch
  XCTAssertTrue(model.waitForExistence(timeout: 10)); XCTAssertTrue(model.isHittable)
  model.tap() // Strict draft flush must finish before navigation.
  let close = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij wybór modelu", "Close model picker"])).firstMatch
  XCTAssertTrue(close.waitForExistence(timeout: 10), app.debugDescription)
  XCTAssertTrue(close.isHittable); XCTAssertTrue(close.isEnabled)
  switch expectedState {
  case "error":
    XCTAssertTrue(app.staticTexts.matching(identifier: "Disposable native QA transport unavailable.").firstMatch.waitForExistence(timeout: 20), app.debugDescription)
    XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label IN %@", ["Spróbuj ponownie", "Try Again"])).firstMatch.exists)
  case "loading":
    XCTAssertTrue(app.activityIndicators.firstMatch.waitForExistence(timeout: 3), "Root must provision a delayed catalog; a fast response does not prove loading-state coverage")
  default:
    let inherited = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ OR label BEGINSWITH %@", "Użyj ustawień nauki", "Use Study Settings")).firstMatch
    XCTAssertTrue(inherited.waitForExistence(timeout: 20), app.debugDescription)
  }
  let pickerCapture = XCTAttachment(screenshot: app.screenshot())
  pickerCapture.name = "Synthetic assistant model picker " + expectedState
  pickerCapture.lifetime = .keepAlways; add(pickerCapture)
  close.tap()
  XCTAssertTrue(composer.waitForExistence(timeout: 10)); XCTAssertTrue(composer.isHittable)
  let retainedAfterPicker = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", draft), object: composer)
  XCTAssertEqual(XCTWaiter.wait(for: [retainedAfterPicker], timeout: 10), .completed, "Closing model picker must preserve exact unsent draft")
  let closeAssistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij asystenta", "Close assistant"])).firstMatch
  XCTAssertTrue(closeAssistant.isHittable); closeAssistant.tap()
  XCTAssertTrue(assistant.waitForExistence(timeout: 10)); assistant.tap()
  XCTAssertTrue(composer.waitForExistence(timeout: 10))
  let retainedAfterSheet = XCTNSPredicateExpectation(predicate: NSPredicate(format: "value == %@", draft), object: composer)
  XCTAssertEqual(XCTWaiter.wait(for: [retainedAfterSheet], timeout: 10), .completed, "Assistant reopen must retain exact draft")
  let capture = XCTAttachment(screenshot: app.screenshot())
  capture.name = "Synthetic draft retained after model Close and assistant reopen"
  capture.lifetime = .keepAlways; add(capture)
  closeAssistant.tap()
  if expectedState == "list", ProcessInfo.processInfo.environment["TESTOWNIK_NATIVE_CATALOG_LOADING"] == "1" {
    try qaSyntheticCatalogLoadingClose(draft: draft)
  }
}

// PREPARED ONLY. Root inserts INSIDE NativeFlows and compiles/runs serially.
// At the end of testSyntheticAssistantModelPickerDraftRecovery, AFTER its final
// closeAssistant.tap(), add only:
// if expectedState == "list", ProcessInfo.processInfo.environment["TESTOWNIK_NATIVE_CATALOG_LOADING"] == "1" {
//   try qaSyntheticCatalogLoadingClose(draft: draft)
// }
// Existing list pass + strict flush + assistant reopen establish persisted exact
// draft BEFORE this helper starts. Never call from error/loading expectation.

private final class QACatalogNoRedirect: NSObject, URLSessionTaskDelegate {
  func urlSession(_ session: URLSession, task: URLSessionTask,
                  willPerformHTTPRedirection response: HTTPURLResponse,
                  newRequest request: URLRequest,
                  completionHandler: @escaping (URLRequest?) -> Void) {
    completionHandler(nil)
  }
}

private struct QACatalogStatus: CustomStringConvertible {
  let catalog: String
  let generation: Int
  let remaining: Int
  let started: Int
  let waiting: Int
  let released: Int
  let completed: Int
  let timedOut: Int
  var description: String {
    "catalog=\(catalog) generation=\(generation) remaining_ms=\(remaining) started=\(started) waiting=\(waiting) released=\(released) completed=\(completed) timed_out=\(timedOut)"
  }
}

private func qaCatalogControl(_ action: String? = nil) throws -> QACatalogStatus {
  let env = ProcessInfo.processInfo.environment
  guard env["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
        env["TESTOWNIK_SYNTHETIC_OAUTH"] == "1",
        env["TESTOWNIK_NATIVE_CATALOG_LOADING"] == "1",
        env["TESTOWNIK_NATIVE_CATALOG_SOURCE_VERIFIED"] == "1",
        env["TESTOWNIK_NATIVE_CATALOG_EXCLUSIVE"] == "1",
        action == nil || action == "hold" || action == "release" else {
    throw NSError(domain: "NativeQACatalogSafety", code: 1)
  }
  // Fixed loopback URL, no token/cookie/body outside exact catalog control.
  // No redirect permitted by root-reviewed endpoint; never network/mode/reset.
  var request = URLRequest(url: URL(string: "http://127.0.0.1:8768/__native_qa_control")!)
  request.timeoutInterval = 1.5
  request.cachePolicy = .reloadIgnoringLocalCacheData
  if let action {
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["catalog": action])
  }
  let done = XCTestExpectation(description: "Bounded local catalog control")
  var data: Data?
  var response: HTTPURLResponse?
  var failure: Error?
  let configuration = URLSessionConfiguration.ephemeral
  configuration.httpCookieStorage = nil
  configuration.urlCredentialStorage = nil
  configuration.urlCache = nil
  configuration.connectionProxyDictionary = [:]
  configuration.httpShouldSetCookies = false
  let session = URLSession(configuration: configuration, delegate: QACatalogNoRedirect(), delegateQueue: nil)
  defer { session.invalidateAndCancel() }
  let task = session.dataTask(with: request) { body, result, error in
    data = body; response = result as? HTTPURLResponse; failure = error; done.fulfill()
  }
  task.resume()
  guard XCTWaiter.wait(for: [done], timeout: 2) == .completed else {
    task.cancel()
    throw XCTSkip("Catalog control deadline: inconclusive, no lease renewal")
  }
  guard failure == nil, response?.statusCode == 200,
        response?.url?.absoluteString == request.url?.absoluteString,
        let data, data.count <= 16384,
        let value = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
        value["mode"] as? String == "compose-503",
        value["block_delivery"] as? Bool == true,
        value["network"] as? String == "online",
        let catalog = value["catalog"] as? String, ["pass", "hold"].contains(catalog),
        let generation = value["catalog_generation"] as? Int, generation >= 0,
        let remaining = value["catalog_remaining_ms"] as? Int, remaining >= 0,
        let started = value["catalog_started"] as? Int, started >= 0,
        let waiting = value["catalog_waiting"] as? Int, waiting >= 0,
        let released = value["catalog_released"] as? Int, released >= 0,
        let completed = value["catalog_completed"] as? Int, completed >= 0,
        let timedOut = value["catalog_timed_out"] as? Int, timedOut >= 0 else {
    throw XCTSkip("Unverified catalog control: preserve app state, no loading verdict")
  }
  return QACatalogStatus(catalog: catalog, generation: generation, remaining: remaining,
                         started: started, waiting: waiting, released: released,
                         completed: completed, timedOut: timedOut)
}

private func qaSyntheticCatalogLoadingClose(draft: String) throws {
  let env = ProcessInfo.processInfo.environment
  guard env["TESTOWNIK_MODEL_EXPECTATION", default: "list"] == "list",
        env["TESTOWNIK_LANGUAGE"] == "en",
        env["TESTOWNIK_NATIVE_CATALOG_LOADING"] == "1",
        env["TESTOWNIK_NATIVE_CATALOG_SOURCE_VERIFIED"] == "1",
        env["TESTOWNIK_NATIVE_CATALOG_EXCLUSIVE"] == "1",
        let expectedModel = env["TESTOWNIK_NATIVE_CATALOG_MODEL_LABEL"],
        !expectedModel.isEmpty, expectedModel.count <= 120 else {
    throw XCTSkip("Root must verify exclusive catalog controls and one actual catalog label")
  }
  let previousFailurePolicy = continueAfterFailure
  continueAfterFailure = true // Native XCTest action failures must not bypass Swift cleanup.
  defer { continueAfterFailure = previousFailurePolicy }
  func poll(_ seconds: TimeInterval, _ condition: () -> Bool) -> Bool {
    let start = ProcessInfo.processInfo.systemUptime
    repeat {
      if condition() { return true }
      qaFooterSettle(0.05)
    } while ProcessInfo.processInfo.systemUptime - start < seconds
    return false
  }
  // Root attests current Release uses API8768 and reviewed threaded fixture;
  // controls above validate compose-503 + block_delivery + online on every read.
  _ = try qaCatalogControl()
  app.terminate(); app.launch() // Clears memory query cache, preserves owned draft.
  let profile = app.buttons.matching(NSPredicate(format: "label IN %@", ["Profil", "Profile"])).firstMatch
  guard profile.waitForExistence(timeout: 20) else { XCTFail("No Profile after cold launch"); return }
  profile.tap()
  guard app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Disposable Native QA, ")).firstMatch.waitForExistence(timeout: 10) else {
    XCTFail("Refuse catalog test outside synthetic principal"); return
  }
  openSyntheticImageQuiz("A", saved: false)
  let assistant = app.buttons.matching(NSPredicate(format: "label IN %@", ["Asystent", "Assistant"])).firstMatch
  guard assistant.waitForExistence(timeout: 10), assistant.isHittable else { XCTFail("No Assistant before lease"); return }
  let composer = app.descendants(matching: .any).matching(identifier: "assistant-composer").firstMatch
  let model = app.buttons.matching(NSPredicate(format: "label IN %@", ["Model AI", "AI Model"])).firstMatch
  let closePicker = app.buttons.matching(NSPredicate(format: "label IN %@", ["Zamknij wybór modelu", "Close model picker"])).firstMatch
  let actualModel = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", expectedModel)).firstMatch
  let before = try qaCatalogControl()
  guard before.catalog == "pass", before.waiting == 0 else {
    throw XCTSkip("Existing catalog hold/waiter belongs to another setup; no new hold: \(before)")
  }
  var cleanupArmed = false
  defer {
    if cleanupArmed {
      do {
        let current = try qaCatalogControl()
        if current.generation == before.generation + 1 {
          _ = try qaCatalogControl("release") // Only owned catalog, never connectivity.
          var drained = try qaCatalogControl()
          let drainStart = ProcessInfo.processInfo.systemUptime
          while drained.waiting != 0 && ProcessInfo.processInfo.systemUptime - drainStart < 3 {
            qaFooterSettle(0.05)
            drained = try qaCatalogControl()
          }
          XCTAssertEqual(drained.catalog, "pass")
          XCTAssertEqual(drained.waiting, 0, "Root must drain/review any outstanding waiter before restarting fixture")
        } else if current.generation == before.generation && current.catalog == "pass" && current.waiting == 0 {
          // Hold POST never landed. No lease is owned and no release is necessary.
        } else {
          XCTFail("Catalog generation changed; refuse releasing another owner's hold: \(current)")
        }
      } catch {
        XCTFail("Catalog cleanup not verified; root must release/drain owned catalog before further tests")
      }
    }
  }
  let startedAt = ProcessInfo.processInfo.systemUptime
  func budget(_ stage: String) throws {
    guard ProcessInfo.processInfo.systemUptime - startedAt < 17 else {
      throw XCTSkip("20-second catalog lease budget exceeded at \(stage); inconclusive, no renewal")
    }
  }
  cleanupArmed = true // Also cleans up an acknowledged-lost hold POST.
  let held = try qaCatalogControl("hold") // Exactly one hold, immediately before mount.
  guard held.catalog == "hold", held.generation == before.generation + 1,
        held.waiting == 0, held.remaining >= 17000 else {
    throw XCTSkip("Fresh20-second catalog hold not established; no renewal: \(held)")
  }
  assistant.tap() // Assistant prefetch starts only after this cold mount.
  try budget("Assistant mount")
  var waiting = try qaCatalogControl()
  let waitStart = ProcessInfo.processInfo.systemUptime
  while waiting.waiting == 0 && ProcessInfo.processInfo.systemUptime - waitStart < 3 {
    qaFooterSettle(0.05)
    waiting = try qaCatalogControl()
  }
  guard waiting.catalog == "hold", waiting.generation == held.generation,
        waiting.waiting == 1, waiting.started == before.started + 1,
        waiting.timedOut == before.timedOut else {
    throw XCTSkip("Catalog cache/retry/lease precondition failed; spinner alone is insufficient: \(waiting). More than one waiter is a separately recorded dedup candidate, not loading acceptance.")
  }
  guard poll(2, { composer.exists && model.exists && model.isHittable && model.isEnabled }) else {
    throw XCTSkip("History/settings not ready within lease; no renewal. Last status: \(waiting)")
  }
  guard composer.value as? String == draft else {
    XCTFail("Ready cold Assistant did not restore the pre-established exact persisted draft"); return
  }
  try budget("picker open")
  model.tap() // Existing strict local flush; no model selection.
  guard closePicker.waitForExistence(timeout: 2), closePicker.isHittable, closePicker.isEnabled,
        (app.activityIndicators.firstMatch.waitForExistence(timeout: 1) || app.otherElements["Loading"].exists),
        !actualModel.exists else {
    throw XCTSkip("Loading/Close not observed within live lease; inconclusive. Last status: \(waiting)")
  }
  // One screenshot only during lease; defer expensive hierarchy capture until release.
  let loading = XCTAttachment(screenshot: app.screenshot())
  loading.name = "Native catalog loading with reachable Close"; loading.lifetime = .keepAlways; add(loading)
  try budget("picker Close")
  closePicker.tap()
  guard poll(2, { composer.exists && composer.isHittable && !closePicker.exists }) else {
    _ = try qaCatalogControl("release") // Release FIRST, then distinguish data loss from slow navigation.
    qaFooterSettle(1)
    qaFooterCapture("Catalog Close transition exceeded lease budget — released for inspection")
    if composer.exists && composer.isHittable && !closePicker.exists && composer.value as? String != draft {
      XCTFail("Picker Close lost the exact pre-established draft after released transition settled"); return
    }
    let releasedStatus = try qaCatalogControl()
    throw XCTSkip("Close transition not observable within lease; last parked status: \(releasedStatus)")
  }
  guard composer.value as? String == draft else {
    _ = try qaCatalogControl("release")
    qaFooterSettle(1)
    guard composer.value as? String == draft else {
      XCTFail("Picker Close persistently lost the exact pre-established draft"); return
    }
    throw XCTSkip("Draft needed more time than live lease observation budget; released without renewal")
  }
  try budget("before release")
  let parked = try qaCatalogControl()
  guard parked.catalog == "hold", parked.generation == held.generation,
        parked.remaining >= 1000, parked.waiting == 1,
        parked.started == before.started + 1, parked.timedOut == before.timedOut else {
    throw XCTSkip("Catalog no longer parked before release; late-completion cell inconclusive: \(parked)")
  }
  _ = try qaCatalogControl("release") // Release only catalog, once; cleanup is idempotent.
  let finishStart = ProcessInfo.processInfo.systemUptime
  var after = try qaCatalogControl()
  while after.waiting != 0 || after.completed < before.completed + 1 {
    if after.timedOut > before.timedOut {
      throw XCTSkip("Catalog lease expired; no loading/late-completion acceptance: \(after)")
    }
    guard ProcessInfo.processInfo.systemUptime - finishStart < 8 else {
      throw XCTSkip("Released catalog did not finish; no resolved-model verdict: \(after)")
    }
    qaFooterSettle(0.05)
    after = try qaCatalogControl()
  }
  guard after.catalog == "pass", after.generation == held.generation,
        after.started == before.started + 1, after.released == before.released + 1,
        after.completed == before.completed + 1, after.waiting == 0,
        after.timedOut == before.timedOut else {
    throw XCTSkip("Unexpected held catalog counters; preserve evidence and do not renew: \(after)")
  }
  // Server completion is NOT client receipt. Observe stable Assistant before the
  // intentional reopen; that resolved real list supplies the later client-side proof.
  qaFooterSettle(1.5)
  guard !closePicker.exists, composer.isHittable, composer.value as? String == draft else {
    XCTFail("Late catalog completion changed navigation or the retained draft"); return
  }
  qaFooterSettle(1)
  guard !closePicker.exists, composer.isHittable, composer.value as? String == draft else {
    XCTFail("Catalog completion reopened the dismissed picker or changed the draft"); return
  }
  qaFooterCapture("Catalog server completed after Close — stable assistant exact draft, no automatic overlay")
  guard model.isHittable && model.isEnabled else { XCTFail("Model row unavailable after release"); return }
  model.tap() // Separate intentional post-release reopen, never an automatic overlay.
  guard actualModel.waitForExistence(timeout: 10), closePicker.exists else {
    XCTFail("Real resolved catalog row absent; counters alone do not prove successful catalog UI"); return
  }
  qaFooterCapture("Intentional post-release picker reopen — real model list, no selection")
  closePicker.tap()
  guard poll(10, { composer.exists && composer.isHittable && !closePicker.exists }) else {
    XCTFail("Intentional resolved picker Close did not restore Assistant"); return
  }
  qaFooterSettle(2) // Actual model list proved client receipt before this final no-overlay check.
  guard !closePicker.exists, composer.isHittable, composer.value as? String == draft else {
    XCTFail("After resolved catalog UI, exact draft/navigation did not remain stable"); return
  }
  qaFooterCapture("Post-release resolved model list Close — exact draft retained, no overlay")
  // No Send, AI Hint, model selection, draft cleanup or connectivity change.
}

// Evidence limits: Assistant's query starts this request without consuming its
// signal. This proves a response arriving after picker dismissal; it does NOT
// prove transport cancellation, picker-owned fetch cancellation, provider calls,
// or absence of an unheld auth-refresh retry after release. Held counters alone
// cannot identify an unheld401/retry; actual resolved model UI is required.
// Multiple waiters remain runbook-inconclusive and a separately recorded dedup
// candidate. No hold renewal is attempted. Native execution remains unverified.


// Insert inside NativeFlows after root review. Read-only synthetic navigation.
func testSyntheticHomeBrandHitTargets() throws {
  let environment = ProcessInfo.processInfo.environment
  guard environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
        environment["TESTOWNIK_SYNTHETIC_OAUTH"] == "1",
        environment["TESTOWNIK_QA_APPEARANCE_VERIFIED"] == "1",
        let appearance = environment["TESTOWNIK_QA_APPEARANCE"],
        ["light", "dark"].contains(appearance), environment["TESTOWNIK_LANGUAGE"] == "en" else {
    throw XCTSkip("Verified synthetic English host appearance required")
  }
  guard #available(iOS 26.0, *) else { throw XCTSkip("Native image title requires iOS26+") }
  app.terminate(); app.launch()
  let study = app.buttons.matching(NSPredicate(format: "label == %@", "Study")).firstMatch
  guard study.waitForExistence(timeout: 20), study.isSelected else {
    XCTFail("Fresh launch must show Study"); return
  }
  let logo = app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", "Testownik")).firstMatch
  guard logo.waitForExistence(timeout: 10) else { XCTFail("Cold brand absent"); return }
  let bar = app.navigationBars.firstMatch
  XCTAssertTrue(bar.frame.contains(logo.frame))
  let first = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Continue: Native QA ")).firstMatch
  guard first.waitForExistence(timeout: 10), first.isHittable else {
    throw XCTSkip("Synthetic Continue row absent before menu; cannot claim hit coverage")
  }
  let title = String(first.label.dropFirst("Continue: ".count))
  guard !title.isEmpty, title.count < 200 else { XCTFail("Unexpected synthetic row label"); return }
  let newQuiz = app.buttons.matching(NSPredicate(format: "label == %@", "New Quiz")).firstMatch
  let importQuiz = app.buttons.matching(NSPredicate(format: "label == %@", "Import Quiz")).firstMatch
  guard !newQuiz.exists && !importQuiz.exists else { XCTFail("Menu selectors already match background content"); return }
  qaFooterCapture("Study brand \(appearance) cold and first row")
  let addQuiz = bar.buttons.matching(NSPredicate(format: "label == %@", "Add Quiz")).firstMatch
  guard addQuiz.waitForExistence(timeout: 5), addQuiz.isHittable else { XCTFail("Add Quiz unreachable"); return }
  addQuiz.tap()
  guard newQuiz.waitForExistence(timeout: 5), importQuiz.exists else { XCTFail("Native add menu absent"); return }
  qaFooterCapture("Study brand \(appearance) native add menu")
  // Dismiss in the outer list gutter without choosing an action.
  app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.6)).tap()
  let dismissed = XCTNSPredicateExpectation(predicate: NSPredicate(format: "exists == false"), object: newQuiz)
  guard XCTWaiter.wait(for: [dismissed], timeout: 5) == .completed,
        study.isSelected, logo.exists, first.isHittable,
        !app.navigationBars["New Quiz"].exists, !app.navigationBars["Import Quiz"].exists else {
    XCTFail("Add menu dismissal left Study or obscured its first row"); return
  }
  // Record the exact card-edge point and prove it clears the native header.
  let rowFrame = first.frame
  let point = CGPoint(x: rowFrame.minX + 2, y: rowFrame.midY)
  guard point.y > bar.frame.maxY, app.frame.contains(point) else {
    XCTFail("First-row edge target is obscured by navigation chrome"); return
  }
  qaFooterCapture("Study brand \(appearance) first-row edge before tap", note: "Tap: \(point)\nRow: \(rowFrame)\nBar: \(bar.frame)")
  first.coordinate(withNormalizedOffset: .zero).withOffset(CGVector(dx: 2, dy: rowFrame.height / 2)).tap()
  guard app.navigationBars[title].waitForExistence(timeout: 15) else {
    XCTFail("Leading-edge first row tap did not open the exact synthetic quiz"); return
  }
  qaFooterCapture("Study brand \(appearance) leading-edge row opened exact quiz")
  // No answer selection, Check, editor mutation, permission or external action.
}


// Insert INSIDE NativeFlows. Root owns integration/compiler/VM. Add import UIKit.
// Two independent methods/runs; each requires fresh host UUID and one SIGTERM max.
// No Submit, Check, Next, model choice, AI, feedback/report or private app storage.
private func qaWKProcessStage(questionStage: Bool) throws {
  let env = ProcessInfo.processInfo.environment
  guard env["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1",
        env["TESTOWNIK_SYNTHETIC_OAUTH"] == "1",
        env["TESTOWNIK_WK_OS_TERMINATION"] == "1",
        let rawRun = env["TESTOWNIK_WK_RUN_ID"], let uuid = UUID(uuidString: rawRun) else {
    throw XCTSkip("Explicit disposable OS-termination run and fresh UUID required")
  }
  let run = uuid.uuidString
  guard Bundle.main.bundleIdentifier == "pl.solvro.testownik.uitests.xctrunner" else {
    XCTFail("Handshake must originate in the exact isolated XCTest runner"); return
  }
  let control = try nativeComposeControl()
  guard control["network"] as? String == "online" else {
    XCTFail("Load only the online synthetic WK fixture"); return
  }
  let pl = env["TESTOWNIK_LANGUAGE"] == "pl"
  let profile = app.buttons.matching(NSPredicate(format: "label == %@", pl ? "Profil" : "Profile")).firstMatch
  guard profile.waitForExistence(timeout: 20) else { XCTFail("No synthetic Profile"); return }
  profile.tap()
  let identity = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "Disposable Native QA, ")).firstMatch
  guard identity.waitForExistence(timeout: 10) else { XCTFail("Refusing non-synthetic account"); return }
  app.buttons.matching(NSPredicate(format: "label == %@", pl ? "Biblioteka" : "Library")).firstMatch.tap()
  let title = questionStage ? "Native QA WK Question C-Q" : "Native QA WK Answer C-A"
  let row = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", title)).firstMatch
  for _ in 0..<12 { if row.isHittable { break }; app.swipeUp() }
  guard row.exists && row.isHittable else { XCTFail("Root must seed exact WK fixture first"); return }
  row.tap()
  guard app.navigationBars[title].waitForExistence(timeout: 20) else { XCTFail("Wrong WK fixture screen"); return }
  let onlyWebView = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    self.app.webViews.count == 1 && self.app.webViews.firstMatch.frame.height > 32
  }, object: app)
  guard XCTWaiter.wait(for: [onlyWebView], timeout: 15) == .completed else {
    XCTFail("Must render exactly one formatted document; do not kill an ambiguous renderer"); return
  }
  let rawQuestion = "**Native WK QA question C-Q**\n\n- First line of formatting\n- Final line of formatting"
  let answerLabel = questionStage ? "Native WK QA plain answer C-Q" : "**Native WK QA formatted answer C-A**\n\nFinal formatted answer line."
  let answer = app.descendants(matching: .any).matching(NSPredicate(format: "identifier BEGINSWITH %@ AND label == %@", "study-answer-", answerLabel)).firstMatch
  guard answer.waitForExistence(timeout: 10) else { XCTFail("Exact fixture answer missing"); return }
  let uncheckedValue = answer.value as? String
  let uncheckedSelected = answer.isSelected
  answer.tap() // Local radio selection only. Never check or submit.
  let selected = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    answer.isSelected != uncheckedSelected || (answer.value as? String) != uncheckedValue
  }, object: answer)
  guard XCTWaiter.wait(for: [selected], timeout: 5) == .completed else {
    throw XCTSkip("Record actual radio AX semantics before claiming selection preservation")
  }
  let chosenValue = answer.value as? String
  let chosenSelected = answer.isSelected
  let check = app.buttons.matching(NSPredicate(format: "label IN %@", ["Sprawdź", "Check"])).firstMatch
  XCTAssertTrue(check.exists && check.isEnabled)
  let statusText = questionStage
    ? (pl ? "Nie udało się wyświetlić formatowania. Treść jest dostępna jako tekst." : "Formatting could not be displayed. The content is available as text.")
    : (pl ? "Formatowanie odpowiedzi jest niedostępne. Treść jest dostępna jako tekst." : "Answer formatting is unavailable. The content is available as text.")
  let status = app.staticTexts[statusText]
  guard !status.exists else { XCTFail("Fallback already present before host signal; no causal proof"); return }
  let documents = try XCTUnwrap(FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first)
  let stage = questionStage ? "ready-question" : "ready-answer"
  let marker = documents.appendingPathComponent("wk-process-qa-\(run)-\(stage).json")
  guard !FileManager.default.fileExists(atPath: marker.path) else { XCTFail("Never reuse a WK run/stage UUID"); return }
  let data = try JSONSerialization.data(withJSONObject: [
    "run_id": run, "stage": stage, "issued_at": Date().timeIntervalSince1970,
    "web_views": app.webViews.count, "synthetic_principal": "Disposable Native QA"
  ], options: [.sortedKeys])
  try data.write(to: marker, options: .atomic)
  defer { try? FileManager.default.removeItem(at: marker) }
  qaFooterCapture("WK \(stage) ready — before host signal")
  // Host dry-run + manually reviewed apply have at most120s. Native timeout
  // removes marker so a late host attempt refuses instead of affecting a new view.
  guard status.waitForExistence(timeout: 120) else { XCTFail("No native fallback after bounded host attempt"); return }
  XCTAssertEqual(app.webViews.count, 0)
  XCTAssertEqual(answer.value as? String, chosenValue)
  XCTAssertEqual(answer.isSelected, chosenSelected)
  XCTAssertTrue(check.isEnabled)
  if questionStage { XCTAssertTrue(app.staticTexts[rawQuestion].exists) }
  qaFooterCapture("WK \(stage) inert native fallback — selection retained")
  if env["TESTOWNIK_WK_IPAD_ROTATION"] == "1" {
    guard UIDevice.current.userInterfaceIdiom == .pad else { XCTFail("iPad rotation requires actual iPad runner"); return }
    let oldOrientation = XCUIDevice.shared.orientation
    defer { if oldOrientation != .unknown { XCUIDevice.shared.orientation = oldOrientation } }
    XCUIDevice.shared.orientation = .landscapeLeft
    qaFooterSettle(1)
    XCTAssertTrue(status.exists)
    XCTAssertEqual(answer.value as? String, chosenValue)
    XCTAssertEqual(answer.isSelected, chosenSelected)
    XCTAssertTrue(check.isHittable)
    qaFooterCapture("WK \(stage) fallback after iPad rotation")
  }
  let retry = questionStage
    ? app.buttons.matching(NSPredicate(format: "label IN %@", ["Wczytaj ponownie treść", "Reload Content"])).firstMatch
    : app.buttons.matching(identifier: "retry-answer-content").firstMatch
  for _ in 0..<12 { if retry.isHittable { break }; app.swipeUp() }
  XCTAssertTrue(retry.exists && retry.isHittable)
  retry.tap()
  let recovered = XCTNSPredicateExpectation(predicate: NSPredicate { _, _ in
    !status.exists && self.app.webViews.count == 1
  }, object: app)
  XCTAssertEqual(XCTWaiter.wait(for: [recovered], timeout: 20), .completed)
  XCTAssertEqual(answer.value as? String, chosenValue)
  XCTAssertEqual(answer.isSelected, chosenSelected)
  XCTAssertTrue(check.isEnabled)
  qaFooterCapture("WK \(stage) explicit document retry — same selection")
  // Reload Answers may remain present by design; the alert disappearing and
  // new WebView are recovery evidence, not the retry button disappearing.
}

func testSyntheticWKQuestionProcessTermination() throws { try qaWKProcessStage(questionStage: true) }
func testSyntheticWKAnswerProcessTermination() throws { try qaWKProcessStage(questionStage: false) }

}
