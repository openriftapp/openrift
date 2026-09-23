import type { EmailMessages } from "./shared.js";
import { num } from "./shared.js";

export const ko: EmailMessages = {
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
      submissionAccepted: "제출 채택 감사 메일",
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

  statusHeading: "교환 진행 상황",
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

  footerContribution: "OpenRift에 제출하신 내용이 있어 이 메일을 받으셨습니다.",
  acceptedHeading: "도와주셔서 감사합니다",
  acceptedCardSubject: (cardName) => `${cardName}에 대한 제출이 채택되었습니다`,
  acceptedCardLead: (cardHtml) =>
    `${cardHtml}에 대한 제출이 검토를 거쳐 채택되었습니다. 이제 OpenRift 카드 데이터에 반영되어 있습니다.`,
  acceptedDecklistSubject: (eventName) => `${eventName} 덱 목록이 채택되었습니다`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `${eventHtml}의 ${playerHtml} 덱 목록이 검토를 거쳐 채택되었습니다. 이제 메타 아카이브에 수록되어 있습니다.`,
  acceptedEventSubject: (eventName) => `${eventName} 수정 사항이 반영되었습니다`,
  acceptedEventLead: (eventHtml) =>
    `${eventHtml}에 대한 수정 사항이 검토를 거쳐 반영되었습니다. 이제 이벤트 페이지에 표시됩니다.`,
  acceptedThanks:
    "OpenRift의 데이터는 한 사람이 관리하기 때문에, 이런 제출이 빈 곳을 채워 줍니다. 감사합니다!",
  viewCardButton: (cardName) => `${cardName} 보기`,
  viewDecklistButton: "덱 목록 보기",
  viewEventButton: "이벤트 보기",
  viewSubmissionsButton: "내 제출 보기",
  submissionsLinkLabel: "제출 페이지",
  submissionsNote: (linkHtml) => `제출하신 모든 내용과 처리 상태는 ${linkHtml}에서 볼 수 있습니다.`,
};
