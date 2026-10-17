import { describe, expect, it } from "vitest";

import { isOfficialDomain, isOfficialHostname } from "./official-host";

describe("isOfficialHostname", () => {
  it("accepts the official host", () => {
    expect(isOfficialHostname("openrift.app")).toBe(true);
  });

  it("rejects the preview host", () => {
    expect(isOfficialHostname("preview.openrift.app")).toBe(false);
  });

  it("rejects a host that only ends in the official name", () => {
    expect(isOfficialHostname("fake-openrift.app")).toBe(false);
  });

  it("rejects another instance", () => {
    expect(isOfficialHostname("openrift.example.com")).toBe(false);
  });
});

describe("isOfficialDomain", () => {
  it("accepts the official host", () => {
    expect(isOfficialDomain("openrift.app")).toBe(true);
  });

  it("accepts a subdomain of the official host", () => {
    expect(isOfficialDomain("preview.openrift.app")).toBe(true);
  });

  it("rejects a host that only ends in the official name", () => {
    expect(isOfficialDomain("fake-openrift.app")).toBe(false);
  });

  it("rejects a host that only contains the official name", () => {
    expect(isOfficialDomain("openrift.app.example.com")).toBe(false);
  });

  it("rejects another instance", () => {
    expect(isOfficialDomain("openrift.example.com")).toBe(false);
  });
});
