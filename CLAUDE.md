# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. For full project documentation, see `docs/`.

## Project Overview

OpenRift is a card collection browser for the Riftbound trading card game. It's a Turborepo monorepo with a TanStack Start SSR frontend (`apps/web`), a Hono API server (`apps/api`), and a shared types/logic package (`packages/shared`), backed by PostgreSQL. The web app uses server functions to call the API over HTTP. See `docs/architecture.md` for infrastructure details.

## Commands

```bash
# Development
bun dev:web          # Start the web app dev server (TanStack Start / Vite)
bun dev:api          # Start the API server (Hono, needs DATABASE_URL)
bun dev              # Start all apps in dev mode

# Database
bun db:migrate       # Run migrations (reads DATABASE_URL from .env)
bun db:rollback      # Roll back the last migration
bun make-admin -- <email>  # Grant admin role to a user
docker exec openrift-db-1 psql -U openrift -c "SQL"  # Run a one-off query

# Build
bun run build        # Build all packages (Turbo, runs shared first)

# Lint & Format
bun lint             # Full lint (builds first, then oxlint + oxfmt)
bun lint:oxlint      # Run oxlint with --fix
bun lint:oxfmt       # Run oxfmt on apps/ and packages/

# Test
bun run test:integration  # Run integration tests only
bun run test:coverage     # Run all tests (unit + integration) with coverage, merge into coverage/lcov.info

# Single app/package
bun run --cwd apps/web dev
bun run --cwd packages/shared build
```

For dev setup, see `docs/development.md`. For deployment, see `docs/deployment.md`.

## Database Schema

**`docs/schema.sql`** contains the full current schema as a `pg_dump --schema-only` snapshot. **Read this file instead of replaying migration files** when you need to understand the database structure.

Regenerate after applying migrations:

```bash
docker exec openrift-db-1 pg_dump -U openrift --schema-only --no-owner --no-privileges > docs/schema.sql
```

## Migrations

The database is shared across all worktrees. **Ask the user before running `bun db:migrate`** — another agent may be mid-migration or relying on the current schema.

**When creating a new migration**, you must also register it in `apps/api/src/db/migrations/index.ts` (the migration barrel). Add an import and an entry in the `migrations` record. Without this, `bun db:migrate` will silently skip the migration.

After any migration is applied, regenerate the schema snapshot and include it in the same commit:

```bash
docker exec openrift-db-1 pg_dump -U openrift --schema-only --no-owner --no-privileges > docs/schema.sql
```

## Conventions

