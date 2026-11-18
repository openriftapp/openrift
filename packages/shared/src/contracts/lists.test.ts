import { describe, expect, it } from "vitest";

import { MAX_LIST_ENTRY_QUANTITY } from "../schemas.js";
import {
  bulkCreateListEntriesSchema,
  decrementListEntriesSchema,
  updateListEntryInputSchema,
} from "./lists.js";

const LIST_ID = "a0000000-0001-4000-a000-000000000001";
const ENTRY_ID = "a0000000-0001-4000-a000-000000000002";
const CARD_ID = "c0000000-0001-4000-a000-000000000001";

function update(fields: Record<string, unknown>) {
  return updateListEntryInputSchema.safeParse({ id: LIST_ID, itemId: ENTRY_ID, ...fields });
}

describe("updateListEntryInputSchema", () => {
  it("accepts a step in either direction", () => {
    expect(update({ quantityDelta: 1 }).success).toBe(true);
    expect(update({ quantityDelta: -1 }).success).toBe(true);
  });

  it("refuses a step that changes nothing", () => {
    expect(update({ quantityDelta: 0 }).success).toBe(false);
  });

  it("refuses a step past the quantity bound in either direction", () => {
    expect(update({ quantityDelta: MAX_LIST_ENTRY_QUANTITY + 1 }).success).toBe(false);
    expect(update({ quantityDelta: -MAX_LIST_ENTRY_QUANTITY - 1 }).success).toBe(false);
  });

  it("refuses a quantity and a step together", () => {
    expect(update({ quantity: 2, quantityDelta: 1 }).success).toBe(false);
  });

  it("refuses an absolute quantity above the bound", () => {
    expect(update({ quantity: MAX_LIST_ENTRY_QUANTITY }).success).toBe(true);
    expect(update({ quantity: MAX_LIST_ENTRY_QUANTITY + 1 }).success).toBe(false);
  });
});

describe("decrementListEntriesSchema", () => {
  it("refuses a decrement that would overflow the quantity column", () => {
    const parsed = decrementListEntriesSchema.safeParse({
      entries: [{ entryId: ENTRY_ID, by: 3e9 }],
    });
    expect(parsed.success).toBe(false);
  });

  it("accepts a decrement within the bound", () => {
    const parsed = decrementListEntriesSchema.safeParse({
      entries: [{ entryId: ENTRY_ID, by: MAX_LIST_ENTRY_QUANTITY }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe("bulkCreateListEntriesSchema", () => {
  it("refuses an added quantity above the bound", () => {
    const parsed = bulkCreateListEntriesSchema.safeParse({
      entries: [{ cardId: CARD_ID, quantity: MAX_LIST_ENTRY_QUANTITY + 1 }],
    });
    expect(parsed.success).toBe(false);
  });
});
