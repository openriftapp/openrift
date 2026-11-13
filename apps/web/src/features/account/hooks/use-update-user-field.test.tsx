import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/account/lib/auth-client", () => ({
  authClient: { updateUser: vi.fn() },
}));

const { authClient } = await import("@/features/account/lib/auth-client");
const { useUpdateUserField } = await import("./use-update-user-field");
const updateUser = vi.mocked(authClient.updateUser);

function setup(onServerError?: (error: { code?: string; message?: string }) => void) {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const setError = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => useUpdateUserField({ setError }, { saveFailed: "Could not save", onServerError }),
    { wrapper },
  );
  return { result, setError, invalidate };
}

describe("useUpdateUserField", () => {
  beforeEach(() => {
    updateUser.mockReset();
  });

  it("refreshes the session and reports success when the update lands", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null } as never);
    const { result, setError, invalidate } = setup();

    await act(() => result.current.save({ name: "Teemo" }));

    expect(updateUser).toHaveBeenCalledWith({ name: "Teemo" });
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(result.current.success).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });

  it("puts the save-failed message on the form root when the request throws", async () => {
    updateUser.mockRejectedValue(new Error("offline"));
    const { result, setError, invalidate } = setup();

    await act(() => result.current.save({ name: "Teemo" }));

    expect(setError).toHaveBeenCalledWith("root", { message: "Could not save" });
    expect(invalidate).not.toHaveBeenCalled();
    expect(result.current.success).toBe(false);
  });

  it("maps a server error through setServerError by default", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { code: "INVALID_NAME", message: "bad" },
    } as never);
    const { result, setError } = setup();

    await act(() => result.current.save({ name: "<>" }));

    expect(setError).toHaveBeenCalledWith(
      "name",
      expect.objectContaining({ message: expect.any(String) }),
    );
    expect(result.current.success).toBe(false);
  });

  it("hands a server error to the caller's mapper when one is given", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { code: "INVALID_BIO", message: "too long" },
    } as never);
    const onServerError = vi.fn();
    const { result, setError } = setup(onServerError);

    await act(() => result.current.save({ bio: "x" }));

    expect(onServerError).toHaveBeenCalledWith({ code: "INVALID_BIO", message: "too long" });
    expect(setError).not.toHaveBeenCalled();
  });
});
