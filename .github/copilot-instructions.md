# Copilot Instructions — Testownik Solvro Frontend

## Project Overview

A quiz/study platform for Wrocław University of Technology students, built by KN Solvro. Next.js 16 App Router + React
19 + TanStack Query v5 + Tailwind CSS v4 + shadcn/ui (Radix). Backend is a separate Django REST API (
`Solvro/backend-testownik`). UI strings are in **Polish**; code identifiers are in **English**.

## Architecture

### Page Pattern (SSR ↔ Client split)

Every route follows a two-file convention in `apps/web/src/app/<route>/`:

- **`page.tsx`** — Server Component. Reads cookies via `next/headers`, creates a `QueryClient`, prefetches data through
  service classes, wraps content in `<HydrationBoundary>`. Exports `metadata` (Polish titles).
- **`client.tsx`** — Client Component (`"use client"`). Named export `XxxPageClient`. Consumes hydrated queries and
  accesses `AppContext` for auth/services.

Reference: `apps/web/src/app/quizzes/page.tsx` → `apps/web/src/app/quizzes/client.tsx`.

Some simpler pages (e.g. `grades`, `create-quiz`) skip SSR prefetching and render the client component directly.

### Service Layer (`apps/web/src/services/`)

Class-based API services extending `BaseApiService`. Accessed via singleton `ServiceRegistry` exposed through React
Context (`AppContext`). Three services: `QuizService`, `UserService`, `ImageService`.

Access pattern in client components:

```ts
const { services, isGuest } = useContext(AppContext);
const quizzes = await services.quiz.getQuizzes();
```

### Auth

JWT (HS256) stored in cookies (`access_token`, `refresh_token`). Guest mode uses `is_guest` cookie. Client-side decoding
via `jose.decodeJwt()` (no verification). Server-side verification via `jose.jwtVerify()` with `JWT_SECRET` env var.
Auth context is provided by `AppContextProvider` in `apps/web/src/app-context-provider.tsx`.

### State Management & Data Fetching

**TanStack Query v5** exclusively (no Redux/Zustand). Single `QueryClientProvider` at app root (
`apps/web/src/app/providers.tsx`).

**SSR-first pattern:** Prefer server-side data prefetch + hydration over client-only fetches. A typical page:

1. Server (`page.tsx`) calls `queryClient.prefetchQuery()` with the service
2. Dehydrates state: `<HydrationBoundary state={dehydrate(queryClient)}>`
3. Client reads hydrated cache immediately (no duplicate fetch)

Example: `apps/web/src/app/quizzes/page.tsx` prefetches `["user-quizzes", isGuest]` — client hook in `useQuizzes()` uses the same
key.

**Query keys** include `isGuest` flag for cache segmentation. Default `staleTime` is 60s (`apps/web/src/lib/query-client.ts`).
Keep keys consistent between SSR prefetch and client hooks.

### Middleware & Auth Guards

`apps/web/src/proxy.ts` (Next.js middleware) enforces auth on protected routes (`/profile`, `/quizzes`, `/grades`,
`/create-quiz`, `/edit-quiz`, `/import-quiz`). Handles:

- Token validation and refresh (expires with 30s buffer)
- Automatic token refresh using `POST /token/refresh/`
- Fallback to login redirect if no valid token
- Cookie forwarding from backend responses

### Env Variables

Validated with `@t3-oss/env-nextjs` + Zod in `apps/web/src/env.ts`. Required: `NEXT_PUBLIC_API_URL`. Optional:
`NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL` (TURN relay for P2P), `JWT_SECRET` (server),
`INTERNAL_API_KEY` (server).

## Key Conventions

- **Path alias:** `@/` maps to `apps/web/src/` (tsconfig paths)
- **UI components:** shadcn/ui in `apps/web/src/components/ui/`, project components alongside in `apps/web/src/components/`
- **Hooks:** `apps/web/src/hooks/use-{feature}.ts` (kebab-case). Feature-specific hooks may be colocated (e.g.
  `apps/web/src/components/quiz/hooks/`)
- **Validation:** Zod v4 quiz schemas in `packages/core/src/quiz/schema.ts`; web-only schemas in `apps/web/src/lib/schemas/`

