# Reviewer walkthrough recording plan

This is a recording script, not a recording or proof that the scenarios passed.

Use a dedicated Testownik review account containing only synthetic sample data. Seed `sample-quiz.json` using the `create_quiz` MCP tool or the normal quiz editor, then inspect the saved content. Do not record a personal account, passwords, token values, authorization codes, or unrelated browser tabs.

Record the actual ChatGPT integration and its results:

1. Show the Testownik connection and explain that OAuth limits access to the signed-in account and its available quizzes. Complete sign-in outside the recording if credentials would be visible.
2. Run positive case 1 from `plugin/plugin.json`: list, search, and inspect the sample quiz. Show that the result corresponds to the seeded data.
3. Run positive case 2: create the disposable planets quiz. Open it in Testownik and show three normal questions, four answer options each, and the AI-generated label.
4. Run positive case 3: add a question and edit its explanation. Show the newly saved question and that the original questions remain present.
5. Run positive case 4: start a study session, display one question without the answer key, choose an option yourself, and show the correctness result and updated progress.
6. Run positive case 5: explicitly restart the disposable study session. Show reset progress and intact quiz content.
7. Run all three negative cases: private data access is not allowed, unsupported question types are explained, and a preview-only request saves nothing.
8. End by showing the website support/privacy links and where a user can disconnect an authorized integration in account settings.

Upload the real recording to a stable URL that reviewers can open without requesting access. Add that URL to `extensions.com.openai.review.demo_recording_url`, rebuild the ZIP, and verify playback before submitting. Keep reviewer credentials in the dashboard's secure form only.
