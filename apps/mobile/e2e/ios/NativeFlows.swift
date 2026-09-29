import XCTest

final class NativeFlows: XCTestCase {
  private let app = XCUIApplication(bundleIdentifier: "pl.solvro.testownik")

  override func setUpWithError() throws {
    continueAfterFailure = false
    if name.contains("testManualUSOSSignIn") {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_MANUAL_USOS"] == "1", "Interactive provider sign-in is opt-in.")
    } else if name.contains("testAuthenticatedAccountNavigation") || name.contains("testExistingQuizQuickActions") || name.contains("testProfilePhotoAndSettings") || name.contains("testInlineHintAndAssistantLayout") || name.contains("testEmbeddedStatistics") || name.contains("testWrappedSlideChrome") || name.contains("testStudyLocale") || name.contains("testGradesSimulator") || name.contains("testLibraryOrganization") || name.contains("testLibraryDrag") || name.contains("testEditorNavigationLayout") || name.contains("testEditorNavigationCompactAnswers") || name.contains("testEditorImagePicker") || name.contains("testEditorQuestionOverview") || name.contains("testSharingAndAccountLayout") || name.contains("testImportPreview") {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_REAL_ACCOUNT"] == "1", "Existing-account verification is opt-in.")
    } else {
      try XCTSkipUnless(ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1", "Regression tests require an explicitly selected disposable database.")
    }
    app.launchArguments = [
      "--initialUrl", "http://127.0.0.1:8081",
      "-EXDevMenuIsOnboardingFinished", "YES",
      "-EXDevMenuShowsAtLaunch", "NO",
      "-EXDevMenuShowFloatingActionButton", "NO"
    ]
    if let language = ProcessInfo.processInfo.environment["TESTOWNIK_LANGUAGE"], ["pl", "en"].contains(language) {
      app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", language == "pl" ? "pl_PL" : "en_GB"]
    }
    app.launch()
    if name.contains("testManualUSOSSignIn") { return }
    let library = app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Biblioteka", "Library"])).firstMatch
    if !library.waitForExistence(timeout: 5) {
      let guest = element("Wypróbuj jako gość")
      if ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] == "1", guest.waitForExistence(timeout: 15) { guest.tap() }
    }
    XCTAssertTrue(library.waitForExistence(timeout: 30), app.debugDescription)
  }

  override func tearDownWithError() throws {
    if name.contains("testManualUSOSSignIn") { return }
    if ProcessInfo.processInfo.environment["TESTOWNIK_DISPOSABLE_FIXTURE"] != "1" { return }
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
    XCTAssertTrue(app.steppers.firstMatch.waitForExistence(timeout: 10))
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
    let confirm = alert.buttons[polish ? "Potwierdź" : "Confirm"]
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
    XCTAssertTrue(app.searchFields.matching(NSPredicate(format: "label IN %@", ["Szukaj quizu", "Search quizzes", "Szukaj", "Search"])).firstMatch.waitForExistence(timeout: 10))
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

  func testGradesSimulator() throws {
    app.tabBars.buttons.matching(NSPredicate(format: "label IN %@", ["Oceny", "Grades"])).firstMatch.tap()
    let simulator = app.buttons.matching(NSPredicate(format: "label IN %@", ["Symulator", "Simulator"])).firstMatch
    XCTAssertTrue(simulator.waitForExistence(timeout: 60), app.debugDescription)
    let grades = XCTAttachment(screenshot: app.screenshot())
    grades.name = "Grades overview redesigned"
    grades.lifetime = .keepAlways
    add(grades)
    let actualAverage = app.staticTexts["grade-average"].label
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
    XCTAssertNotEqual(app.staticTexts["grade-average"].label, actualAverage)
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
    XCTAssertEqual(app.staticTexts["grade-average"].label, actualAverage)
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
    let title = app.webViews.staticTexts.matching(NSPredicate(format: "label BEGINSWITH %@", "Statystyki:")).firstMatch
    XCTAssertTrue(title.waitForExistence(timeout: 60), app.debugDescription)
    let visible = NSPredicate(format: "hittable == true")
    expectation(for: visible, evaluatedWith: title)
    waitForExpectations(timeout: 30)
    let metric = app.webViews.staticTexts["Liczba uruchomień"]
    XCTAssertTrue(metric.waitForExistence(timeout: 30), app.debugDescription)
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

    let field = app.searchFields.matching(NSPredicate(format: "label IN %@", ["Szukaj quizu", "Search quizzes", "Szukaj", "Search"])).firstMatch
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

}
