import { ChevronRightIcon } from "lucide-react";
import { createContext, use } from "react";

import { OrnamentFoldGem } from "@/components/ui/ornament";
import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).
//
// ExpandToggle is the disclosure button that collapses/expands a section: a
// chevron that points right when closed and rotates down when open, plus
// whatever label content the call site provides as children. It owns the
// invariants (button semantics, aria-expanded, the rotating chevron, focus
// ring) and leaves layout to the call site. Icon-only toggles pass no
// children; toggles whose chevron trails the label pass `chevronPosition="end"`.
// It is deliberately independent of Collapsible so store-driven surfaces
// (e.g. the rules fold store) can use it too.

/**
 * Disclosure toggle with a rotating chevron and `aria-expanded` wired to the
 * `expanded` prop.
 *
 * @returns The expand/collapse button element.
 */
/** Headers on a gold rule set this to `gem` so every toggle inside draws the ornament fold gem. */
const ExpandToggleChevronContext = createContext<"chevron" | "gem">("chevron");

function ExpandToggle({
  expanded,
  chevronPosition = "start",
  chevron,
  chevronClassName,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & {
  expanded: boolean;
  chevronPosition?: "start" | "end";
  /** `gem` draws the ornament fold gem instead of the chevron, for headers on a gold rule. */
  chevron?: "chevron" | "gem";
  chevronClassName?: string;
}) {
  const chevronKind = chevron ?? use(ExpandToggleChevronContext);
  const glyph =
    chevronKind === "gem" ? (
      <OrnamentFoldGem expanded={expanded} className={chevronClassName} />
    ) : (
      <ChevronRightIcon
        className={cn(
          "text-muted-foreground size-4 shrink-0 transition-transform",
          expanded && "rotate-90",
          chevronClassName,
        )}
      />
    );
  return (
    <button
      data-slot="expand-toggle"
      type="button"
      aria-expanded={expanded}
      className={cn(
        "focus-visible:ring-ring/50 flex cursor-pointer items-center gap-2 text-left focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      {chevronPosition === "start" && glyph}
      {children}
      {chevronPosition === "end" && glyph}
    </button>
  );
}

export { ExpandToggle, ExpandToggleChevronContext };
