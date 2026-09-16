import type { EmailMessages } from "./shared.js";
import { joinParts, num } from "./shared.js";

export const de: EmailMessages = {
  htmlLang: "de",
  greeting: (nameHtml) => (nameHtml ? `Hallo ${nameHtml},` : "Hallo,"),
  footerTrading: "Du erhältst diese E-Mail wegen deiner Tauschaktivität auf OpenRift.",
  footerGroupOwner: "Du erhältst diese E-Mail, weil du eine Gruppe auf OpenRift leitest.",
  footerGroupJoin:
    "Du erhältst diese E-Mail, weil du einer Gruppe auf OpenRift beitreten wolltest.",
  unsubscribeWord: "abmelden",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "Gruppen-Beitrittsanfragen",
      groupApprovals: "Willkommens-E-Mails für Gruppen",
      submissionAccepted: "Dankes-E-Mails für angenommene Einreichungen",
      tradeRequests: "E-Mails zu Tauschanfragen",
      tradeStatus: "E-Mails zum Tauschstatus",
      tradeMatches: "Täglicher Treffer-Überblick",
    })[channel],

  joinRequestSubject: (groupName) => `Beitrittsanfrage für ${groupName}`,
  joinRequestHeading: "Neue Beitrittsanfrage",
  someone: "Jemand",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} hat angefragt, ${groupHtml} beizutreten. Bis ein Admin zustimmt, bleibt die Person außerhalb der Gruppe.`,
  reviewRequestButton: "Anfrage ansehen",

  approvedSubject: (groupName) => `Du bist dabei: ${groupName}`,
  approvedHeading: "Du bist dabei",
  approvedLead: (groupHtml) =>
    `Ein Admin hat deine Anfrage bestätigt, du bist jetzt Mitglied von ${groupHtml}.`,
  approvedBenefitsIntro: "Das bekommst du damit:",
  approvedBenefits: [
    "Sieh dir alle Sammlungen, Wunschlisten und Tauschlisten an, die die anderen Mitglieder teilen.",
    "Tausch-Treffer: Karten von deiner Wunschliste, die jemand in der Gruppe übrig hat.",
    "Verfolge die Tausche und Aktivitäten der Gruppe, während sie passieren.",
  ],
  managePageLinkLabel: "Verwaltungsseite",
  approvedVisibilityNote: (linkHtml) =>
    `Von dir ist noch nichts sichtbar. Wähle auf der ${linkHtml}, welche Listen und Sammlungen die Gruppe sehen darf.`,
  openGroupButton: (groupName) => `${groupName} öffnen`,

  aGroupMember: "Ein Gruppenmitglied",
  aMember: "Ein Mitglied",
  aCard: "eine Karte",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("de", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "Neue Tauschanfrage",
  tradeRequestsHeading: "Neue Tauschanfragen",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} möchte ${cardHtml} von dir tauschen.`
      : `${senderHtml} bietet dir ${cardHtml} an.`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants"
      ? `${sender} möchte ${cardName} tauschen`
      : `${sender} bietet dir ${cardName} an`,
  requestExpiryNote:
    "Öffne den Tausch, um ihn anzunehmen oder abzulehnen. Hinweis: Tauschanfragen laufen 7 Tage nach dem Versand ab.",
  reachContact: (name, contact) => `${name} erreichen: ${contact}`,
  viewTradeButton: "Tausch ansehen",
  viewTradesButton: "Tausche ansehen",
  viewTradesInButton: (groupName) => `Tausche in ${groupName} ansehen`,
  inGroupLine: (groupName) => `In ${groupName}`,
  wantsFromYouHeading: "Möchte von dir",
  offersYouHeading: "Bietet dir an",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`möchte ${num("de", wantsCount)} deiner Karten`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `bietet dir ${num("de", offersCount)} an`
          : `bietet dir ${num("de", offersCount)} Karten an`,
      );
    }
    return `${sender} ${joinParts(parts, "und", false)}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} hat dir ${num("de", total)} Tauschanfragen geschickt. Hinweis: Tauschanfragen laufen 7 Tage nach dem Versand ab.`,

  statusHeading: "Tausch-Updates",
  statusOutcomeHeading: (event) =>
    ({ reserved: "Angenommen", declined: "Abgelehnt", cancelled: "Abgebrochen" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} hat deine Anfrage für ${cardHtml} angenommen`;
      }
      case "declined": {
        return `${actorHtml} hat deine Anfrage für ${cardHtml} abgelehnt`;
      }
      case "cancelled": {
        return `${actorHtml} hat den Tausch für ${cardHtml} abgebrochen`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} hat deine Tauschanfrage angenommen`;
      }
      case "declined": {
        return `${actor} hat deine Tauschanfrage abgelehnt`;
      }
      case "cancelled": {
        return `${actor} hat einen Tausch abgebrochen`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "angenommen", count: counts.reserved },
      { verb: "abgelehnt", count: counts.declined },
      { verb: "abgebrochen", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${num("de", count)} ${verb}`);
    return `${actor} hat von deinen Tauschen ${joinParts(parts, "und", false)}`;
  },
  statusLead: (actorHtml) => `${actorHtml} hat einige deiner Tausche aktualisiert:`,

  digestHeading: "Neue Tausch-Treffer",
  digestSubject: (total) =>
    total === 1
      ? "1 neuer Treffer in deinen Tauschgruppen"
      : `${num("de", total)} neue Treffer in deinen Tauschgruppen`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} hat jetzt ${cardHtml} von deiner Wunschliste.`,
  digestLead: "Mitglieder deiner Gruppen haben jetzt Karten von deiner Wunschliste:",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} hat`,

  otpSubject: (type) =>
    ({
      "sign-in": "Dein Anmeldecode",
      "email-verification": "Bestätige deine E-Mail-Adresse",
      "forget-password": "Setze dein Passwort zurück",
      "change-email": "Bestätige die Änderung deiner E-Mail-Adresse",
    })[type] ?? "Dein Bestätigungscode",
  otpHeading: "Dein Bestätigungscode",
  otpExpiryNote:
    "Dieser Code läuft in 5 Minuten ab. Wenn du ihn nicht angefordert hast, kannst du diese E-Mail ignorieren.",

  footerContribution: "Du erhältst diese E-Mail, weil du bei OpenRift etwas eingereicht hast.",
  acceptedHeading: "Danke für deine Hilfe",
  acceptedCardSubject: (cardName) => `Deine Einreichung zu ${cardName} wurde angenommen`,
  acceptedCardLead: (cardHtml) =>
    `Deine Einreichung zu ${cardHtml} wurde geprüft und angenommen. Sie ist jetzt Teil der Kartendaten auf OpenRift.`,
  acceptedDecklistSubject: (eventName) => `Deine Deckliste für ${eventName} wurde angenommen`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `Die Deckliste, die du für ${playerHtml} bei ${eventHtml} geschickt hast, wurde geprüft und angenommen. Sie ist jetzt im Meta-Archiv.`,
  acceptedEventSubject: (eventName) => `Deine Korrektur zu ${eventName} wurde übernommen`,
  acceptedEventLead: (eventHtml) =>
    `Deine Korrektur zu ${eventHtml} wurde geprüft und übernommen. Die Turnierseite zeigt sie jetzt an.`,
  acceptedThanks:
    "Die Daten von OpenRift pflegt eine einzelne Person, darum schließen Einreichungen wie deine die Lücken. Danke!",
  viewCardButton: (cardName) => `${cardName} ansehen`,
  viewDecklistButton: "Deckliste ansehen",
  viewEventButton: "Turnier ansehen",
  viewSubmissionsButton: "Deine Einreichungen ansehen",
  submissionsLinkLabel: "Seite mit deinen Einreichungen",
  submissionsNote: (linkHtml) =>
    `Alles, was du eingereicht hast, und den jeweiligen Stand findest du auf der ${linkHtml}.`,
};
