import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

export type TradeRequestKind = "wants" | "offers";

export type TradeStatusEvent = "reserved" | "declined" | "cancelled";

export type EmailUnsubscribeChannel =
  | "groupJoinRequests"
  | "groupApprovals"
  | "tradeRequests"
  | "tradeStatus"
  | "tradeMatches";

export interface StatusCounts {
  reserved: number;
  declined: number;
  cancelled: number;
}

export interface EmailMessages {
  htmlLang: string;
  greeting: (nameHtml: string | null) => string;
  footerTrading: string;
  footerGroupOwner: string;
  footerGroupJoin: string;
  unsubscribeWord: string;
  unsubscribeLabel: (channel: EmailUnsubscribeChannel) => string;

  joinRequestSubject: (groupName: string) => string;
  joinRequestHeading: string;
  someone: string;
  joinRequestLead: (requesterHtml: string, groupHtml: string) => string;
  reviewRequestButton: string;

  approvedSubject: (groupName: string) => string;
  approvedHeading: string;
  approvedLead: (groupHtml: string) => string;
  approvedBenefitsIntro: string;
  approvedBenefits: readonly [string, string, string];
  managePageLinkLabel: string;
  approvedVisibilityNote: (linkHtml: string) => string;
  openGroupButton: (groupName: string) => string;

  aGroupMember: string;
  aMember: string;
  aCard: string;
  quantityLabel: (quantity: number, cardName: string) => string;
  tradeRequestHeading: string;
  tradeRequestsHeading: string;
  requestLead: (senderHtml: string, cardHtml: string, kind: TradeRequestKind) => string;
  requestSubject: (sender: string, cardName: string, kind: TradeRequestKind) => string;
  requestExpiryNote: string;
  reachContact: (name: string, contact: string) => string;
  viewTradeButton: string;
  viewTradesButton: string;
  viewTradesInButton: (groupName: string) => string;
  inGroupLine: (groupName: string) => string;
  wantsFromYouHeading: string;
  offersYouHeading: string;
  coalescedRequestSubject: (sender: string, wantsCount: number, offersCount: number) => string;
  coalescedRequestLead: (senderHtml: string, total: number) => string;

  statusHeading: string;
  statusOutcomeHeading: (event: TradeStatusEvent) => string;
  statusPhrase: (actorHtml: string, cardHtml: string, event: TradeStatusEvent) => string;
  singleStatusSubject: (actor: string, event: TradeStatusEvent) => string;
  statusCountSubject: (actor: string, counts: StatusCounts) => string;
  statusLead: (actorHtml: string) => string;

  digestHeading: string;
  digestSubject: (total: number) => string;
  digestSingleLead: (counterpartyHtml: string, cardHtml: string) => string;
  digestLead: string;
  counterpartyHasHeading: (labelHtml: string) => string;

  otpSubject: (type: string) => string;
  otpHeading: string;
  otpExpiryNote: string;
}

const numberFormats = new Map<DisplayLocale, Intl.NumberFormat>();

function num(locale: DisplayLocale, value: number): string {
  let format = numberFormats.get(locale);
  if (format === undefined) {
    format = new Intl.NumberFormat(locale);
    numberFormats.set(locale, format);
  }
  return format.format(value);
}

function joinParts(parts: readonly string[], and: string, oxford: boolean): string {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }
  if (parts.length === 2) {
    return `${parts[0]} ${and} ${parts[1]}`;
  }
  const head = parts.slice(0, -1).join(", ");
  return oxford ? `${head}, ${and} ${parts.at(-1)}` : `${head} ${and} ${parts.at(-1)}`;
}