### Commit Format

Use **Conventional Commits** via `@solvro/config` commitlint enforcement.

**Format:** `<type>(optional scope): present-tense description in English`

**Types:** `feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `test`, `build`, `release`

**Examples:**

- `feat(quiz): add cross-device quiz continuity`
- `fix(auth): correct token refresh timeout`
- `refactor(editor): simplify question form`
- `test(hooks): add useQuizzes integration tests`

### Branch Naming

**Format:** `<prefix>/<issue>-short-description`

**Prefixes:** `feat/`, `fix/`, `hotfix/`, `design/`, `refactor/`, `test/`, `docs/`

**Examples:**

- `feat/123-add-solvro-auth`
- `fix/87-fix-date-display`
- `refactor/210-quiz-import-logic`

### Code Style

- **Formatting:** Prettier via `@solvro/config/prettier` — auto-run on commit via husky + lint-staged
- **Linting:** ESLint flat config via `@solvro/config/eslint` (see `eslint.config.js`)

## Commands

| Task       | Command                                    |
| ---------- | ------------------------------------------ |
| Dev server | `pnpm run dev`                             |
| Build      | `pnpm run build`                           |
| Lint       | `pnpm run lint` / `npm run lint:fix`       |
| Format     | `pnpm run format` / `npm run format:check` |
| Type check | `pnpm run typecheck`                       |
| Tests      | `pnpm run test` (Vitest)                   |

## Cross-Device Quiz Continuity (PeerJS)

Users can sync quiz progress across devices (desktop, tablet, mobile) via WebRTC peer-to-peer.

**Hook:** `apps/web/src/components/quiz/hooks/use-quiz-continuity.ts` — manages `Peer` connections, device discovery, and message
types (`initial_sync`, `question_update`, `answer_checked`, ping/pong for connection health).

**UI:** `apps/web/src/components/quiz/continuity-dialog.tsx` — displays connected peers by device type (icon per device), shows "
host" badge for primary device.

**RTC config** uses STUN/TURN servers from env vars `NEXT_PUBLIC_TURN_USERNAME` and `NEXT_PUBLIC_TURN_CREDENTIAL` for
NAT traversal. Fallback to public Google STUN if TURN unavailable.

## Testing

- **Framework:** Vitest 4 + jsdom + React Testing Library + MSW 2
- **Test files:** `.spec.ts`/`.spec.tsx` — unit tests colocated with source in `apps/web/src/lib/`, page tests in
  `apps/web/src/__tests__/pages/`
- **MSW handlers:** `apps/web/src/test-utils/mocks/handlers.ts` — mocks backend API endpoints
- **Test providers:** Wrap components in `<Providers>` from `apps/web/src/test-utils/providers.tsx` (accepts `guest` flag,
  `accessToken`)
- **Token generation:** Use `generateTestToken()` from `apps/web/src/test-utils/token-factory.ts` for auth in tests
- **Setup:** `apps/web/src/test-utils/setup.ts` polyfills JSDOM gaps and configures MSW lifecycle (`beforeAll`/`afterEach`/
  `afterAll`)
- **Pattern:** Page tests use a `setup()` helper that renders in providers and returns action helpers

## File Structure Quick Reference

```
apps/
  web/                # Next.js app
    src/
      app/              # Next.js App Router pages (page.tsx + client.tsx)
      services/         # API service classes (BaseApiService → Quiz/User/Image)
      components/
        ui/             # shadcn/ui primitives (do not edit manually — use shadcn CLI)
        quiz/           # Quiz feature components, hooks, helpers
        navbar/         # Navigation components
      hooks/            # Global custom hooks
      lib/
        auth/           # JWT utilities, constants, types
        schemas/        # Zod validation schemas
        cookies.ts      # Cookie helpers (js-cookie wrapper)
        api.ts          # API_URL export
      types/            # Web-only TypeScript interfaces
      test-utils/       # Test providers, MSW mocks, token factory
packages/
  core/               # Platform-neutral types, schemas and quiz/grade logic (@testownik/core)
    src/<domain>/     # quiz, grades, user, wrapped, ai — import as @testownik/core/<domain>/<module>
```
