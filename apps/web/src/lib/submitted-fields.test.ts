import { describe, expect, it } from "vitest";

import { withoutSubmittedFields } from "./submitted-fields";

function redirectOf(href: string): string | null {
  return new URL(href, "http://local").searchParams.get("redirect");
}

describe("withoutSubmittedFields", () => {
  it("returns a path without a query unchanged", () => {
    expect(withoutSubmittedFields("/profile")).toBe("/profile");
  });

  it("returns a query without secrets unchanged", () => {
    const href = "/cards?q=Jinx&email=vi%40example.com";
    expect(withoutSubmittedFields(href)).toBe(href);
  });

  it("drops every form field when a secret is present", () => {
    expect(
      withoutSubmittedFields("/login?email=vi%40example.com&password=hextech&tab=security"),
    ).toBe("/login?tab=security");
  });

  it("matches secret and form field names in any case", () => {
    expect(
      withoutSubmittedFields("/login?Email=vi%40example.com&Password=hextech&tab=security"),
    ).toBe("/login?tab=security");
    expect(withoutSubmittedFields("/profile?CURRENTPASSWORD=x&NewPassword=y")).toBe("/profile");
  });

  it("strips a secret from a nested redirect target", () => {
    const nested = encodeURIComponent("/profile?currentPassword=x&tab=security");
    const cleaned = withoutSubmittedFields(`/login?redirect=${nested}`);
    expect(redirectOf(cleaned)).toBe("/profile?tab=security");
  });

  it("strips a secret from a double-encoded nested redirect target", () => {
    const nested = encodeURIComponent(encodeURIComponent("/profile?Password=x&tab=security"));
    const cleaned = withoutSubmittedFields(`/login?redirect=${nested}`);
    expect(redirectOf(cleaned)).toBe("/profile?tab=security");
    expect(cleaned).not.toMatch(/assword/u);
  });

  it("leaves a double-encoded nested redirect without secrets as it was", () => {
    const href = `/login?redirect=${encodeURIComponent(encodeURIComponent("/decks?view=grid"))}`;
    expect(withoutSubmittedFields(href)).toBe(href);
  });

  it("keeps a nested redirect with a malformed escape as it was", () => {
    const href = "/login?redirect=%252Fcards%25zz";
    expect(withoutSubmittedFields(href)).toBe(href);
  });

  it.each(["/.//evil.com?password=x", "/%2e//evil.com?password=x"])(
    "never rebuilds %s into a protocol-relative path",
    (href) => {
      expect(withoutSubmittedFields(href)).toBe("/");
    },
  );

  it("strips a secret from every nested redirect target", () => {
    const first = encodeURIComponent("/profile?password=x");
    const second = encodeURIComponent("/decks?newPassword=y&view=grid");
    const cleaned = withoutSubmittedFields(`/login?redirect=${first}&redirect=${second}`);
    expect(new URL(cleaned, "http://local").searchParams.getAll("redirect")).toEqual([
      "/profile",
      "/decks?view=grid",
    ]);
  });

  it("matches bracketed field names", () => {
    expect(withoutSubmittedFields("/login?password[]=x&email[0]=a&tab=security")).toBe(
      "/login?tab=security",
    );
    expect(withoutSubmittedFields("/login?Password[0]=x")).toBe("/login");
  });
});
