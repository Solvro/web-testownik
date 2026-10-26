# Testownik ChatGPT publication

Status checked on 26 October 2026: **draft uploaded; not submitted or published**.

Active OpenAI draft: [Testownik](https://platform.openai.com/plugins/manage/plugin_asdk_app_6adfd7dbde5481918e605a87fa6d8d04).
Version: `appsub_6adfd7dbde9481919519639006a9f8cb`.
Developer identity verification is complete and the portal accepted the package.

The older draft `plugin_asdk_app_6a3327703c548191a37461e6c0df8d32` was retained. Its imported configuration required a different manifest name and an unavailable original MCP URL; uploads were rejected. Continue with the active draft above.

## Package

`plugin/` contains the public manifest, OAuth/CIMD MCP configuration, existing Testownik SVG icons, five positive review cases, three negative cases, and three example prompts. It contains no credentials or account data.

```sh
python3 integrations/chatgpt/build.py
```

The resulting `dist/testownik-0.1.0.zip` is a **draft package**. `--require-ready` rejects missing Terms of Service and video URLs; it does not certify live server behavior, legal compliance, or portal readiness. Screenshots and local evidence are excluded from Git and the ZIP.

## Domain verification

The active draft requires the exact public token stored in `public/.well-known/openai-apps-challenge` at:

`https://testownik.solvro.pl/.well-known/openai-apps-challenge`

The Next.js headers hook serves it as `text/plain; charset=utf-8`. The local production build returned HTTP 200 with the exact 43-byte body. Deploy, check the live URL, then use **Verify Domain** in the active draft's MCP connection dialog. This public challenge is a domain-ownership proof, not an authentication credential.

## Verified

- Production `/api/status/` returns HTTP 200 with status `ok`.
- Production `/api/mcp` rejects unauthenticated requests with HTTP 401.
- Root OAuth authorization-server and protected-resource metadata advertise the production MCP URL, authorization-code/refresh-token grants, PKCE S256, CIMD, and all five package scopes.
- The privacy policy includes MCP/OAuth processing and a support contact at `#kontakt`.
- The portal accepted the package, listing, test cases, and production MCP OAuth configuration.
- The connected Testownik tool requires reauthentication. No live reviewer tests or video are claimed.

## Remaining requirements

1. **Terms of Service:** deploy the restored `/terms` page. The service owner approved replacing the archived student/USOS-only clause with wording covering the available sign-in methods and guest access. After confirming the live page, add `termsOfServiceURL` to the manifest.
2. **Reviewer access:** provide a dedicated account containing only synthetic data. The portal supports either username/password or an email code sent to its assigned reviewer address. Testownik has a direct `/login-otp` route for existing email accounts; its normal email button instead redirects through Solvro Auth/Keycloak. Provision the portal-assigned address first and verify email delivery and OAuth continuation. The current admin interface intentionally disables adding users, so provisioning needs an authorized backend console. Keep account details outside the ZIP and Git and enter them only in the secure portal Review details form.
3. **MCP metadata deployment:** backend changes mark `get_quiz_session`, `get_next_question`, and `get_my_settings` as writes because they persist state. Descriptions disclose those writes and the default unlisted-by-link quiz visibility. Regression and OAuth tests cover these changes. Verify the deployed server's tool annotations before scanning.
4. **Domain verification and MCP connection:** deploy and verify the challenge above, authorize the intended account, and run the portal scan. Solvro's documented deployment dashboard at `https://devops.solvro.pl` returned Forbidden from this workstation; access remains unresolved.
5. **Live tests and recording:** seed `review/sample-quiz.json` in the dedicated account, run all eight cases in ChatGPT, and record the workflow described in `review/demo-script.md`. Add the real reviewer-accessible URL as `review.demo_recording_url`.
6. Upload the completed ZIP, resolve required findings, complete secure reviewer details and submission attestations, and submit for review. Publish only after OpenAI approval. The portal also reports a nonblocking category warning for `Productivity`.

## References

- [Upload and submit your plugin](https://developers.openai.com/plugins/deploy/submission)
- [Package and OAuth configuration](https://developers.openai.com/plugins/build/plugins)
- [Plugin guidelines](https://developers.openai.com/plugins/plugin-guidelines)
