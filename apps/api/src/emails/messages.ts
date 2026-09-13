import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

export type TradeRequestKind = "wants" | "offers";

export type TradeStatusEvent = "reserved" | "declined" | "cancelled";

type EmailUnsubscribeChannel =
  | "groupJoinRequests"
  | "groupApprovals"
  | "tradeRequests"
  | "tradeStatus"
  | "tradeMatches";

interface StatusCounts {
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

const zhHans: EmailMessages = {
  htmlLang: "zh-Hans",
  greeting: (nameHtml) => (nameHtml ? `你好，${nameHtml}：` : "你好："),
  footerTrading: "你收到这封邮件，是因为你在 OpenRift 上的交换活动。",
  footerGroupOwner: "你收到这封邮件，是因为你在 OpenRift 上管理着一个小组。",
  footerGroupJoin: "你收到这封邮件，是因为你申请加入 OpenRift 上的一个小组。",
  unsubscribeWord: "退订",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "小组加入申请",
      groupApprovals: "小组欢迎邮件",
      tradeRequests: "交换请求邮件",
      tradeStatus: "交换状态邮件",
      tradeMatches: "每日匹配摘要",
    })[channel],

  joinRequestSubject: (groupName) => `${groupName} 的加入申请`,
  joinRequestHeading: "新的加入申请",
  someone: "有人",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} 申请加入 ${groupHtml}。在管理员批准之前，该用户不会进入小组。`,
  reviewRequestButton: "查看申请",

  approvedSubject: (groupName) => `欢迎加入：${groupName}`,
  approvedHeading: "欢迎加入",
  approvedLead: (groupHtml) => `管理员已批准你的申请，你现在是 ${groupHtml} 的成员了。`,
  approvedBenefitsIntro: "你现在可以：",
  approvedBenefits: [
    "浏览其他成员分享的所有收藏、心愿单和交换清单。",
    "交换匹配：你心愿单上的卡牌，小组里正好有人多出来。",
    "实时关注小组的交换和动态。",
  ],
  managePageLinkLabel: "管理页面",
  approvedVisibilityNote: (linkHtml) =>
    `你的内容目前还不可见。请在${linkHtml}上选择小组可以看到哪些清单和收藏。`,
  openGroupButton: (groupName) => `打开 ${groupName}`,

  aGroupMember: "某位小组成员",
  aMember: "某位成员",
  aCard: "一张卡牌",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("zh-Hans", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "新的交换请求",
  tradeRequestsHeading: "新的交换请求",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} 想交换你的 ${cardHtml}。`
      : `${senderHtml} 想把 ${cardHtml} 让给你。`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants" ? `${sender} 想交换 ${cardName}` : `${sender} 向你提供 ${cardName}`,
  requestExpiryNote: "打开这次交换即可接受或拒绝。请注意：交换请求在发出 7 天后过期。",
  reachContact: (name, contact) => `联系 ${name}：${contact}`,
  viewTradeButton: "查看交换",
  viewTradesButton: "查看交换",
  viewTradesInButton: (groupName) => `查看 ${groupName} 中的交换`,
  inGroupLine: (groupName) => `在 ${groupName}`,
  wantsFromYouHeading: "想要你的",
  offersYouHeading: "向你提供",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`想要你的 ${num("zh-Hans", wantsCount)} 张卡牌`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `向你提供 ${num("zh-Hans", offersCount)} 张`
          : `向你提供 ${num("zh-Hans", offersCount)} 张卡牌`,
      );
    }
    return `${sender} ${parts.join("，")}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} 给你发来了 ${num("zh-Hans", total)} 条交换请求。请注意：交换请求在发出 7 天后过期。`,

  statusHeading: "交换动态",
  statusOutcomeHeading: (event) =>
    ({ reserved: "已接受", declined: "已拒绝", cancelled: "已取消" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} 接受了你对 ${cardHtml} 的请求`;
      }
      case "declined": {
        return `${actorHtml} 拒绝了你对 ${cardHtml} 的请求`;
      }
      case "cancelled": {
        return `${actorHtml} 取消了 ${cardHtml} 的交换`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} 接受了你的交换请求`;
      }
      case "declined": {
        return `${actor} 拒绝了你的交换请求`;
      }
      case "cancelled": {
        return `${actor} 取消了一次交换`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "接受", count: counts.reserved },
      { verb: "拒绝", count: counts.declined },
      { verb: "取消", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${verb}了 ${num("zh-Hans", count)} 次`);
    return `${actor} 在你的交换中${parts.join("、")}`;
  },
  statusLead: (actorHtml) => `${actorHtml} 更新了你的部分交换：`,

  digestHeading: "新的交换匹配",
  digestSubject: (total) =>
    total === 1
      ? "你的交换小组里有 1 个新匹配"
      : `你的交换小组里有 ${num("zh-Hans", total)} 个新匹配`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} 现在有你心愿单上的 ${cardHtml}。`,
  digestLead: "你所在小组的成员现在有你心愿单上的卡牌：",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} 拥有`,

  otpSubject: (type) =>
    ({
      "sign-in": "你的登录验证码",
      "email-verification": "验证你的邮箱地址",
      "forget-password": "重置你的密码",
      "change-email": "确认更改邮箱地址",
    })[type] ?? "你的验证码",
  otpHeading: "你的验证码",
  otpExpiryNote: "此验证码将在 5 分钟后过期。如果这不是你本人的操作，可以忽略这封邮件。",
};

const zhHant: EmailMessages = {
  htmlLang: "zh-Hant",
  greeting: (nameHtml) => (nameHtml ? `${nameHtml} 您好：` : "您好："),
  footerTrading: "您會收到這封郵件，是因為您在 OpenRift 上的交換活動。",
  footerGroupOwner: "您會收到這封郵件，是因為您在 OpenRift 上管理著一個小組。",
  footerGroupJoin: "您會收到這封郵件，是因為您申請加入 OpenRift 上的某個小組。",
  unsubscribeWord: "取消訂閱",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "小組加入申請",
      groupApprovals: "小組歡迎郵件",
      tradeRequests: "交換請求郵件",
      tradeStatus: "交換狀態郵件",
      tradeMatches: "每日配對摘要",
    })[channel],

  joinRequestSubject: (groupName) => `${groupName} 的加入申請`,
  joinRequestHeading: "新的加入申請",
  someone: "有人",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} 申請加入 ${groupHtml}。在管理員核准之前，該使用者不會進入小組。`,
  reviewRequestButton: "查看申請",

  approvedSubject: (groupName) => `歡迎加入：${groupName}`,
  approvedHeading: "歡迎加入",
  approvedLead: (groupHtml) => `管理員已核准您的申請，您現在是 ${groupHtml} 的成員了。`,
  approvedBenefitsIntro: "您現在可以：",
  approvedBenefits: [
    "瀏覽其他成員分享的所有收藏、願望清單與交換清單。",
    "交換配對：您願望清單上的卡牌，小組裡正好有人多出來。",
    "即時關注小組的交換與動態。",
  ],
  managePageLinkLabel: "管理頁面",
  approvedVisibilityNote: (linkHtml) =>
    `您的內容目前還不會顯示。請在${linkHtml}上選擇小組可以看到哪些清單與收藏。`,
  openGroupButton: (groupName) => `開啟 ${groupName}`,

  aGroupMember: "某位小組成員",
  aMember: "某位成員",
  aCard: "一張卡牌",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${num("zh-Hant", quantity)}× ${cardName}` : cardName,
  tradeRequestHeading: "新的交換請求",
  tradeRequestsHeading: "新的交換請求",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml} 想交換您的 ${cardHtml}。`
      : `${senderHtml} 想把 ${cardHtml} 讓給您。`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants" ? `${sender} 想交換 ${cardName}` : `${sender} 向您提供 ${cardName}`,
  requestExpiryNote: "開啟這次交換即可接受或拒絕。請注意：交換請求在送出 7 天後過期。",
  reachContact: (name, contact) => `聯絡 ${name}：${contact}`,
  viewTradeButton: "查看交換",
  viewTradesButton: "查看交換",
  viewTradesInButton: (groupName) => `查看 ${groupName} 中的交換`,
  inGroupLine: (groupName) => `在 ${groupName}`,
  wantsFromYouHeading: "想要您的",
  offersYouHeading: "向您提供",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    const parts: string[] = [];
    if (wantsCount > 0) {
      parts.push(`想要您的 ${num("zh-Hant", wantsCount)} 張卡牌`);
    }
    if (offersCount > 0) {
      parts.push(
        wantsCount > 0
          ? `向您提供 ${num("zh-Hant", offersCount)} 張`
          : `向您提供 ${num("zh-Hant", offersCount)} 張卡牌`,
      );
    }
    return `${sender} ${parts.join("，")}`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml} 向您送出了 ${num("zh-Hant", total)} 則交換請求。請注意：交換請求在送出 7 天後過期。`,

  statusHeading: "交換動態",
  statusOutcomeHeading: (event) =>
    ({ reserved: "已接受", declined: "已拒絕", cancelled: "已取消" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml} 接受了您對 ${cardHtml} 的請求`;
      }
      case "declined": {
        return `${actorHtml} 拒絕了您對 ${cardHtml} 的請求`;
      }
      case "cancelled": {
        return `${actorHtml} 取消了 ${cardHtml} 的交換`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor} 接受了您的交換請求`;
      }
      case "declined": {
        return `${actor} 拒絕了您的交換請求`;
      }
      case "cancelled": {
        return `${actor} 取消了一次交換`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "接受", count: counts.reserved },
      { verb: "拒絕", count: counts.declined },
      { verb: "取消", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${verb}了 ${num("zh-Hant", count)} 次`);
    return `${actor} 在您的交換中${parts.join("、")}`;
  },
  statusLead: (actorHtml) => `${actorHtml} 更新了您的部分交換：`,

  digestHeading: "新的交換配對",
  digestSubject: (total) =>
    total === 1
      ? "您的交換小組裡有 1 個新配對"
      : `您的交換小組裡有 ${num("zh-Hant", total)} 個新配對`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml} 現在有您願望清單上的 ${cardHtml}。`,
  digestLead: "您所在小組的成員現在有您願望清單上的卡牌：",
  counterpartyHasHeading: (labelHtml) => `${labelHtml} 擁有`,

  otpSubject: (type) =>
    ({
      "sign-in": "您的登入驗證碼",
      "email-verification": "驗證您的電子郵件地址",
      "forget-password": "重設您的密碼",
      "change-email": "確認變更電子郵件地址",
    })[type] ?? "您的驗證碼",
  otpHeading: "您的驗證碼",
  otpExpiryNote: "此驗證碼將在 5 分鐘後過期。如果這不是您本人的操作，可以忽略這封郵件。",
};

const ko: EmailMessages = {
  htmlLang: "ko",
  greeting: (nameHtml) => (nameHtml ? `${nameHtml}님, 안녕하세요.` : "안녕하세요."),
  footerTrading: "OpenRift에서의 교환 활동으로 인해 이 메일을 받으셨습니다.",
  footerGroupOwner: "OpenRift에서 그룹을 운영하고 계셔서 이 메일을 받으셨습니다.",
  footerGroupJoin: "OpenRift에서 그룹 가입을 신청하셔서 이 메일을 받으셨습니다.",
  unsubscribeWord: "수신 거부",
  unsubscribeLabel: (channel) =>
    ({
      groupJoinRequests: "그룹 가입 신청",
      groupApprovals: "그룹 환영 메일",
      tradeRequests: "교환 요청 메일",
      tradeStatus: "교환 상태 메일",
      tradeMatches: "일일 매칭 요약",
    })[channel],

  joinRequestSubject: (groupName) => `${groupName} 가입 신청`,
  joinRequestHeading: "새 가입 신청",
  someone: "어떤 사용자",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml}님이 ${groupHtml}에 가입을 신청했습니다. 관리자가 승인할 때까지는 그룹에 참여하지 않습니다.`,
  reviewRequestButton: "신청 검토하기",

  approvedSubject: (groupName) => `가입 완료: ${groupName}`,
  approvedHeading: "가입이 완료되었습니다",
  approvedLead: (groupHtml) => `관리자가 신청을 승인하여 이제 ${groupHtml}의 멤버입니다.`,
  approvedBenefitsIntro: "이제 이런 것을 할 수 있습니다:",
  approvedBenefits: [
    "다른 멤버들이 공유한 모든 컬렉션, 위시리스트, 교환 목록을 둘러볼 수 있습니다.",
    "교환 매칭: 위시리스트에 있는 카드를 그룹의 누군가가 여분으로 가지고 있습니다.",
    "그룹의 교환과 활동을 실시간으로 확인할 수 있습니다.",
  ],
  managePageLinkLabel: "관리 페이지",
  approvedVisibilityNote: (linkHtml) =>
    `아직 회원님의 목록은 공개되지 않았습니다. ${linkHtml}에서 그룹에 보여 줄 목록과 컬렉션을 선택하세요.`,
  openGroupButton: (groupName) => `${groupName} 열기`,

  aGroupMember: "그룹 멤버",
  aMember: "멤버",
  aCard: "카드",
  quantityLabel: (quantity, cardName) =>
    quantity > 1 ? `${cardName} ${num("ko", quantity)}장` : cardName,
  tradeRequestHeading: "새 교환 요청",
  tradeRequestsHeading: "새 교환 요청",
  requestLead: (senderHtml, cardHtml, kind) =>
    kind === "wants"
      ? `${senderHtml}님이 회원님의 ${cardHtml} 카드와 교환하고 싶어 합니다.`
      : `${senderHtml}님이 ${cardHtml} 카드를 제안했습니다.`,
  requestSubject: (sender, cardName, kind) =>
    kind === "wants"
      ? `${sender}님이 ${cardName} 카드와 교환을 원합니다`
      : `${sender}님이 ${cardName} 카드를 제안합니다`,
  requestExpiryNote:
    "교환을 열어 수락하거나 거절하세요. 참고로 교환 요청은 보낸 지 7일이 지나면 만료됩니다.",
  reachContact: (name, contact) => `${name}님 연락처: ${contact}`,
  viewTradeButton: "교환 보기",
  viewTradesButton: "교환 목록 보기",
  viewTradesInButton: (groupName) => `${groupName}의 교환 보기`,
  inGroupLine: (groupName) => `${groupName}에서`,
  wantsFromYouHeading: "원하는 카드",
  offersYouHeading: "제안하는 카드",
  coalescedRequestSubject: (sender, wantsCount, offersCount) => {
    if (wantsCount > 0 && offersCount > 0) {
      return `${sender}님이 회원님의 카드 ${num("ko", wantsCount)}장을 원하고 카드 ${num("ko", offersCount)}장을 제안합니다`;
    }
    if (wantsCount > 0) {
      return `${sender}님이 회원님의 카드 ${num("ko", wantsCount)}장을 원합니다`;
    }
    return `${sender}님이 카드 ${num("ko", offersCount)}장을 제안합니다`;
  },
  coalescedRequestLead: (senderHtml, total) =>
    `${senderHtml}님이 교환 요청 ${num("ko", total)}건을 보냈습니다. 참고로 교환 요청은 보낸 지 7일이 지나면 만료됩니다.`,

  statusHeading: "교환 업데이트",
  statusOutcomeHeading: (event) =>
    ({ reserved: "수락됨", declined: "거절됨", cancelled: "취소됨" })[event],
  statusPhrase: (actorHtml, cardHtml, event) => {
    switch (event) {
      case "reserved": {
        return `${actorHtml}님이 ${cardHtml} 카드 요청을 수락했습니다`;
      }
      case "declined": {
        return `${actorHtml}님이 ${cardHtml} 카드 요청을 거절했습니다`;
      }
      case "cancelled": {
        return `${actorHtml}님이 ${cardHtml} 카드 교환을 취소했습니다`;
      }
    }
  },
  singleStatusSubject: (actor, event) => {
    switch (event) {
      case "reserved": {
        return `${actor}님이 교환 요청을 수락했습니다`;
      }
      case "declined": {
        return `${actor}님이 교환 요청을 거절했습니다`;
      }
      case "cancelled": {
        return `${actor}님이 교환을 취소했습니다`;
      }
    }
  },
  statusCountSubject: (actor, counts) => {
    const parts = [
      { verb: "수락", count: counts.reserved },
      { verb: "거절", count: counts.declined },
      { verb: "취소", count: counts.cancelled },
    ]
      .filter(({ count }) => count > 0)
      .map(({ verb, count }) => `${num("ko", count)}건 ${verb}`);
    return `${actor}님이 회원님의 교환을 ${parts.join(", ")}했습니다`;
  },
  statusLead: (actorHtml) => `${actorHtml}님이 회원님의 교환 일부를 업데이트했습니다:`,

  digestHeading: "새로운 교환 매칭",
  digestSubject: (total) =>
    total === 1 ? "교환 그룹에 새로운 매칭 1건" : `교환 그룹에 새로운 매칭 ${num("ko", total)}건`,
  digestSingleLead: (counterpartyHtml, cardHtml) =>
    `${counterpartyHtml}님이 회원님의 위시리스트에 있는 ${cardHtml} 카드를 보유하게 되었습니다.`,
  digestLead: "그룹 멤버들이 회원님의 위시리스트에 있는 카드를 보유하고 있습니다:",
  counterpartyHasHeading: (labelHtml) => `${labelHtml}님의 보유 카드`,

  otpSubject: (type) =>
    ({
      "sign-in": "로그인 코드",
      "email-verification": "이메일 주소를 인증하세요",
      "forget-password": "비밀번호를 재설정하세요",
      "change-email": "이메일 변경을 확인하세요",
    })[type] ?? "인증 코드",
  otpHeading: "인증 코드",
  otpExpiryNote: "이 코드는 5분 후에 만료됩니다. 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다.",
};

const EMAIL_MESSAGES: Record<DisplayLocale, EmailMessages> = {
  en,
  de,
  fr,
  "zh-Hans": zhHans,
  "zh-Hant": zhHant,
  ko,
};

export function emailMessages(locale: DisplayLocale): EmailMessages {
  return EMAIL_MESSAGES[locale];
}
