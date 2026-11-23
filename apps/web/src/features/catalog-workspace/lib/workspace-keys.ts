export type WorkspaceKeyAction =
  | "next"
  | "previous"
  | "settle-and-next"
  | "accept-new"
  | "ignore"
  | "undo";

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
  { key: "x", action: "ignore", label: "Ignore" },
  { key: "z", action: "undo", label: "Undo" },
] as const satisfies readonly WorkspaceKeyBinding[];