const en: EmailMessages = {
  htmlLang: "en",
  greeting: (nameHtml) => (nameHtml ? `Hi ${nameHtml},` : "Hi,"),
  footerTrading: "You're receiving this because of your trading activity on OpenRift.",
  footerGroupOwner: "You're receiving this because you run a group on OpenRift.",
  footerGroupJoin: "You're receiving this because you asked to join a group on OpenRift.",
  unsubscribeWord: "unsubscribe",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "Group join requests",
      groupApprovals: "Group welcome emails",
      tradeRequests: "Trade-request emails",
      tradeStatus: "Trade-status emails",
      tradeMatches: "Daily match digest",
    })[channel],

  joinRequestSubject: (groupName) => `Join request for ${groupName}`,
  joinRequestHeading: "New join request",
  someone: "Someone",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} asked to join ${groupHtml}. They stay outside the group until an admin approves them.`,
  reviewRequestButton: "Review the request",

  approvedSubject: (groupName) => `You're in: ${groupName}`,
  approvedHeading: "You're in",
  approvedLead: (groupHtml) =>
    `An admin approved your request, so you're now a member of ${groupHtml}.`,
  approvedBenefitsIntro: "What that gets you:",
  approvedBenefits: [
    "Browse every collection, wishlist and tradelist the other members share.",
    "Trade matches: cards on your wishlist that someone in the group has spare.",
    "Follow the group's trades and activity as they happen.",
  ],
  managePageLinkLabel: "manage page",
  approvedVisibilityNote: (linkHtml) =>
    `Nothing of yours is visible yet. Pick which lists and collections the group can see on the ${linkHtml}.`,
  openGroupButton: (groupName) => `Open ${groupName}`,

  aGroupMember: "A group member",
  aMember: "A member",
  aCard: "a card",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("en", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "New trade request",
  tradeRequestsHeading: "New trade requests",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} wants to trade for your ${cardHtml}.`
      : `${senderHtml} is offering you ${cardHtml}.`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants"
      ? `${sender} wants to trade for ${cardName}`
      : `${sender} offers you ${cardName}`,
  requestExpiryNote:
    "Open the trade to accept or decline it. Heads up: trade requests expire 7 days after they're sent.",
  reachContact: (name, contact) => `Reach ${name}: ${contact}`,
  viewTradeButton: "View the trade",
  viewTradesButton: "View the trades",
  viewTradesInButton: (groupName) => `View the trades in ${groupName}`,
  inGroupLine: (groupName) => `In ${groupName}`,
  wantsFromYouHeading: "Wants from you",
  offersYouHeading: "Offers you",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`wants ${num("en", wantsCount)} of your cards`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `offers you ${num("en", offersCount)}`
          : `offers you ${num("en", offersCount)} cards`,
      );
    }
    return `${sender} ${joinParts(parts, "and", true)}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} sent you ${num("en", total)} trade requests. Heads up: trade requests expire 7 days after they're sent.`,

  statusHeading: "Trade updates",
  statusOutcomeHeading: (event) =>
    ({ reserved: "Accepted", declined: "Declined", cancelled: "Cancelled" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} accepted your request for ${cardHtml}`;
      }
      case "declined": {
        return `${actorHtml} declined your request for ${cardHtml}`;
      }
      case "cancelled": {
        return `${actorHtml} cancelled the trade for ${cardHtml}`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} accepted your trade request`;
      }
      case "declined": {
        return `${actor} declined your trade request`;
      }
      case "cancelled": {
        return `${actor} cancelled a trade`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "accepted", count: counts.reserved },
      { verb: "declined", count: counts.declined },
      { verb: "cancelled", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${verb} ${num("en", count)}`);
    return `${actor} ${joinParts(parts, "and", true)} of your trades`;
  },
  statusLead: (actorHtml) => `${actorHtml} updated some of your trades:`,

  digestHeading: "New trade matches",
  digestSubject: (total) =>
    total === 1
      ? "1 new match in your trading groups"
      : `${num("en", total)} new matches in your trading groups`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} now has ${cardHtml} from your wishlist.`,
  digestLead: "Members of your groups now have cards on your wishlist:",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} has`,

  otpSubject: (type) =>
    ({
      "sign-in": "Your sign-in code",
      "email-verification": "Verify your email",
      "forget-password": "Reset your password",
      "change-email": "Confirm your email change",
    })[type] ?? "Your verification code",
  otpHeading: "Your verification code",
  otpExpiryNote:
    "This code expires in 5 minutes. If you didn't request this, you can safely ignore this email.",
};

const de: EmailMessages = {
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
};

const fr: EmailMessages = {
  htmlLang: "fr",
  greeting: (nameHtml) => (nameHtml ? `Bonjour ${nameHtml},` : "Bonjour,"),
  footerTrading: "Vous recevez cet e-mail en raison de votre activité d'échange sur OpenRift.",
  footerGroupOwner: "Vous recevez cet e-mail parce que vous gérez un groupe sur OpenRift.",
  footerGroupJoin:
    "Vous recevez cet e-mail parce que vous avez demandé à rejoindre un groupe sur OpenRift.",
  unsubscribeWord: "se désabonner",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "Demandes d'adhésion au groupe",
      groupApprovals: "E-mails de bienvenue de groupe",
      tradeRequests: "E-mails de demande d'échange",
      tradeStatus: "E-mails de statut d'échange",
      tradeMatches: "Résumé quotidien des correspondances",
    })[channel],

  joinRequestSubject: (groupName) => `Demande d'adhésion à ${groupName}`,
  joinRequestHeading: "Nouvelle demande d'adhésion",
  someone: "Quelqu'un",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} a demandé à rejoindre ${groupHtml}. La personne reste en dehors du groupe jusqu'à l'approbation d'un administrateur.`,
  reviewRequestButton: "Examiner la demande",

  approvedSubject: (groupName) => `Vous êtes membre : ${groupName}`,
  approvedHeading: "Vous êtes membre",
  approvedLead: (groupHtml) =>
    `Un administrateur a approuvé votre demande : vous êtes maintenant membre de ${groupHtml}.`,
  approvedBenefitsIntro: "Ce que cela vous apporte :",
  approvedBenefits: [
    "Parcourez toutes les collections, listes de souhaits et listes d'échange que les autres membres partagent.",
    "Correspondances d'échange : des cartes de votre liste de souhaits qu'un membre du groupe a en double.",
    "Suivez les échanges et l'activité du groupe en direct.",
  ],
  managePageLinkLabel: "page de gestion",
  approvedVisibilityNote: (linkHtml) =>
    `Rien de votre côté n'est encore visible. Choisissez sur la ${linkHtml} les listes et collections que le groupe peut voir.`,
  openGroupButton: (groupName) => `Ouvrir ${groupName}`,

  aGroupMember: "Un membre du groupe",
  aMember: "Un membre",
  aCard: "une carte",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("fr", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "Nouvelle demande d'échange",
  tradeRequestsHeading: "Nouvelles demandes d'échange",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} souhaite échanger contre votre ${cardHtml}.`
      : `${senderHtml} vous propose ${cardHtml}.`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants"
      ? `${sender} souhaite échanger contre ${cardName}`
      : `${sender} vous propose ${cardName}`,
  requestExpiryNote:
    "Ouvrez l'échange pour l'accepter ou le refuser. À noter : les demandes d'échange expirent 7 jours après leur envoi.",
  reachContact: (name, contact) => `Contacter ${name} : ${contact}`,
  viewTradeButton: "Voir l'échange",
  viewTradesButton: "Voir les échanges",
  viewTradesInButton: (groupName) => `Voir les échanges dans ${groupName}`,
  inGroupLine: (groupName) => `Dans ${groupName}`,
  wantsFromYouHeading: "Souhaite obtenir",
  offersYouHeading: "Vous propose",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`souhaite ${num("fr", wantsCount)} de vos cartes`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `vous propose ${num("fr", offersCount)}`
          : `vous propose ${num("fr", offersCount)} cartes`,
      );
    }
    return `${sender} ${joinParts(parts, "et", false)}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} vous a envoyé ${num("fr", total)} demandes d'échange. À noter : les demandes d'échange expirent 7 jours après leur envoi.`,

  statusHeading: "Mises à jour des échanges",
  statusOutcomeHeading: (event) =>
    ({ reserved: "Accepté", declined: "Refusé", cancelled: "Annulé" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} a accepté votre demande pour ${cardHtml}`;
      }
      case "declined": {
        return `${actorHtml} a refusé votre demande pour ${cardHtml}`;
      }
      case "cancelled": {
        return `${actorHtml} a annulé l'échange pour ${cardHtml}`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} a accepté votre demande d'échange`;
      }
      case "declined": {
        return `${actor} a refusé votre demande d'échange`;
      }
      case "cancelled": {
        return `${actor} a annulé un échange`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "accepté", count: counts.reserved },
      { verb: "refusé", count: counts.declined },
      { verb: "annulé", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${verb} ${num("fr", count)}`);
    return `${actor} a ${joinParts(parts, "et", false)} de vos échanges`;
  },
  statusLead: (actorHtml) => `${actorHtml} a mis à jour certains de vos échanges :`,

  digestHeading: "Nouvelles correspondances d'échange",
  digestSubject: (total) =>
    total === 1
      ? "1 nouvelle correspondance dans vos groupes d'échange"
      : `${num("fr", total)} nouvelles correspondances dans vos groupes d'échange`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} possède maintenant ${cardHtml} de votre liste de souhaits.`,
  digestLead:
    "Des membres de vos groupes possèdent maintenant des cartes de votre liste de souhaits :",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} possède`,

  otpSubject: (type) =>
    ({
      "sign-in": "Votre code de connexion",
      "email-verification": "Vérifiez votre adresse e-mail",
      "forget-password": "Réinitialisez votre mot de passe",
      "change-email": "Confirmez le changement d'adresse e-mail",
    })[type] ?? "Votre code de vérification",
  otpHeading: "Votre code de vérification",
  otpExpiryNote:
    "Ce code expire dans 5 minutes. Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.",
};

const EMAIL_MESSAGES: Record<DisplayLocale, EmailMessages> = { en, de, fr };

export function emailMessages(locale: DisplayLocale): EmailMessages {
  return EMAIL_MESSAGES[locale];
}
