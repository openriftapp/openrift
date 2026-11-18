import type { LucideIcon } from "lucide-react";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TouchTooltip } from "@/components/ui/touch-tooltip";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const TRIGGER_CLASS =
  "relative text-muted-foreground hover:text-foreground cursor-default after:absolute after:-inset-2 pointer-coarse:after:-inset-3";

/**
 * The (i) affordance that sits next to a field label and reveals a sentence of
 * explanatory copy, on hover or focus with a mouse and on tap on a phone.
 * @returns The hint trigger and its overlay.
 */
export function InfoHint({
  label,
  children,
  className,
  side = "top",
  icon: Icon = InfoIcon,
}: {
  /** Name of the field the hint belongs to; forms the trigger's accessible name. */
  label: string;
  /** The hint copy. */
  children: ReactNode;
  /** Extra classes for the icon. */
  className?: string;
  /** Preferred side for the overlay. */
  side?: "top" | "bottom" | "left" | "right";
  icon?: LucideIcon;
}) {
  return (
    <TouchTooltip
      content={children}
      side={side}
      className={TRIGGER_CLASS}
      aria-label={m.common_info_hint_label({ label })}
    >
      <Icon className={cn("size-3.5", className)} />
    </TouchTooltip>
  );
}
