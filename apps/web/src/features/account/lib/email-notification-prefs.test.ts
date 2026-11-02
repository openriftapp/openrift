import { describe, expect, it } from "vitest";

import { resolveEmailNotificationGates } from "./email-notification-prefs";

describe("resolveEmailNotificationGates", () => {
  it("applies per-setting defaults when the key is absent", () => {
    expect(resolveEmailNotificationGates(undefined)).toEqual({
      tradeMatches: false, // digest is opt-in
      tradeRequests: true, // request email is opt-out
      tradeStatus: true, // status email is opt-out
      tradeRequestCadence: "5min", // default cadence
      cardSubmissions: false, // admin alert is opt-in
      metaSubmissions: false, // admin alert is opt-in
      groupJoinRequests: true, // group join alert is opt-out
      groupApprovals: true, // group welcome is opt-out
      submissionAccepted: true, // thank-you email is opt-out
    });
    expect(resolveEmailNotificationGates({})).toEqual({
      tradeMatches: false,
      tradeRequests: true,
      tradeStatus: true,
      tradeRequestCadence: "5min",
      cardSubmissions: false,
      metaSubmissions: false,
      groupJoinRequests: true,
      groupApprovals: true,
      submissionAccepted: true,
    });
  });

  it("the admin card-submission alert is on only when explicitly true", () => {
    expect(resolveEmailNotificationGates({ cardSubmissions: true }).cardSubmissions).toBe(true);
    expect(resolveEmailNotificationGates({ cardSubmissions: false }).cardSubmissions).toBe(false);
  });

  it("the admin meta-submission alert is on only when explicitly true", () => {
    expect(resolveEmailNotificationGates({ metaSubmissions: true }).metaSubmissions).toBe(true);
    expect(resolveEmailNotificationGates({ metaSubmissions: false }).metaSubmissions).toBe(false);
  });

  it("the group join-request alert is off only when explicitly false", () => {
    expect(resolveEmailNotificationGates({ groupJoinRequests: false }).groupJoinRequests).toBe(
      false,
    );
    expect(resolveEmailNotificationGates({ groupJoinRequests: true }).groupJoinRequests).toBe(true);
  });

  it("the group welcome email is off only when explicitly false", () => {
    expect(resolveEmailNotificationGates({ groupApprovals: false }).groupApprovals).toBe(false);
    expect(resolveEmailNotificationGates({ groupApprovals: true }).groupApprovals).toBe(true);
  });

  it("the accepted-submission email is off only when explicitly false", () => {
    expect(resolveEmailNotificationGates({ submissionAccepted: false }).submissionAccepted).toBe(
      false,
    );
    expect(resolveEmailNotificationGates({ submissionAccepted: true }).submissionAccepted).toBe(
      true,
    );
  });

  it("digest is on only when explicitly true", () => {
    expect(resolveEmailNotificationGates({ tradeMatches: true }).tradeMatches).toBe(true);
    expect(resolveEmailNotificationGates({ tradeMatches: false }).tradeMatches).toBe(false);
  });

  it("request email is on unless explicitly false", () => {
    expect(resolveEmailNotificationGates({ tradeRequests: false }).tradeRequests).toBe(false);
    expect(resolveEmailNotificationGates({ tradeRequests: true }).tradeRequests).toBe(true);
  });

  it("status email is on unless explicitly false", () => {
    expect(resolveEmailNotificationGates({ tradeStatus: false }).tradeStatus).toBe(false);
    expect(resolveEmailNotificationGates({ tradeStatus: true }).tradeStatus).toBe(true);
  });

  it("reflects the stored cadence when set", () => {
    expect(
      resolveEmailNotificationGates({ tradeRequestCadence: "instant" }).tradeRequestCadence,
    ).toBe("instant");
    expect(
      resolveEmailNotificationGates({ tradeRequestCadence: "30min" }).tradeRequestCadence,
    ).toBe("30min");
  });
});
