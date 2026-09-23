import { describe, expect, it } from "vitest";

import type { SubmissionAcceptedEmailInput } from "./submission-accepted-emails.js";
import { buildSubmissionAcceptedEmail } from "./submission-accepted-emails.js";

const CARD: SubmissionAcceptedEmailInput = {
  locale: "en",
  recipientName: "Garen",
  submission: { kind: "card", cardName: "Jinx, Loose Cannon" },
  viewUrl: "https://openrift.app/cards/jinx-loose-cannon",
  viewTarget: "card",
  submissionsUrl: "https://openrift.app/contribute/submissions",
  unsubscribeUrl: "https://openrift.app/unsubscribe?token=abc",
};

const META: SubmissionAcceptedEmailInput = {
  ...CARD,
  submission: { kind: "decklist", eventName: "Summoner Skirmish", playerName: "Riven" },
  viewUrl: "https://openrift.app/meta/summoner-skirmish/players/riven",
  viewTarget: "decklist",
  submissionsUrl: "https://openrift.app/meta/submissions",
};

describe("buildSubmissionAcceptedEmail", () => {
  it("names the card and links its page and the submissions page", () => {
    const { subject, html } = buildSubmissionAcceptedEmail(CARD);

    expect(subject).toBe("Your submission for Jinx, Loose Cannon was accepted");
    expect(html).toContain("Hi Garen,");
    expect(html).toContain("Thanks for your help");
    expect(html).toContain("View Jinx, Loose Cannon");
    expect(html).toContain('href="https://openrift.app/cards/jinx-loose-cannon"');
    expect(html).toContain('href="https://openrift.app/contribute/submissions"');
    expect(html).toContain('href="https://openrift.app/unsubscribe?token=abc"');
    expect(html).toContain("Thank-you emails for accepted submissions");
  });

  it("names the player and event for a decklist", () => {
    const { subject, html } = buildSubmissionAcceptedEmail(META);

    expect(subject).toBe("Your decklist for Summoner Skirmish was accepted");
    expect(html).toContain("<strong>Riven</strong> at <strong>Summoner Skirmish</strong>");
    expect(html).toContain("View the decklist");
  });

  it("labels the button for the event page", () => {
    const { html } = buildSubmissionAcceptedEmail({ ...META, viewTarget: "event" });

    expect(html).toContain("View the event");
  });

  it("says an event correction was applied", () => {
    const { subject, html } = buildSubmissionAcceptedEmail({
      ...META,
      submission: { kind: "event", eventName: "Summoner Skirmish" },
      viewUrl: "https://openrift.app/meta/summoner-skirmish",
      viewTarget: "event",
    });

    expect(subject).toBe("Your correction to Summoner Skirmish was applied");
    expect(html).toContain("Your correction to <strong>Summoner Skirmish</strong>");
    expect(html).toContain('href="https://openrift.app/meta/summoner-skirmish"');
  });

  it("drops the separate submissions note when the button already goes there", () => {
    const { html } = buildSubmissionAcceptedEmail({
      ...CARD,
      viewUrl: CARD.submissionsUrl,
      viewTarget: "submissions",
    });

    expect(html).toContain("View your submissions");
    expect(html).not.toContain("submissions page");
  });

  it("falls back to a bare greeting when the recipient has no name", () => {
    const { html } = buildSubmissionAcceptedEmail({ ...CARD, recipientName: null });

    expect(html).toContain("Hi,");
  });

  it("escapes names that contain markup", () => {
    const { html } = buildSubmissionAcceptedEmail({
      ...META,
      recipientName: "<b>Garen</b>",
      submission: { kind: "decklist", eventName: "Rift & Co", playerName: "<script>x</script>" },
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>Garen</b>");
    expect(html).toContain("Rift &amp; Co");
  });

  it("renders in the recipient's language", () => {
    const { subject, html } = buildSubmissionAcceptedEmail({ ...CARD, locale: "de" });

    expect(subject).toBe("Dein Beitrag zu Jinx, Loose Cannon wurde angenommen");
    expect(html).toContain('lang="de"');
    expect(html).toContain("Jinx, Loose Cannon ansehen");
  });
});
