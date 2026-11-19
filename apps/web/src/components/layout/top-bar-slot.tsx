import type { ReactNode } from "react";
import { createContext, use } from "react";
import { createPortal } from "react-dom";

/** Portal slot for the full-width top bar rendered above the sidebar + content row. */
export const TopBarSlotContext = createContext<HTMLDivElement | null>(null);

/** Renders its children into the layout's {@link TopBarSlotContext} slot, or nothing before the slot mounts. */
export function TopBarSlotPortal({ children }: { children: ReactNode }) {
  const slot = use(TopBarSlotContext);
  return slot ? createPortal(children, slot) : null;
}
