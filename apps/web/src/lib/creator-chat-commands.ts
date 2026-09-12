import { m } from "@/paraglide/messages.js";

export const CHAT_LOOKUP_PATH = "/api/v1/chat/card";

// oxlint-disable-next-line eslint/no-template-curly-in-string -- StreamElements' own syntax, not a JS placeholder; it must reach the bot literally
const STREAMELEMENTS_REST_OF_MESSAGE = "${1:}";

export interface ChatBotSetup {
  id: "nightbot" | "streamelements" | "fossabot";
  name: string;
  command: string;
  note: string;
}

export function chatLookupUrl(origin: string): string {
  return `${origin.replace(/\/+$/u, "")}${CHAT_LOOKUP_PATH}`;
}

export function chatBotSetups(origin: string): ChatBotSetup[] {
  const url = chatLookupUrl(origin);
  return [
    {
      id: "nightbot",
      name: "Nightbot",
      command: `!addcom !card $(urlfetch ${url}?q=$(querystring))`,
      note: m.chat_commands_note_nightbot(),
    },
    {
      id: "streamelements",
      name: "StreamElements",
      command: `!command add !card $(customapi ${url}?q=$(queryescape ${STREAMELEMENTS_REST_OF_MESSAGE}))`,
      note: m.chat_commands_note_streamelements(),
    },
    {
      id: "fossabot",
      name: "Fossabot",
      command: `!addcmd card $(customapi ${url}?q=$(urlencode $(query)))`,
      note: m.chat_commands_note_fossabot(),
    },
  ];
}