- **React Compiler** is enabled — do not add `useMemo`, `useCallback`, or `React.memo` in new code. In `infer` mode, `use`-prefixed functions that don't call hooks are silently skipped — add a `"use memo"` directive to force compilation.
- **`.map()` closures over changing parent state:** When a `.map()` callback reads parent state that changes during interaction (`useState`, etc.), the compiler can't keep the iteration result cached — its cache key includes the closure deps, so every row re-runs on each parent update even though props look stable. The fix is architectural, not `React.memo`: keep the changing state out of the parent's closure. The standard pattern is a Zustand store with per-row selector subscriptions — each row reads only its own slice, the parent's `.map()` callback closes only over stable refs (the list itself, pre-computed lookups, derived constants), the compiler caches the result, and React reconciler bails on unchanged rows. Example: `apps/web/src/stores/rules-fold-store.ts` + the `RuleRow` subscriptions in `apps/web/src/components/rules/rules-page.tsx`.
- **Commits:** Conventional Commits enforced by commitlint (`feat:`, `fix:`, `refactor:`, etc.). Always include a scope when the change is localized to one area: `web` (apps/web), `api` (apps/api), `shared` (packages/shared), `e2e` (apps/e2e), `ci` (Dockerfiles / GitHub Actions). E.g. `feat(web): ...`, `fix(api): ...`. Omit only when the change genuinely spans multiple areas or doesn't fit any of these.
- **TypeScript:** Strict mode, `noUnusedLocals`, `noUnusedParameters` enabled. Target is ES2024 — prefer modern APIs like `Map.groupBy()`, `Promise.withResolvers()`, `.toSorted()`, `.toReversed()`, `.at()` over hand-rolled equivalents.
- **Styling:** Tailwind utility classes with CSS variables for theming (light/dark). Use `cn()` from `@/lib/utils` for conditional class merging.
- **Typography:** Pick a size from the type scale in `docs/typography.md` — never invent one. Body text has no size class (inherits root); `text-sm` is for compact UI only; `text-xl` is not a tier; arbitrary `text-[Npx]` is not allowed (use `text-2xs`).
- **Linting:** oxlint (primary) + oxfmt. Always lint before committing (`bun lint`). To suppress a rule, use `oxlint-disable` comments (not `eslint-disable`) with a reason: `// oxlint-disable-next-line rule/name -- reason`. When writing JSDoc (`/** */`) comments on functions, always include a `@returns` tag — oxlint enforces `jsdoc/require-returns`.
- **shadcn/ui components:** Components in `apps/web/src/components/ui/` are scaffolded from shadcn's `base-nova` style. Add new ones via `bunx shadcn@latest add <name>`. When customizing a scaffolded component, add a `// custom: <reason>` comment on every changed/added line. This makes it easy to re-scaffold and diff to re-apply customizations. Never modify scaffolded code without a comment.
- **Icons:** Always import lucide-react icons with the `Icon` suffix (e.g. `CheckIcon`, `XIcon`, `PlusIcon`). Use `EllipsisVerticalIcon` for three-dot menus — never `MoreHorizontal` or bare `EllipsisVertical`.
- **Dependencies:** Always pin exact versions — no carets (`^`) or tildes (`~`). E.g. `"vitest": "4.0.18"`.
- **Tests:** Run with `bun run test` (turbo → vitest), **not** `bun test` (bun's built-in runner, skips vitest/jsdom config). Integration tests must use temporary databases (`setupTestDb()`), never the real dev/prod database — always drop the temp DB in `afterAll`.
- **Test requirements:** Every new or modified store, hook with logic, or lib utility **must** have a corresponding `*.test.ts` file. Test factories live in `apps/web/src/test/factories.ts`; store reset helpers in `apps/web/src/test/store-helpers.ts`. Zustand stores are singletons — always use `createStoreResetter()` in `beforeEach`/`afterEach` to isolate tests. Aim for at least: happy path, edge cases (empty input, boundaries), and error/rejection paths.
- **Bug fixes need regression tests:** Every `fix:` must include a test that fails without the fix and passes with it. If the affected code path genuinely can't be tested (e.g. third-party SSR quirk, browser-only behavior), call that out explicitly in the commit message — don't ship a fix silently uncovered.
- **HTML links:** Use `rel="noreferrer"` on external links (`target="_blank"`). Don't add `noopener` — `noreferrer` already implies it.
- **E2E selectors:** Prefer user-visible locators in Playwright tests (`getByRole`, `getByText`, `getByLabel`, `getByPlaceholder`) — they mirror how users find elements and catch accessibility regressions. Only use `getByTestId` / `data-testid` as a last resort for elements that genuinely have no role, label, or distinctive text (e.g. layout containers). Never add a `data-testid` to an element that could be located by role or text instead.
- **UI primitives:** BaseUI, not Radix — don't import from `@radix-ui/*`. BaseUI's `<Select.Value>` does not auto-resolve labels; always pass `items` to `<Select.Root>` when values differ from display labels.
- **Naming:** Use descriptive variable names. Never use single-letter or ultra-short names like `f`, `h`, `s`.
- **Function signatures:** Prefer `?` optional params over `| undefined` to avoid oxfmt conflicts.
- **Async code:** Use `async`/`await` instead of `.then(() => {})` for void promises. Always use braces after `if` — oxlint's `curly` rule requires it.
- **Database access:** All database queries must go through repository functions (`apps/api/src/repositories/`). Never use raw `db` / `Kysely` instances directly in routes or services — add a method to the appropriate repository instead. Route handlers access repos via `c.get("repos")`.
- **Timestamp precision:** PostgreSQL stores timestamps with microsecond precision, but JavaScript `Date` only has millisecond precision. When comparing a `Date` value against a `timestamptz` column (e.g. in cursor-based pagination), wrap the column with `date_trunc('milliseconds', ...)` so the comparison uses the same precision. Without this, equality checks silently fail.
- **Feature flags:** Managed via the admin UI, not migrations. When adding a new feature flag, register it in the `KNOWN_FLAGS` array in `apps/web/src/components/admin/feature-flags-page.tsx` so it appears in the admin dropdown. Do not seed flags via database migrations.
- **Dev servers:** Never suggest restarting dev servers as a debugging step — they always serve current code. Find the actual bug.
- `@/` alias in the web app maps to `apps/web/src/`

See `docs/contributing.md` for full conventions.

## Worktree Requirement

**You MUST enter a worktree before making ANY code changes.** Do not edit, write, or delete files in the main repo. The only exceptions are:

1. The user explicitly says "work in main" (or equivalent) in the current conversation.
2. The task is purely read-only (answering questions, reviewing code, running read-only commands).
3. You are already on a `claude/…` branch (e.g. spawned by the Claude Code web harness) — this is already an isolated worktree, so just work directly in it.

If you are about to use Edit, Write, or Bash to modify a file and you are NOT in a worktree or on a `claude/…` branch, **stop and enter a worktree first.** No exceptions. No "it's just a small change." No "there are no other agents running." Enter the worktree.

**How to enter a worktree:** use the Claude Code `EnterWorktree` tool. Do NOT create worktrees manually with `git worktree add ../openrift-<name>` or similar — the tool places the worktree inside `.claude/worktrees/`, switches the session's working directory into it, and integrates with `/done` and `/merge`. Manual `git worktree add` outside `.claude/worktrees/` is not supported and will break the workflow.

- **Worktree** — each worktree is a full, independent copy of the repo with no file conflicts.
- **Main repo** — only when the user explicitly says to work in main.

**Worktree setup:** after `EnterWorktree`, run `ln -s /home/eiko/repos/openrift/.env .env && ln -s /home/eiko/repos/openrift/media media && LEFTHOOK=0 bun install --frozen-lockfile` before doing anything else. **Skip `bun install`** for docs-only or other non-code changes (e.g. edits to `*.md`, `CHANGELOG.md`, comments-only tweaks) — the symlinks are still useful for commit hooks, but installing dependencies is pointless when no code runs.

**Worktree rules:** Database is shared (see Migrations). Use `docker exec` for DB access, not `docker compose`. Use a different port if you need a dev server (`PORT=5174 bun dev:web`). Never `git stash` or discard changes in the main repo. **Do not run integration tests from worktrees** — the database connection is not available there. Run unit tests and linting only; integration tests run from main after merging.

**When done:** run `/done` to commit remaining work, add changelog entries, and run checks (build, lint, unit tests — no integration tests). **For docs-only or other non-code changes**, skip the build/lint/test steps in `/done` — just commit and rebase. Do not push or create PRs. The user will run `/merge` from main to squash-merge your branch.

**Rebasing:** Always rebase **inside the worktree** onto local `main` before exiting (the `/done` flow handles this). Never rebase onto `origin/main` — local main is the source of truth. A PreToolUse hook enforces that worktrees are created from local main.

## Changelog

`apps/web/src/CHANGELOG.md` is shown to users in the "What's new" panel. After completing `feat:` or `fix:` work, you MUST add an entry there (unless it's a chore/refactor that users won't notice or already has an entry). This helps us communicate improvements to users and track changes over time.

**Format:**

```plaintext
## YYYY-MM-DD

- feat: Short description in plain language — what it does for the user
- fix: Short description of what was broken and is now fixed
```

**Tone:** Natural and direct. No jargon. Short enough to scan. E.g.:

- `feat: Cards are grouped by set, with the set name staying visible as you scroll`
- `fix: App updates now show up faster on iOS`

It must always read as a proper sentence, not a fragment. Avoid starting with "Added" or "Added the ability to" — just say what the feature does for the user. For fixes, briefly describe what was broken and how it's now fixed.

Group multiple entries under the same date. Within a date, list all `feat:` entries first, then all `fix:` entries. Add new entries at the top of their respective group. Don't add entries for: chore, refactor, perf, ci, docs, admin-only features, or internal fixes that users won't notice.

## TanStack Intent Skills

When working in the areas listed below, load the linked SKILL.md into context. Managed by `bunx @tanstack/intent@latest install` — re-run to refresh after dependency upgrades.

<!-- intent-skills:start -->

# Skill mappings - when working in these areas, load the linked skill file into context.

skills:

- task: "Routes in apps/web/src/routes/ — loaders, validateSearch, beforeLoad guards, \_authenticated layouts, lazy splits, path/search params"
  # Skills under @tanstack/router-core (core entry + 9 sub-skills: data-loading, search-params, navigation, auth-and-guards, code-splitting, ssr, type-safety, not-found-and-errors, path-params).
  # To locate: bunx @tanstack/intent@latest list | grep router-core
- task: "Server functions and useServerFn in apps/web/src/hooks/ and route loaders"
  # To locate: bunx @tanstack/intent@latest list | grep server-functions
- task: "TanStack Start middleware and execution model (createMiddleware, server-only / client-only / isomorphic boundaries)"
  # To locate: bunx @tanstack/intent@latest list | grep -E "start-core/middleware|start-core/execution-model"
- task: "apps/web/vite.config.ts — TanStack Start, router plugin, devtools plugin order, code splitting"
  load: "apps/web/node_modules/@tanstack/router-plugin/skills/router-plugin/SKILL.md"
- task: "apps/web/vite.config.ts — TanStack Devtools Vite plugin (must be first plugin, source inspection, console piping)"
  load: "node_modules/@tanstack/devtools-vite/skills/devtools-vite-plugin/SKILL.md"
- task: "SSR shell, root route head/scripts management, Nitro deployment preset" # To locate: bunx @tanstack/intent@latest list | grep -E "router-core/ssr|start-core/deployment"
<!-- intent-skills:end -->
