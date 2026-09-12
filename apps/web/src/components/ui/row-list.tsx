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
      className={cn(
        variant === "divided"
          ? "[&>li]:py-2.5 [&>li+li]:border-t [&>li:first-child]:pt-0 [&>li:last-child]:pb-0"
          : "flex flex-col gap-2",
        className,
      )}
      {...props}
    />
  );
}

function RowListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="row-list-item"
      className={cn("flex min-w-0 items-center gap-3", className)}
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
