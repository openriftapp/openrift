import type { EmailMessages } from "./shared.js";
import { num } from "./shared.js";

export const zhHant: EmailMessages = {
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
      submissionAccepted: "提交採用感謝郵件",
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

  footerContribution: "您會收到這封郵件，是因為您向 OpenRift 提交了內容。",
  acceptedHeading: "感謝您的幫忙",
  acceptedCardSubject: (cardName) => `您對 ${cardName} 的提交已被採用`,
  acceptedCardLead: (cardHtml) =>
    `您對 ${cardHtml} 的提交已經審核並採用，現在已成為 OpenRift 卡牌資料的一部分。`,
  acceptedDecklistSubject: (eventName) => `您為 ${eventName} 提交的牌組清單已被採用`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `您為 ${eventHtml} 中 ${playerHtml} 提交的牌組清單已經審核並採用，現已收錄進環境存檔。`,
  acceptedEventSubject: (eventName) => `您對 ${eventName} 的更正已套用`,
  acceptedEventLead: (eventHtml) =>
    `您對 ${eventHtml} 的更正已經審核並套用，賽事頁面現在已顯示更新。`,
  acceptedThanks: "OpenRift 的資料由一個人維護，像您這樣的提交幫忙補上了缺漏。謝謝！",
  viewCardButton: (cardName) => `查看 ${cardName}`,
  viewDecklistButton: "查看牌組清單",
  viewEventButton: "查看賽事",
  viewSubmissionsButton: "查看您的提交",
  submissionsLinkLabel: "提交頁面",
  submissionsNote: (linkHtml) => `您提交的所有內容及其狀態都在您的${linkHtml}上。`,
};
