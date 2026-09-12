import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cloneElement } from "react";

import { ExpandToggleChevronContext } from "@/components/ui/expand-toggle";
import { OrnamentRule } from "@/components/ui/ornament";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils";

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
