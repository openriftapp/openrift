import type { ReactNode } from "react";

import { PageToc, PageTocProvider } from "@/components/layout/page-toc";
import type { PageTocItem } from "@/components/layout/page-toc";
import { cn } from "@/lib/utils";

/**
 * The caller owns the outer page padding and max width, passed via `className`.
 * `scope` names the record the page edits; a new one starts the contents list fresh.
 */
export function SettingsLayout({
  toc,
  scope,
  children,
  className,
}: {
  toc: PageTocItem[];
  scope?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex w-full gap-6", className)}>
      <PageTocProvider key={scope}>
        <PageToc items={toc} />
      </PageTocProvider>
      <div className="flex max-w-xl min-w-0 flex-1 flex-col gap-10">{children}</div>
    </div>
  );
}
