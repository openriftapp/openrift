export type DeckMenuContext = "public" | "editor" | "row";

export type DeckMenuAction =
  | "present"
  | "play"
  | "compare"
  | "shareLink"
  | "saveImage"
  | "copyText"
  | "copyCode"
  | "copyTts"
  | "printProxies"
  | "printRegistration"
  | "storedIn"
  | "details"
  | "rename"
  | "cover"
  | "changeFormat"
  | "importReplace"
  | "duplicate"
  | "newVariant"
  | "variants"
  | "makePrimary"
  | "pin"
  | "folders"
  | "draft"
  | "archive"
  | "unarchive"
  | "delete";

export interface DeckMenuSubject {
  context: DeckMenuContext;
  server: boolean;
  cardCount: number;
  archived: boolean;
  isVariant: boolean;
  isPrimary: boolean;
  hasOtherFormats: boolean;
}

interface DeckMenuManage {
  storedIn: boolean;
  edit: DeckMenuAction[];
  copies: DeckMenuAction[];
  organize: DeckMenuAction[];
  directDuplicate: boolean;
  unarchive: boolean;
}

export interface DeckMenuModel {
  open: DeckMenuAction[];
  share: DeckMenuAction[];
  copy: DeckMenuAction[];
  print: DeckMenuAction[];
  manage: DeckMenuManage | null;
  disabled: ReadonlySet<DeckMenuAction>;
}

const NEEDS_CARDS: readonly DeckMenuAction[] = [
  "present",
  "play",
  "saveImage",
  "copyText",
  "copyCode",
  "copyTts",
  "printProxies",
  "printRegistration",
];

function manageModel(subject: DeckMenuSubject): DeckMenuManage {
  const { server, context } = subject;
  const edit: DeckMenuAction[] = [server ? "details" : "rename", "cover"];
  if (subject.hasOtherFormats) {
    edit.push("changeFormat");
  }
  if (context === "editor") {
    edit.push("importReplace");
  }
  const copies: DeckMenuAction[] = ["duplicate"];
  if (server) {
    copies.push("newVariant", "variants");
    if (subject.isVariant && !subject.isPrimary) {
      copies.push("makePrimary");
    }
  }
  return {
    storedIn: server,
    edit,
    copies: copies.length > 1 ? copies : [],
    organize: server ? ["pin", "folders", "draft", "archive"] : [],
    directDuplicate: copies.length === 1,
    unarchive: server && subject.archived,
  };
}

export function deckMenuModel(subject: DeckMenuSubject): DeckMenuModel {
  const own = subject.context !== "public";
  const open: DeckMenuAction[] = [];
  if (own && subject.server) {
    open.push("present");
  }
  open.push("play", "compare");

  const disabled = new Set<DeckMenuAction>(subject.cardCount === 0 ? NEEDS_CARDS : []);

  return {
    open,
    share: !own || subject.server ? ["shareLink", "saveImage"] : ["saveImage"],
    copy: ["copyText", "copyCode", "copyTts"],
    print: ["printProxies", "printRegistration"],
    manage: own ? manageModel(subject) : null,
    disabled,
  };
}
