import type { EmailMessages } from "./shared.js";
import { joinParts, num } from "./shared.js";

export const fr: EmailMessages = {
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
      submissionAccepted: "E-mails de remerciement pour les soumissions acceptées",
      tradeRequests: "E-mails de demande d'échange",
      tradeStatus: "E-mails de statut d'échange",
      tradeMatches: "Résumé quotidien des correspondances",
    })[channel],

  joinRequestSubject: (groupName) => `Demande d'adhésion à ${groupName}`,
  joinRequestHeading: "Nouvelle demande d'adhésion",
  someone: "Quelqu'un",
  joinRequestLead: (requesterHtml, groupHtml) =>
    `${requesterHtml} a demandé à rejoindre ${groupHtml}. La personne reste en dehors du groupe jusqu'à l'approbation d'un admin.`,
  reviewRequestButton: "Examiner la demande",

  approvedSubject: (groupName) => `Vous êtes membre : ${groupName}`,
  approvedHeading: "Vous êtes membre",
  approvedLead: (groupHtml) =>
    `Un admin a approuvé votre demande : vous êtes maintenant membre de ${groupHtml}.`,
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

  statusHeading: "Suivi des échanges",
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

  footerContribution:
    "Vous recevez cet e-mail parce que vous avez envoyé une contribution à OpenRift.",
  acceptedHeading: "Merci pour votre aide",
  acceptedCardSubject: (cardName) => `Votre contribution pour ${cardName} a été acceptée`,
  acceptedCardLead: (cardHtml) =>
    `Votre contribution pour ${cardHtml} a été examinée et acceptée. Elle fait désormais partie des données de cartes d’OpenRift.`,
  acceptedDecklistSubject: (eventName) => `Votre decklist pour ${eventName} a été acceptée`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `La decklist que vous avez envoyée pour ${playerHtml} à ${eventHtml} a été examinée et acceptée. Elle figure désormais dans l'archive méta.`,
  acceptedEventSubject: (eventName) => `Votre correction de ${eventName} a été appliquée`,
  acceptedEventLead: (eventHtml) =>
    `Votre correction de ${eventHtml} a été examinée et appliquée. La page de l’événement l’affiche désormais.`,
  acceptedThanks:
    "Les données d’OpenRift sont tenues par une seule personne : des contributions comme la vôtre comblent les manques. Merci !",
  viewCardButton: (cardName) => `Voir ${cardName}`,
  viewDecklistButton: "Voir la decklist",
  viewEventButton: "Voir l’événement",
  viewSubmissionsButton: "Voir vos contributions",
  submissionsLinkLabel: "page de vos contributions",
  submissionsNote: (linkHtml) =>
    `Tout ce que vous avez envoyé et son statut se trouvent sur la ${linkHtml}.`,
};
