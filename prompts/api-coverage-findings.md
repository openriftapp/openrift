# API Coverage Findings

## [user-preferences.ts] — jsonb column returned as string under bun, breaks merge logic

**Observed:** `userPreferencesRepo.upsert()` reads `existing?.data` to merge with incoming preferences. Under bun (used for integration tests), postgres.js returns jsonb columns as strings instead of parsed objects. This causes the spread `{ ...current, ...incoming }` to spread the string's character indices rather than the object's keys. The first upsert (no existing row) works fine because `current` falls back to `PREFERENCES_DEFAULTS`. Subsequent upserts silently produce corrupted merged data.

**Expected:** postgres.js should auto-parse jsonb to JS objects. Under Node.js this likely works correctly, but under bun the jsonb parsing is different.

**Evidence:** Integration test — `typeof result` is `"string"` after calling `upsert()`. Second upsert produces `{ '0': '{', '1': '"', ... }` instead of proper preferences.

**Severity:** medium — Affects any user who updates preferences more than once if running under bun. In production (likely Node.js), this probably works correctly. The fix would be to add a `JSON.parse` guard in `upsert` when reading `existing?.data`.
