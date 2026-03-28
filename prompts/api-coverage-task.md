# API Test Coverage Task

You are increasing test coverage in `apps/api` to 100% with meaningful, behavior-driven tests. Follow CLAUDE.md conventions.

## Worktree & branch setup

Use branch `test/api-coverage`. This is a long-running effort that may span multiple agent sessions.

**First run (branch doesn't exist yet):**
Enter a worktree — it will create a new branch. Immediately rename it:

```bash
git branch -m test/api-coverage
```

**Subsequent runs (branch already exists):**
The branch has prior work on it. Enter a worktree, then pull in the existing progress:

```bash
git fetch origin test/api-coverage 2>/dev/null; git merge test/api-coverage --no-edit 2>/dev/null || git merge FETCH_HEAD --no-edit 2>/dev/null || true
```

If the branch only exists locally in the main repo (not pushed), the fetch will fail — that's fine, the local merge will pick it up.

**Commit often:** After each file's tests pass, commit immediately with `test: add coverage for <filename>`. This ensures the next agent session can pick up where you left off. Do NOT batch multiple files into one commit.

## How to run

1. Run `bun run --cwd apps/api test:coverage 2>&1 | tail -200` to get the current coverage report.
2. Pick the **lowest-coverage source file** (excluding `src/db/migrations/` — those are already tested by the migrations integration test). Prioritize by: repositories > services > routes > other.
3. Follow the workflow below to write tests for that file.
4. Run coverage again to verify improvement.
5. Repeat from step 2.

## Workflow per file

### Step 1: Understand the code

Read the source file. Identify:

- Every exported function and what it does
- Every branch (`if`, `switch`, ternary, `??`, `||`, early returns)
- Every error path (throws, error responses, validation failures)
- External dependencies (database, other services, external APIs)

### Step 2: Decide unit vs integration

- **Unit test** (`*.test.ts`) when the function is pure logic, mapping, or validation — no database needed. Mock dependencies with `vi.spyOn()` or `vi.fn()`.
- **Integration test** (`*.integration.test.ts`) when the function hits the database or tests real HTTP request/response flows. These run against a shared temp database with seeded data.
- Many files need both. Write whichever covers more uncovered lines first.

### Step 3: Write tests

Follow the patterns below exactly. Every test must assert **expected behavior**, not just "it doesn't crash."

**What makes a good test:**

- Tests the contract: given this input, expect this output/side-effect
- Tests edge cases: empty arrays, null fields, not-found IDs, duplicate entries
- Tests authorization: userId isolation, admin-only guards, unauthenticated access
- Tests validation: invalid payloads return 400 with meaningful error shapes
- Tests error paths: not-found returns 404, conflicts return 409, etc.

**What makes a bad test (DO NOT write these):**

- `expect(result).toBeDefined()` with no further assertions on the value
- Tests that just call a function and check it doesn't throw
- Tests that duplicate what another test already covers
- Tests that mock so heavily that they test the mock, not the code

### Step 4: Register integration tests

If you created a new `*.integration.test.ts` file:

1. Add it to `PARALLEL_FILES` in `src/test/run-integration.ts`
2. Allocate a test user ID — check which IDs are already used by grepping existing integration tests for `a0000000-00XX` patterns. Pick the next unused ID. If you need an admin user, pick from the `isAdmin: true` range (0011-0021) or add a new one.
3. If you need a new test user, add it to the `TEST_USERS` array in `run-integration.ts`.

### Step 5: Verify

Run only the specific test file first to iterate fast:

- Unit: `cd apps/api && bunx vitest run src/path/to/file.test.ts`
- Integration: `cd apps/api && bun --env-file=../../.env -e "process.env.INTEGRATION_DB_URL = process.env.DATABASE_URL; await import('./src/path/to/file.integration.test.ts')"`
  - Or for a quick check: run the full suite with `bun run --cwd apps/api test:coverage`

### Step 6: Log unexpected behavior

If during testing you observe behavior that seems wrong, surprising, or inconsistent (e.g., an endpoint returns 200 when it should return 404, a repo silently swallows errors, data is returned that shouldn't be), **do not fix the code**. Instead, append to `prompts/api-coverage-findings.md`:

```markdown
## [filename] — [short description]

**Observed:** [what actually happens]
**Expected:** [what you'd expect based on the function's contract]
**Evidence:** [test name or code snippet that demonstrates it]
**Severity:** low | medium | high
```

This file is for human review. Only log genuinely surprising behavior, not style preferences.

## Test patterns

### Unit test for a repository

```typescript
import { describe, expect, it, vi } from "vitest";

// Mock the database at the module level or use vi.fn()
describe("repoName", () => {
  it("returns mapped result for valid input", () => {
    // ...
  });

  it("returns undefined when row not found", () => {
    // ...
  });
});
```

### Unit test for a route (mocked repos)

```typescript
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

const USER_ID = "test-user-id";
const mockRepo = {
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// Wire up minimal Hono app with mocked context
const app = new Hono()
  .use("*", async (c, next) => {
    c.set("user", { id: USER_ID });
    c.set("repos", { theRepo: mockRepo } as never);
    await next();
  })
  .route("/api/v1", theRoute);

describe("route name", () => {
  it("GET / returns list", async () => {
    mockRepo.list.mockResolvedValue([{ id: "1", name: "test" }]);
    const res = await app.request("/api/v1/endpoint");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual([{ id: "1", name: "test" }]);
  });

  it("POST / validates required fields", async () => {
    const res = await app.request("/api/v1/endpoint", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("GET /:id returns 404 when not found", async () => {
    mockRepo.getById.mockResolvedValue(undefined);
    const res = await app.request("/api/v1/endpoint/fake-id");
    expect(res.status).toBe(404);
  });
});
```

### Integration test for a repository

```typescript
import { afterAll, describe, expect, it } from "bun:test";
import { createDbContext } from "../../test/integration-context.js";
import { theRepo } from "../the-repo.js";

// Use a unique user ID — check run-integration.ts for available IDs
const ctx = createDbContext("a0000000-00XX-4000-a000-000000000001");

describe.skipIf(!ctx)("theRepo (integration)", () => {
  const { db, userId } = ctx!;
  const repo = theRepo(db);
  const createdIds: string[] = [];

  afterAll(async () => {
    // Clean up in reverse FK order
    if (createdIds.length > 0) {
      await db.deleteFrom("table").where("id", "in", createdIds).execute();
    }
  });

  it("creates and retrieves an entity", async () => {
    const entity = await repo.create({ userId, name: "Test" });
    createdIds.push(entity.id);

    expect(entity.name).toBe("Test");
    expect(entity.userId).toBe(userId);
  });

  it("enforces user isolation", async () => {
    const entity = await repo.create({ userId, name: "Isolated" });
    createdIds.push(entity.id);

    const result = await repo.getByIdForUser(entity.id, "a0000000-9999-4000-a000-000000000001");
    expect(result).toBeUndefined();
  });

  it("returns undefined for non-existent ID", async () => {
    const result = await repo.getByIdForUser("a0000000-0000-4000-a000-000000000000", userId);
    expect(result).toBeUndefined();
  });
});
```

### Integration test for a route

```typescript
import { afterAll, describe, expect, it } from "bun:test";
import { createTestContext } from "../../test/integration-context.js";
import { req } from "../../test/integration-helper.js";

// Use a unique user ID
const ctx = createTestContext("a0000000-00XX-4000-a000-000000000001");

describe.skipIf(!ctx)("Route name (integration)", () => {
  const { app } = ctx!;

  it("GET /endpoint returns expected shape", async () => {
    const res = await app.fetch(req("GET", "/endpoint"));
    expect(res.status).toBe(200);
    const json = await res.json();
    // Assert on actual shape and values, not just status
    expect(Array.isArray(json)).toBe(true);
  });

  it("POST /endpoint with valid body creates resource", async () => {
    const res = await app.fetch(req("POST", "/endpoint", { name: "Test" }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.name).toBe("Test");
    expect(json.id).toBeString();
  });

  it("POST /endpoint with invalid body returns 400", async () => {
    const res = await app.fetch(req("POST", "/endpoint", {}));
    expect(res.status).toBe(400);
  });
});
```

### Integration test for admin routes

```typescript
import { afterAll, describe, expect, it } from "bun:test";
import { createTestContext } from "../../test/integration-context.js";
import { req } from "../../test/integration-helper.js";

// Use an admin user ID (isAdmin: true in TEST_USERS)
const ctx = createTestContext("a0000000-0011-4000-a000-000000000001");

describe.skipIf(!ctx)("Admin route (integration)", () => {
  const { app } = ctx!;

  it("allows admin access", async () => {
    const res = await app.fetch(req("GET", "/admin/endpoint"));
    expect(res.status).toBe(200);
  });
});

// Also test that non-admins are rejected
const nonAdminCtx = createTestContext("a0000000-0022-4000-a000-000000000001");

describe.skipIf(!nonAdminCtx)("Admin route — non-admin (integration)", () => {
  const { app } = nonAdminCtx!;

  it("rejects non-admin users", async () => {
    const res = await app.fetch(req("GET", "/admin/endpoint"));
    expect(res.status).toBe(403);
  });
});
```

### Testing services with external dependencies

For services that call external APIs (e.g., price-refresh, image-rehost), use **unit tests with mocks**, not integration tests. Mock `fetch` or the specific client:

```typescript
import { describe, expect, it, vi } from "vitest";

// Mock fetch globally for this test file
const fetchSpy = vi.spyOn(globalThis, "fetch");

describe("externalService", () => {
  it("handles API success", async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ data: "ok" }), { status: 200 }));
    const result = await serviceFunction(args);
    expect(result).toEqual(expected);
    expect(fetchSpy).toHaveBeenCalledWith(expectedUrl, expect.objectContaining({ method: "GET" }));
  });

  it("handles API failure gracefully", async () => {
    fetchSpy.mockResolvedValueOnce(new Response("error", { status: 500 }));
    // Assert it throws, returns fallback, or logs — whatever the contract says
  });
});
```

## Files to skip

- `src/db/migrations/*.ts` — covered by the migrations integration test (99%+ already)
- `src/test/**` — test infrastructure, not application code
- `src/db/migrations/index.ts` — just re-exports, already 100%

## Prioritization

Focus on files where coverage improvement is largest per test written:

1. **Repositories** with 0-20% coverage — these are the data layer, easy to test with integration tests
2. **Services** with 0-30% coverage — business logic, mix of unit + integration
3. **Route handlers** with gaps — especially admin routes with 0% function coverage
4. **Mappers/utils** — quick wins, pure functions

## Important rules

- Do NOT modify source code to make it easier to test. Test the code as-is.
- Do NOT add `istanbul ignore` or coverage pragmas.
- Do NOT write snapshot tests.
- Each test file should be self-contained — no shared mutable state between test files.
- Integration tests MUST clean up after themselves in `afterAll()`.
- Use descriptive test names that explain the behavior being verified.
- Import from `.js` extensions in integration tests (they run under bun, not vitest).
- Use `bun:test` imports for integration tests, `vitest` imports for unit tests.
- When you encounter an endpoint that accepts query params or pagination, test the default case AND at least one filtered/paginated case.
