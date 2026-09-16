import type { Logger } from "@openrift/shared/logger";
import { describe, expect, it, vi } from "vitest";

import type { Repos } from "../../../deps.js";
import type { SubmissionAcceptedEmailDeps } from "../../users/services/submission-accepted-notifications.js";
import { notifySubmitterOfMetaAcceptance } from "./meta-submission-thanks.js";

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

const META_SUBMISSION = {
  id: "meta-sub-1",
  userId: "user-1",
  status: "accepted",
  eventName: "Summoner Skirmish",
  playerName: "Riven",
  playerOverlayId: "overlay-1",
  metaEventId: null,
  metaEventPlayerId: null,
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

function makeMetaRepos(
  options: {
    submission?: Record<string, unknown> | null;
    overlayPlayerId?: string | null;
    player?: { playerName: string; sourceIdentity: string | null } | undefined;
    eventId?: string | undefined;
    event?: { slug: string; name: string } | undefined;
    context?: EmailContext | null;
  } = {},
) {
  const repos = {
    metaSubmissions: {
      byId: vi
        .fn()
        .mockResolvedValue(options.submission === undefined ? META_SUBMISSION : options.submission),
    },
    metaOverlays: {
      playerOverlayById: vi
        .fn()
        .mockResolvedValue({ metaEventPlayerId: options.overlayPlayerId ?? "player-1" }),
    },
    meta: {
      playerById: vi
        .fn()
        .mockResolvedValue(
          "player" in options
            ? options.player
            : { playerName: "Riven", sourceIdentity: "riven-main#2" },
        ),
      eventIdForPlayer: vi
        .fn()
        .mockResolvedValue("eventId" in options ? options.eventId : "event-1"),
      eventRowById: vi
        .fn()
        .mockResolvedValue(
          "event" in options
            ? options.event
            : { slug: "summoner-skirmish-2026", name: "Summoner Skirmish" },
        ),
    },
    userPreferences: contextRepo(options.context === undefined ? SUBMITTER : options.context),
  } as unknown as Repos;
  return { repos };
}

describe("notifySubmitterOfMetaAcceptance", () => {
  it("links the player's page at the event, with the #n suffix folded away", async () => {
    const { repos } = makeMetaRepos();
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [args] = sendEmail.mock.calls[0]!;
    expect(args.subject).toBe("Your decklist for Summoner Skirmish was accepted");
    expect(args.html).toContain("<strong>Riven</strong>");
    expect(args.html).toContain(
      'href="https://openrift.app/meta/summoner-skirmish-2026/players/riven-main"',
    );
    expect(args.html).toContain("View the decklist");
    expect(args.html).toContain('href="https://openrift.app/meta/submissions"');
  });

  it("links the event when the player has no page key", async () => {
    const { repos } = makeMetaRepos({ player: { playerName: "Riven", sourceIdentity: null } });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    const [args] = sendEmail.mock.calls[0]!;
    expect(args.html).toContain('href="https://openrift.app/meta/summoner-skirmish-2026"');
    expect(args.html).toContain("View the event");
    expect(args.html).not.toContain("/players/");
  });

  it("falls back to the submissions page when no event resolves", async () => {
    const { repos } = makeMetaRepos({ player: undefined, eventId: undefined, event: undefined });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    const [args] = sendEmail.mock.calls[0]!;
    expect(args.subject).toBe("Your decklist for Summoner Skirmish was accepted");
    expect(args.html).toContain("View your submissions");
    expect(args.html).toContain('href="https://openrift.app/meta/submissions"');
  });

  it("sends nothing for a submission that is not accepted", async () => {
    const { repos } = makeMetaRepos({ submission: { ...META_SUBMISSION, status: "rejected" } });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("links the event page for an applied event correction, under the event's current name", async () => {
    const { repos } = makeMetaRepos({
      submission: {
        ...META_SUBMISSION,
        playerName: null,
        playerOverlayId: null,
        metaEventId: "event-1",
        eventName: "Summoner Skirmsh",
      },
    });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    expect(repos.meta.playerById).not.toHaveBeenCalled();
    expect(repos.meta.eventRowById).toHaveBeenCalledWith("event-1");
    const [args] = sendEmail.mock.calls[0]!;
    expect(args.subject).toBe("Your correction to Summoner Skirmish was applied");
    expect(args.html).toContain('href="https://openrift.app/meta/summoner-skirmish-2026"');
    expect(args.html).toContain("View the event");
  });

  it("sends nothing when the submitter opted out", async () => {
    const { repos } = makeMetaRepos({
      context: { ...SUBMITTER, emailNotifications: { submissionAccepted: false } },
    });
    const { deps, sendEmail } = makeDeps();

    await notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps);

    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("never throws when a lookup fails", async () => {
    const { repos } = makeMetaRepos();
    vi.mocked(repos.meta.eventRowById).mockRejectedValue(new Error("db down"));
    const { deps, sendEmail, error } = makeDeps();

    await expect(
      notifySubmitterOfMetaAcceptance(repos, "meta-sub-1", deps),
    ).resolves.toBeUndefined();
    expect(sendEmail).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });
});
