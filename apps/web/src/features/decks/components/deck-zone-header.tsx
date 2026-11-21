import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import type { DeckViolation } from "@openrift/shared/deck-rules";
import { AlertTriangleIcon } from "lucide-react";
import { cloneElement } from "react";

import { Button } from "@/components/ui/button";
import { ExpandToggleChevronContext } from "@/components/ui/expand-toggle";
import { OrnamentRule } from "@/components/ui/ornament";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export const ZONE_ADD_STRIP_CLASS =
  "flex h-auto min-h-9 w-full items-center justify-start gap-2 rounded-md px-2.5 py-1.5 text-left font-normal whitespace-normal sm:min-h-8";

/**
 * Height is fixed so a taller trailing element can't stretch one zone's
 * header past the others.
 */
export function DeckZoneHeader({
  label,
  labelAs = "span",
  labelClassName,
  labelRender,
  leading,
  children,
  className,
  render,
  ...props
}: useRender.ComponentProps<"div"> &
  Omit<React.ComponentProps<"div">, "children"> & {
    label: React.ReactNode;
    labelAs?: "h3" | "span";
    labelClassName?: string;
    labelRender?: React.ReactElement;
    leading?: React.ReactNode;
    children?: React.ReactNode;
  }) {
  const heading = (
    <SectionHeading as={labelAs} className={labelClassName}>
      {label}
    </SectionHeading>
  );
  let leadingGem: React.ReactNode;
  if (leading !== undefined) {
    leadingGem = leading;
  } else if (labelRender === undefined) {
    leadingGem = undefined;
  } else {
    leadingGem = null;
  }
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">({ className: cn("flex h-6 items-center", className) }, props, {
      children: (
        <ExpandToggleChevronContext value="gem">
          <OrnamentRule
            align="start"
            fade="tips"
            className="min-w-0 flex-1"
            leadingGem={leadingGem}
            trailing={children}
          >
            <span className="flex min-w-0 items-center">
              {labelRender === undefined ? heading : cloneElement(labelRender, {}, heading)}
            </span>
          </OrnamentRule>
        </ExpandToggleChevronContext>
      ),
    }),
    render,
  });
}

export function ZoneIssuesPopover({
  zoneLabel,
  issues,
}: {
  zoneLabel: string;
  issues: readonly Pick<DeckViolation, "code" | "cardId" | "message">[];
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={m.decks_overview_zone_issues({ zone: zoneLabel })}
            className="size-5 shrink-0"
          />
        }
      >
        <AlertTriangleIcon className="text-destructive size-3.5" />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-auto max-w-80 p-2">
        <ul className="space-y-0.5">
          {issues.map((issue) => (
            <li key={`${issue.code}-${issue.cardId ?? ""}`} className="text-xs">
              {issue.message}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
