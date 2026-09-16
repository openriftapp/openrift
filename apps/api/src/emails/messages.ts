import type { DisplayLocale } from "@openrift/shared/types/api/preferences";

import { de } from "./messages/de.js";
import { en } from "./messages/en.js";
import { fr } from "./messages/fr.js";
import { ko } from "./messages/ko.js";
import type { EmailMessages } from "./messages/shared.js";
import { zhHans } from "./messages/zh-hans.js";
import { zhHant } from "./messages/zh-hant.js";

export type { EmailMessages, TradeRequestKind, TradeStatusEvent } from "./messages/shared.js";

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
