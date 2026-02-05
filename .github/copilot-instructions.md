# Copilot Instructions (web-testownik)

## Project context

- Stack: Next.js + React + TypeScript + Tailwind CSS.
- Data fetching: TanStack Query; prefer SSR/SSG where possible (server-side prefetch + dehydrate/rehydrate) to avoid duplicate client fetches.
- Follow existing query keys and patterns; keep cache boundaries consistent with current usage (e.g., suspense, query providers).
- Prefer existing patterns and components from `src/` and established conventions.

## Coding guidelines

- Keep consistency with the current style and file structure.
- For UI changes, use existing components and Tailwind classes.

## `@solvro/config` requirements (commitlint)

We use **Conventional Commits**. Format:

```
<type>(optional scope): present-tense description in English
```

Example commit types:

- `feat`
- `fix`
- `refactor`
- `chore`
- `docs`
- `ci`
- `test`
- `build`
- `release`

## Commit descriptions (style)

- Keep the description short, in English, and focused on what the change covers.
- Use present tense (e.g., `add`, not `added`).
- The first line should be concise and stay within the GitHub preview width.
- Ranges/scopes are fine, e.g., `feat(blog): code snippets`.

## Commit naming (from the Solvro handbook)

- Suggested format: `type: short description` (or `type(scope): short description`).
- Handbook prefixes: `feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `test`.
- This repo also allows `build` and `release` (per `@solvro/config`).
- You may see other prefixes, but commitlint blocks them in this repo.
- Recommended spec: https://www.conventionalcommits.org/en/v1.0.0/
- Example short descriptions: `login view`, `shopping list`, `auth service`, `offline message widget`.

## Branch naming

Format:

```
<prefix>/<issue>-short-description
```

Available prefixes:

- `feat/`
- `fix/`
- `hotfix/`
- `design/`
- `refactor/`
- `test/`
- `docs/`

Examples:

```
feat/123-add-solvro-auth
fix/87-fix-date-display
design/45-new-color-schema
refactor/210-quiz-import-logic
docs/12-add-readme
```
