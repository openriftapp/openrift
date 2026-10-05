import type { LucideIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export function CardContextMenu({ menu, children }: { menu: ReactNode; children?: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger
        className="block select-none [-webkit-touch-callout:none]"
        render={<div />}
      >
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">{menu}</ContextMenuContent>
    </ContextMenu>
  );
}

/** The click stays inside the menu: the tile behind it would otherwise read it as a selection click. */
export function CardMenuItem({
  icon: Icon,
  onSelect,
  render,
  variant,
  children,
}: {
  icon: LucideIcon;
  onSelect?: () => void;
  render?: ReactElement;
  variant?: "default" | "destructive";
  children: ReactNode;
}) {
  return (
    <ContextMenuItem
      variant={variant}
      render={render}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <Icon />
      {children}
    </ContextMenuItem>
  );
}
