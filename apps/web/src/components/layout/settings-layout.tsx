import type { ReactNode } from "react";

import { PageToc } from "@/components/layout/page-toc";
import type { PageTocItem } from "@/components/layout/page-toc";
import { cn } from "@/lib/utils";

// The caller owns the outer page padding and max width, passed via `className`.
export function SettingsLayout({
  toc,
  children,
  className,
}: {
  toc: PageTocItem[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full gap-6", className)}>
      <PageToc items={toc} />
      <div className="flex max-w-xl min-w-0 flex-1 flex-col gap-10">{children}</div>
    </div>
  );
}
