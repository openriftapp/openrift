import { JOB_KIND } from "@openrift/shared/job-run-kinds";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminKeys } from "@/features/admin/lib/admin-query-keys";

const startJobFn = vi.fn();
let latestStatus: string | undefined;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/admin/lib/job-start", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  startJobFn: (input: unknown) => startJobFn(input),
}));
vi.mock("@/features/admin/hooks/use-latest-job-run", () => ({
  useLatestJobRun: () => ({ data: latestStatus === undefined ? null : { status: latestStatus } }),
}));

const { useStartJob } = await import("./use-start-job");

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { onError: () => {} } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () =>
      useStartJob(JOB_KIND.flushPrintingEvents, "Flush", {
        invalidates: [adminKeys.printingEvents],
      }),
    { wrapper },
  );
  return { result, invalidate };
}

describe("useStartJob", () => {
  beforeEach(() => {
    startJobFn.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.info).mockClear();
    latestStatus = undefined;
  });

  it("starts the job by kind, toasts it and refreshes the run lists", async () => {
    startJobFn.mockResolvedValue({ runId: "r-1", status: "running" });
    const { result, invalidate } = setup();

    await act(() => result.current.start());

    expect(startJobFn).toHaveBeenCalledWith({
      data: { kind: JOB_KIND.flushPrintingEvents, viaSchedule: false },
    });
    expect(toast.success).toHaveBeenCalledWith("Flush started");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...adminKeys.jobRuns] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...adminKeys.jobSchedules] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [...adminKeys.printingEvents] });
  });

  it("says so when the job is already running", async () => {
    startJobFn.mockResolvedValue({ runId: "r-1", status: "already_running" });
    const { result } = setup();

    await act(() => result.current.start());

    expect(toast.info).toHaveBeenCalledWith("Flush is already running");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("raises no success toast when the start fails", async () => {
    startJobFn.mockRejectedValue(new Error("Job unavailable"));
    const { result } = setup();

    await act(() => result.current.start());

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("reports running while the latest run is still going", () => {
    latestStatus = "running";
    const { result } = setup();

    expect(result.current.running).toBe(true);
  });
});
