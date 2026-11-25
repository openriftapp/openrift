import { describe, expect, it } from "vitest";

import { uploadCredit } from "./image-credit";

describe("uploadCredit", () => {
  it("leaves an admin upload uncredited", () => {
    expect(uploadCredit({ isAdmin: true, uploaderName: "Renata Glasc" })).toBeUndefined();
  });

  it("credits a printing-desk upload to its uploader", () => {
    expect(uploadCredit({ isAdmin: false, uploaderName: " Renata Glasc " })).toBe("Renata Glasc");
  });

  it("sends no credit for an uploader without a name", () => {
    expect(uploadCredit({ isAdmin: false, uploaderName: "" })).toBeUndefined();
    expect(uploadCredit({ isAdmin: false, uploaderName: null })).toBeUndefined();
  });
});
