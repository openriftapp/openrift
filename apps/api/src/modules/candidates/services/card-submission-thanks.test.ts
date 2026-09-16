import type { Logger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { SubmissionAcceptedEmailDeps } from "../../users/services/submission-accepted-notifications.js";
import { notifySubmitterOfCardAcceptance } from "./card-submission-thanks.js";

interface EmailContext {
  email: string;
  emailVerified: boolean;
  name: string | null;
  emailNotifications: Record<string, unknown>;
}

const SUBMITTER: EmailContext = {
  email: "submitter@example.com",
  emailVerified: true,
  name: "Garen",
  emailNotifications: {},
};

const CARD_SUBMISSION = {
  id: "sub-1",
  userId: "user-1",
  status: "accepted",
  cardName: "Jinx, Loose Cannon",
  acceptedCardId: "card-1",
};

function makeDeps(sendEmail = vi.fn().mockResolvedValue(undefined)) {
  const error = vi.fn();
  const deps: SubmissionAcceptedEmailDeps = {
    sendEmail,
    appBaseUrl: "https://openrift.app",
    unsubscribeSecret: "test-secret-key",
    log: { error } as unknown as Logger,
  };
  return { deps, sendEmail, error };
}

function contextRepo(context: EmailContext | null) {
  return {
    getEmailNotificationContext: vi
      .fn()
      .mockResolvedValue(context === null ? undefined : { displayLocale: "en", ...context }),
  };
}

function makeCardRepos(
  submission: Record<string, unknown> | null = CARD_SUBMISSION,
  card: { id: string; name: string; slug: string } | undefined = {
    id: "card-1",
    name: "Jinx, Loose Cannon",
    slug: "jinx-loose-cannon",
  },
  context: EmailContext | null = SUBMITTER,
) {
  const findById = vi.fn().mockResolvedValue(submission);
  const repos = {
    cardSubmissions: { findById },
    catalogMutations: { getCardById: vi.fn().mockResolvedValue(card) },
    userPreferences: contextRepo(context),
  } as unknown as Repos;
  return { repos, findById };
}

describe("notifySubmitterOfCardAcceptance", () => {
  it("thanks the submitter and links the card page", async () => {
    const { repos } = makeCardRepos();
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [args] = sendEmail.mock.calls[0]!;
    expect(args.to).toBe("submitter@example.com");
    expect(args.subject).toBe("Your submission for Jinx, Loose Cannon was accepted");
    expect(args.html).toContain("Hi Garen,");
    expect(args.html).toContain('href="https://openrift.app/cards/jinx-loose-cannon"');
    expect(args.html).toContain('href="https://openrift.app/contribute/submissions"');
    expect(args.listUnsubscribeUrl).toContain("/unsubscribe/one-click");
  });

  it("links the submissions page when the accept names no live card", async () => {
    const { repos } = makeCardRepos({ ...CARD_SUBMISSION, acceptedCardId: null });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    const [args] = sendEmail.mock.calls[0]!;
    expect(args.html).toContain("View your submissions");
    expect(args.html).toContain('href="https://openrift.app/contribute/submissions"');
    expect(args.html).not.toContain("/cards/");
  });

  it.each(["pending", "already_correct", "not_applied", "rejected"])(
    "sends nothing for a %s submission",
    async (status) => {
      const { repos } = makeCardRepos({ ...CARD_SUBMISSION, status });
      const { deps, sendEmail } = makeDeps();

      await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

      expect(sendEmail).not.toHaveBeenCalled();
    },
  );

  it("sends nothing when the submission is gone", async () => {
    const { repos } = makeCardRepos(null);
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends by default, because the channel is opt-out", async () => {
    const { repos } = makeCardRepos(undefined, undefined, {
      ...SUBMITTER,
      emailNotifications: { groupApprovals: false },
    });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("sends nothing when the submitter opted out", async () => {
    const { repos } = makeCardRepos(undefined, undefined, {
      ...SUBMITTER,
      emailNotifications: { submissionAccepted: false },
    });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing to an unverified address", async () => {
    const { repos } = makeCardRepos(undefined, undefined, { ...SUBMITTER, emailVerified: false });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing when the account is gone", async () => {
    const { repos } = makeCardRepos(undefined, undefined, null);
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfCardAcceptance(repos, "sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("reads nothing when no email deps are wired", async () => {
    const { repos, findById } = makeCardRepos();

    await notifySubmitterOfCardAcceptance(repos, "sub-1");

    expect(findById).not.toHaveBeenCalled();
  });

  it("never throws when the send fails, so the accept still stands", async () => {
    const { repos } = makeCardRepos();
    const { deps, error } = makeDeps(vi.fn().mockRejectedValue(new Error("smtp down")));

    await expect(notifySubmitterOfCardAcceptance(repos, "sub-1", deps)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
