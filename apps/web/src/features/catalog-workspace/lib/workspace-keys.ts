export type WorkspaceKeyAction =
  | "next"
  | "previous"
  | "advance"
  | "accept-new"
  | "ignore"
  | "dismiss-all"
  | "undo";

export interface WorkspaceKeyBinding {
  key: string;
  action: WorkspaceKeyAction;
  label: string;
}

export const WORKSPACE_KEYS = [
  { key: "j", action: "next", label: "Next item" },
  { key: "k", action: "previous", label: "Previous item" },
  { key: "Enter", action: "advance", label: "Next" },
  { key: "a", action: "accept-new", label: "Create new record" },
  { key: "x", action: "ignore", label: "Ignore" },
  { key: "d", action: "dismiss-all", label: "Dismiss all suggestions" },
  { key: "z", action: "undo", label: "Undo" },
] as const satisfies readonly WorkspaceKeyBinding[];
