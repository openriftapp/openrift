import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { JsonParseResult } from "@/features/admin/lib/json-upload";

import { useJsonFileInput } from "./use-json-file-input";

function parseNumbers(text: string): JsonParseResult<number[]> {
  const value = JSON.parse(text) as unknown;
  return Array.isArray(value) ? { ok: true, value: value as number[] } : { ok: false, error: "No" };
}

function jsonFile(text: string, name = "data.json"): File {
  return new File([text], name, { type: "application/json" });
}

describe("useJsonFileInput", () => {
  it("holds the parsed value and the file name", async () => {
    const { result } = renderHook(() => useJsonFileInput(parseNumbers));
    await act(() => result.current.load(jsonFile("[1,2]")));
    expect(result.current.value).toStrictEqual([1, 2]);
    expect(result.current.fileName).toBe("data.json");
    expect(result.current.error).toBeNull();
  });

  it("reports the parser's error and drops the previous value", async () => {
    const { result } = renderHook(() => useJsonFileInput(parseNumbers));
    await act(() => result.current.load(jsonFile("[1]")));
    await act(() => result.current.load(jsonFile("{}", "bad.json")));
    expect(result.current.value).toBeNull();
    expect(result.current.error).toBe("No");
    expect(result.current.fileName).toBe("bad.json");
  });

  it("reports a file that cannot be read", async () => {
    const { result } = renderHook(() => useJsonFileInput(parseNumbers));
    const broken = jsonFile("[1]");
    broken.text = () => Promise.reject(new Error("io"));
    await act(() => result.current.load(broken));
    expect(result.current.error).toBe("Could not read that file");
    expect(result.current.value).toBeNull();
  });

  it("clears everything on reset", async () => {
    const { result } = renderHook(() => useJsonFileInput(parseNumbers));
    await act(() => result.current.load(jsonFile("[3]")));
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ fileName: null, value: null, error: null });
  });
});
