export type WorkspaceKeyAction =
  | "next"
  | "previous"
  | "settle-and-next"
  | "accept-new"
  | "skip"
  | "ignore"
  | "undo"
  | "use-suggestion";

export interface WorkspaceKeyBinding {
  key: string;
  action: WorkspaceKeyAction;
  label: string;
}

export const WORKSPACE_KEYS = [
  { key: "j", action: "next", label: "Next item" },
  { key: "k", action: "previous", label: "Previous item" },
  { key: "Enter", action: "settle-and-next", label: "Discard remaining suggestions, then next" },
  { key: "a", action: "accept-new", label: "Accept new record" },
  { key: "s", action: "skip", label: "Move to the end" },
  { key: "x", action: "ignore", label: "Ignore" },
  { key: "z", action: "undo", label: "Undo" },
] as const satisfies readonly WorkspaceKeyBinding[];

export const SUGGESTION_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
