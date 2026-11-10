import { describe, expect, it, vi } from "vitest";

// Capture the options passed to postgres() so we can test the date type overrides
type FnRef = (...args: unknown[]) => unknown;
let capturedOptions:
  | {
      max?: number;
      prepare?: boolean;
      connection?: Record<string, number | undefined>;
      types?: { date?: { serialize: FnRef; parse: FnRef } };
    }
  | undefined;
vi.mock("postgres", () => ({
  default: (_url: string, opts?: typeof capturedOptions) => {
    capturedOptions = opts;
    return {}; // minimal stub — createDb only passes this to PostgresJSDialect
  },
}));

// Must import after the mock so vitest hoists the mock correctly
const { BACKGROUND_POOL, createDb } = await import("./connect.js");

describe("createDb", () => {
  it("creates a Kysely instance and dialect", () => {
    const { db, dialect } = createDb("postgres://localhost/test");
    expect(db).toBeDefined();
    expect(dialect).toBeDefined();
  });
});

describe("connection pool", () => {
  it("sets an explicit max pool size", () => {
    createDb("postgres://localhost/test");
    expect(capturedOptions?.max).toBe(20);
  });

  it("disables server-side prepared statements", () => {
    createDb("postgres://localhost/test");
    expect(capturedOptions?.prepare).toBe(false);
  });

  it("limits request statements to 30 s and idle transactions to 60 s by default", () => {
    createDb("postgres://localhost/test");
    expect(capturedOptions?.connection).toEqual({
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    });
  });

  it("leaves the background pool's statement timeout to the server default", () => {
    createDb("postgres://localhost/test", BACKGROUND_POOL);
    expect(capturedOptions?.max).toBe(10);
    expect(capturedOptions?.connection?.statement_timeout).toBeUndefined();
    expect(capturedOptions?.connection?.idle_in_transaction_session_timeout).toBe(600_000);
  });
});

describe("date type overrides", () => {
  it("serialize converts a Date to ISO string and non-Date to String", () => {
    createDb("postgres://localhost/test");
    const serialize = capturedOptions?.types?.date?.serialize;
    expect(serialize).toBeDefined();

    const d = new Date("2024-01-15T00:00:00.000Z");
    expect(serialize!(d)).toBe("2024-01-15T00:00:00.000Z");
    expect(serialize!("2024-01-15")).toBe("2024-01-15");
  });

  it("parse returns the date string as-is", () => {
    createDb("postgres://localhost/test");
    const parse = capturedOptions?.types?.date?.parse;
    expect(parse).toBeDefined();
    expect(parse!("2024-01-15")).toBe("2024-01-15");
  });
});
