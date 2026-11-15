// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

import { formText, parseFormData } from "./form-data";

function formWith(fields: Record<string, string>) {
  const form = document.createElement("form");
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.name = name;
    input.value = value;
    form.append(input);
  }
  return form;
}

const schema = z
  .object({ name: z.string().trim().min(1, "Enter a name."), code: z.string() })
  .refine((values) => values.code === "ok", { message: "Wrong code.", path: ["code"] });

describe("formText", () => {
  it("reads a field's current value", () => {
    expect(formText(formWith({ email: "vi@example.com" }), "email")).toBe("vi@example.com");
  });

  it("reads a missing field as empty", () => {
    expect(formText(formWith({}), "email")).toBe("");
  });
});

describe("parseFormData", () => {
  it("returns the parsed values and drops fields the schema does not name", () => {
    expect(parseFormData(schema, formWith({ name: " Jinx ", code: "ok", extra: "x" }))).toEqual({
      ok: true,
      values: { name: "Jinx", code: "ok" },
    });
  });

  it("returns the first message per field", () => {
    expect(parseFormData(schema, formWith({ name: " ", code: "ok" }))).toEqual({
      ok: false,
      errors: { name: "Enter a name." },
    });
  });

  it("files an object-level refinement under its path", () => {
    expect(parseFormData(schema, formWith({ name: "Vi", code: "no" }))).toEqual({
      ok: false,
      errors: { code: "Wrong code." },
    });
  });

  it("files an issue without a path under root", () => {
    const pathless = z.object({ a: z.string() }).refine(() => false, "Nope.");
    expect(parseFormData(pathless, formWith({ a: "" }))).toEqual({
      ok: false,
      errors: { root: "Nope." },
    });
  });
});
