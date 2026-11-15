import { describe, expect, it } from "vitest";

import { SENTRY_DATA_COLLECTION } from "./sentry-data-collection";

describe("SENTRY_DATA_COLLECTION", () => {
  it("keeps account form fields out of reported query strings", () => {
    expect(SENTRY_DATA_COLLECTION.urlQueryParams.deny).toEqual(
      expect.arrayContaining([
        "password",
        "currentPassword",
        "newPassword",
        "confirmPassword",
        "email",
        "redirect",
      ]),
    );
  });
});
