import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UseEmailNotificationsResult } from "@/features/account/hooks/use-email-notifications";

import { ContributionNotificationsSection } from "./contribution-notifications-section";

const setChannel = vi.fn();
let hookValue: UseEmailNotificationsResult;

vi.mock("@/features/account/hooks/use-email-notifications", () => ({
  useEmailNotifications: () => hookValue,
}));

const SWITCH_NAME = "Accepted submissions";

beforeEach(() => {
  setChannel.mockReset();
  hookValue = {
    gates: {
      tradeMatches: false,
      tradeRequests: true,
      tradeStatus: true,
      tradeRequestCadence: "5min",
      cardSubmissions: false,
      metaSubmissions: false,
      groupJoinRequests: true,
      groupApprovals: true,
      submissionAccepted: true,
    },
    isLoading: false,
    isSaving: false,
    setChannel,
    setCadence: vi.fn(),
  };
});

describe("ContributionNotificationsSection", () => {
  it("renders the switch on, since the channel is opt-out", () => {
    render(<ContributionNotificationsSection />);
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("turning it off calls setChannel with submissionAccepted", async () => {
    render(<ContributionNotificationsSection />);
    await userEvent.click(screen.getByRole("switch", { name: SWITCH_NAME }));
    expect(setChannel).toHaveBeenCalledWith("submissionAccepted", false);
  });

  it("turning it back on calls setChannel with true", async () => {
    hookValue = { ...hookValue, gates: { ...hookValue.gates, submissionAccepted: false } };
    render(<ContributionNotificationsSection />);
    await userEvent.click(screen.getByRole("switch", { name: SWITCH_NAME }));
    expect(setChannel).toHaveBeenCalledWith("submissionAccepted", true);
  });

  it("disables the switch while saving", () => {
    hookValue = { ...hookValue, isSaving: true };
    render(<ContributionNotificationsSection />);
    expect(screen.getByRole("switch", { name: SWITCH_NAME })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
