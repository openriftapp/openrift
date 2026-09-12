"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// custom: `variant` — row hairlines are opt-in, for tall multi-line rows only; drawn on the lower row so windowed tables never drop one mid-list
function Table({
  className,
  variant = "plain",
  interactive = true,
  ...props
}: React.ComponentProps<"table"> & { variant?: "divided" | "plain"; interactive?: boolean }) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        data-variant={variant}
        className={cn(
          "w-full caption-bottom text-sm",
          variant === "divided" && "[&_tbody_tr+tr]:border-t",
          // custom: `interactive={false}` — a read-only table draws no hover wash
          !interactive && "[&_tbody_tr]:hover:bg-transparent",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" className={cn("[&_tr]:border-b", className)} {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  // custom: dropped `[&_tr:last-child]:border-0` — rows draw no bottom border to cancel
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      // custom: no tonal band — the top rule alone marks the totals row
      className={cn("border-t font-medium", className)}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // custom: no `border-b` — rows separate by spacing and the hover wash
        "hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted transition-colors",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn("p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", className)}
      {...props}
    />
  );
}

function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
