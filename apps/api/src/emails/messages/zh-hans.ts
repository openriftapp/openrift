import type { EmailMessages } from "./shared.js";
import { num } from "./shared.js";

export const zhHans: EmailMessages = {
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
      submissionAccepted: "提交采纳感谢邮件",
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
      "email-verification": "验证你的邮箱",
      "forget-password": "重置你的密码",
      "change-email": "确认更改邮箱地址",
    })[type] ?? "你的验证码",
  otpHeading: "你的验证码",
  otpExpiryNote: "此验证码将在 5 分钟后过期。如果这不是你本人的操作，可以忽略这封邮件。",

  footerContribution: "你收到这封邮件，是因为你向 OpenRift 提交了内容。",
  acceptedHeading: "感谢你的帮助",
  acceptedCardSubject: (cardName) => `你对 ${cardName} 的提交已被采纳`,
  acceptedCardLead: (cardHtml) =>
    `你对 ${cardHtml} 的提交已经审核并采纳，现在已成为 OpenRift 卡牌数据的一部分。`,
  acceptedDecklistSubject: (eventName) => `你为 ${eventName} 提交的卡组表已被采纳`,
  acceptedDecklistLead: (playerHtml, eventHtml) =>
    `你为 ${eventHtml} 中 ${playerHtml} 提交的卡组表已经审核并采纳，现已收录进 Meta 档案。`,
  acceptedEventSubject: (eventName) => `你对 ${eventName} 的更正已应用`,
  acceptedEventLead: (eventHtml) =>
    `你对 ${eventHtml} 的更正已经审核并应用，赛事页面现在已显示更新。`,
  acceptedThanks: "OpenRift 的数据由一个人维护，像你这样的提交帮忙补上了空缺。谢谢！",
  viewCardButton: (cardName) => `查看 ${cardName}`,
  viewDecklistButton: "查看卡组表",
  viewEventButton: "查看赛事",
  viewSubmissionsButton: "查看你的提交",
  submissionsLinkLabel: "提交页面",
  submissionsNote: (linkHtml) => `你提交的所有内容及其状态都在你的${linkHtml}上。`,
};
