import { describe, expect, it } from "vitest";

import { isOfficialHostname } from "./official-host";

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
