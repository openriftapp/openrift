import { describe, expect, it } from "vitest";

import { errorText, thrownMessage } from "./error-text";

describe("errorText", () => {
  it("returns the message of a thrown Error", () => {
    expect(errorText(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the message of an Error subclass", () => {
    expect(errorText(new TypeError("not found"), "fallback")).toBe("not found");
  });

  it("returns the fallback for an empty or blank message", () => {
    const emptied = new Error("boom");
    emptied.message = "";
    expect(errorText(emptied, "fallback")).toBe("fallback");
    expect(errorText(new Error("  \n"), "fallback")).toBe("fallback");
  });

  it("trims the message", () => {
    expect(errorText(new Error("  boom \n"), "fallback")).toBe("boom");
  });

  it("returns the fallback for a thrown string", () => {
    expect(errorText("a string", "fallback")).toBe("fallback");
  });

  it("returns the fallback for a plain object that carries a message", () => {
    expect(errorText({ message: "ignored" }, "fallback")).toBe("fallback");
  });

  it("says the server cannot be reached for a browser fetch failure", () => {
    expect(errorText(new TypeError("Failed to fetch"), "fallback")).toBe(
      "Can't reach the server. Check your connection.",
    );
    expect(errorText({ message: "Load failed" }, "fallback")).toBe(
      "Can't reach the server. Check your connection.",
    );
  });

  it("returns the fallback for null and undefined", () => {
    expect(errorText(null, "fallback")).toBe("fallback");
    expect(errorText(undefined, "fallback")).toBe("fallback");
  });
});

describe("thrownMessage", () => {
  it("reads the message of an Error", () => {
    expect(thrownMessage(new Error("boom"))).toBe("boom");
  });

  it("reads the message of a plain object that lost its Error prototype", () => {
    expect(thrownMessage({ message: "Server function info not found" })).toBe(
      "Server function info not found",
    );
  });

  it("returns a thrown string as is", () => {
    expect(thrownMessage("boom")).toBe("boom");
  });

  it("returns an empty string for anything else", () => {
    expect(thrownMessage({ message: 42 })).toBe("");
    expect(thrownMessage(null)).toBe("");
    expect(thrownMessage(undefined)).toBe("");
    expect(thrownMessage(7)).toBe("");
  });
});
