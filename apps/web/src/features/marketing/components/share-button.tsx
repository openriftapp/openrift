import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShareButton({
  label,
  icon,
  href,
}: {
  label: string;
  icon: ReactNode;
  href: string;
}) {
  // Button-styled anchor, not Button-in-<a> (invalid) or BaseUI's `render` escape
  // hatch (it stamps role="button" on the anchor, so it stops announcing as a link).
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full gap-2")}
    >
      {icon}
      {label}
    </a>
  );
}
