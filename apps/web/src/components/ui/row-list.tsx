import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import * as React from "react";

import { cn } from "@/lib/utils";

// Hand-authored primitive (not shadcn-scaffolded).
//
// The flat list under a SectionHeading, rows separated by spacing; `divided`
// adds hairlines for tall multi-line rows only. CardList/Card keep their own edge.

function RowList({
  className,
  variant = "plain",
  ...props
}: React.ComponentProps<"ul"> & { variant?: "divided" | "plain" }) {
  return (
    <ul
      data-slot="row-list"
      data-variant={variant}
      className={cn(variant === "divided" ? "divide-y" : "[&>li]:py-1", className)}
      {...props}
    />
  );
}

function RowListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="row-list-item"
      className={cn("flex min-w-0 items-center gap-3 py-2.5 first:pt-0 last:pb-0", className)}
      {...props}
    />
  );
}

function RowListLink({ className, render, ...props }: useRender.ComponentProps<"a">) {
  return useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      {
        className: cn(
          "hover:bg-muted/50 -mx-2 flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-1 no-underline",
          className,
        ),
      },
      props,
    ),
    render,
  });
}

export { RowList, RowListItem, RowListLink };
