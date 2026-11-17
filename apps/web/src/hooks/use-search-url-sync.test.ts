import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSearchUrlSync } from "./use-search-url-sync";

interface HookArgs {
  urlValue: string;
  onCommit: (value: string) => void;
}

describe("useSearchUrlSync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes local state from the URL value", () => {
    const { result } = renderHook(() =>
      useSearchUrlSync({ urlValue: "initial", onCommit: vi.fn() }),
    );
    expect(result.current[0]).toBe("initial");
  });

  it("commits the local value to the URL after the debounce delay", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useSearchUrlSync({ urlValue: "", onCommit }));

    act(() => result.current[1]("hello"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onCommit).toHaveBeenCalledWith("hello");
  });

  it("syncs local state when the URL changes externally (e.g. clear all)", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "foo", onCommit } },
    );

    rerender({ urlValue: "", onCommit });
    expect(result.current[0]).toBe("");
  });

  it("does not clobber in-progress typing while a fresh onCommit closure lands each render", () => {
    const commits: string[] = [];
    const makeOnCommit = () => (value: string) => {
      commits.push(value);
    };

    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue, onCommit }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit: makeOnCommit() } },
    );

    act(() => result.current[1]("T"));
    act(() => result.current[1]("Th"));
    act(() => result.current[1]("Thi"));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(commits.at(-1)).toBe("Thi");

    act(() => result.current[1]("This is not"));
    rerender({ urlValue: "", onCommit: makeOnCommit() });

    expect(result.current[0]).toBe("This is not");

    rerender({ urlValue: "Thi", onCommit: makeOnCommit() });
    expect(result.current[0]).toBe("This is not");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(commits.at(-1)).toBe("This is not");
  });

  it("keeps typing when an older commit's echo lands after a newer commit", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit } },
    );

    act(() => result.current[1]("a"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("ab"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual(["a", "ab"]);

    act(() => result.current[1]("abc"));
    rerender({ urlValue: "a", onCommit });
    expect(result.current[0]).toBe("abc");

    rerender({ urlValue: "ab", onCommit });
    expect(result.current[0]).toBe("abc");

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCommit).toHaveBeenLastCalledWith("abc");
  });

  it("adopts an external change that arrives after its own echoes landed", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit } },
    );

    act(() => result.current[1]("a"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("ab"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ urlValue: "a", onCommit });
    rerender({ urlValue: "ab", onCommit });

    rerender({ urlValue: "a", onCommit });
    expect(result.current[0]).toBe("a");
  });

  it("treats a URL change that doesn't match our last commit as external", () => {
    let pendingUrlValue = "";
    const onCommit = vi.fn((value: string) => {
      pendingUrlValue = value;
    });

    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit } },
    );

    act(() => result.current[1]("foo"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ urlValue: pendingUrlValue, onCommit });
    expect(result.current[0]).toBe("foo");

    rerender({ urlValue: "", onCommit });
    expect(result.current[0]).toBe("");
  });

  it("commits a query retyped right after an external change cleared it", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "Annie", onCommit } },
    );

    rerender({ urlValue: "", onCommit });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    act(() => result.current[1]("Annie"));
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(onCommit).toHaveBeenCalledWith("Annie");
  });

  it("ignores a late echo of a commit superseded by clearing back to the URL value", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit } },
    );

    act(() => result.current[1]("a"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1](""));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual(["a", ""]);

    rerender({ urlValue: "a", onCommit });
    expect(result.current[0]).toBe("");

    rerender({ urlValue: "", onCommit });
    expect(result.current[0]).toBe("");
  });

  it("follows a history traversal to a value whose commit was superseded before its echo", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "abc", onCommit } },
    );

    act(() => result.current[1]("abcd"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("abc"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual(["abcd", "abc"]);

    act(() => {
      globalThis.dispatchEvent(new PopStateEvent("popstate"));
    });
    rerender({ urlValue: "abcd", onCommit });
    expect(result.current[0]).toBe("abcd");
  });

  it("still ignores the echo of a commit made after returning to the URL value", () => {
    const onCommit = vi.fn();
    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "abc", onCommit } },
    );

    act(() => result.current[1]("abcd"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("abc"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("abcde"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    act(() => result.current[1]("abcdef"));

    rerender({ urlValue: "abcde", onCommit });
    expect(result.current[0]).toBe("abcdef");
  });

  it("does not re-commit the same value twice", () => {
    let pendingUrlValue = "";
    const onCommit = vi.fn((value: string) => {
      pendingUrlValue = value;
    });

    const { result, rerender } = renderHook<readonly [string, (value: string) => void], HookArgs>(
      ({ urlValue }) => useSearchUrlSync({ urlValue, onCommit }),
      { initialProps: { urlValue: "", onCommit } },
    );

    act(() => result.current[1]("foo"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onCommit).toHaveBeenCalledTimes(1);

    rerender({ urlValue: pendingUrlValue, onCommit });
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
