import { describe, expect, it } from "vitest";

import {
  apiKeyGrantFor,
  apiKeyHoldsScope,
  apiKeyPermissionsFromGrants,
  isApiKeyScope,
  parseApiKeyPermissions,
} from "./api-key-scopes.js";

describe("apiKeyPermissionsFromGrants", () => {
  it("expands write to read and write and drops none", () => {
    expect(
      apiKeyPermissionsFromGrants({ collection: "write", lists: "read", decks: "none" }, false),
    ).toEqual({ collection: ["read", "write"], lists: ["read"] });
  });

  it("adds the admin scope only when asked", () => {
    expect(apiKeyPermissionsFromGrants({}, true)).toEqual({ admin: ["access"] });
  });
});

describe("parseApiKeyPermissions", () => {
  it("round-trips stored permissions", () => {
    const stored = JSON.stringify({ decks: ["read", "write"], admin: ["access"] });
    expect(parseApiKeyPermissions(stored)).toEqual({ decks: ["read", "write"], admin: ["access"] });
  });

  it("grants nothing for null, malformed JSON or non-objects", () => {
    expect(parseApiKeyPermissions(null)).toEqual({});
    expect(parseApiKeyPermissions("{nope")).toEqual({});
    expect(parseApiKeyPermissions("42")).toEqual({});
  });

  it("ignores unknown areas and actions", () => {
    const stored = JSON.stringify({ trades: ["write"], decks: ["read", "delete"], admin: ["yes"] });
    expect(parseApiKeyPermissions(stored)).toEqual({ decks: ["read"] });
  });
});

describe("apiKeyHoldsScope", () => {
  it("checks the area and the action", () => {
    const permissions = { collection: ["read"] as ("read" | "write")[] };
    expect(apiKeyHoldsScope(permissions, "collection:read")).toBe(true);
    expect(apiKeyHoldsScope(permissions, "collection:write")).toBe(false);
    expect(apiKeyHoldsScope(permissions, "decks:read")).toBe(false);
  });
});

describe("isApiKeyScope", () => {
  it("accepts area:access pairs only", () => {
    expect(isApiKeyScope("lists:write")).toBe(true);
    expect(isApiKeyScope("admin:access")).toBe(false);
    expect(isApiKeyScope("lists:write:extra")).toBe(false);
    expect(isApiKeyScope(undefined)).toBe(false);
  });
});

describe("apiKeyGrantFor", () => {
  it("reports the strongest grant per area", () => {
    const permissions = {
      collection: ["read", "write"] as ("read" | "write")[],
      lists: ["read"] as ("read" | "write")[],
    };
    expect(apiKeyGrantFor(permissions, "collection")).toBe("write");
    expect(apiKeyGrantFor(permissions, "lists")).toBe("read");
    expect(apiKeyGrantFor(permissions, "decks")).toBe("none");
  });
});
