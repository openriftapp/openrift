import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { OrnamentRule } from "@/components/ui/ornament";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { m } from "@/paraglide/messages.js";

interface FloatingAction {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: "secondary" | "destructive";
  disabled?: boolean;
}

interface FloatingActionBarProps {
  selectedCount: number;
  actions: FloatingAction[];
  onClear: () => void;
}

export function FloatingActionBar({ selectedCount, actions, onClear }: FloatingActionBarProps) {
  const isMobile = useIsMobile();
  const buttonSize = isMobile ? "sm" : undefined;
  const count = m.collections_selection_count({ count: selectedCount });
  return (
    <div
      aria-label={count}
      className="bg-card border-border-accent fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col gap-2 rounded-sm border px-4 py-2 shadow-md md:px-5 md:py-3"
    >
      <OrnamentRule className="px-1">
        <span className="font-heading text-sm font-semibold tracking-wide">{count}</span>
      </OrnamentRule>
      <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant ?? "secondary"}
            size={buttonSize}
            onClick={() => action.onClick()}
            disabled={action.disabled}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
        <Button
          variant="ghost"
          size={isMobile ? "icon-sm" : "icon"}
          onClick={onClear}
          aria-label={m.collections_selection_clear()}
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
