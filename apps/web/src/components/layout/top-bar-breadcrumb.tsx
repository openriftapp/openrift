import { ArrowLeftIcon } from "lucide-react";
import type { CSSProperties, ReactElement, ReactNode } from "react";
import { cloneElement, Fragment, useState } from "react";

import {
  PageTopBar,
  PageTopBarActions,
  PageTopBarSticky,
  PageTopBarTitle,
} from "@/components/layout/page-top-bar";
import { buttonVariants } from "@/components/ui/button";
import { useMeasuredHeight } from "@/hooks/use-measured-height";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export interface TopBarCrumb {
  label: string;
  link?: ReactElement<{ children?: ReactNode; className?: string; "aria-label"?: string }>;
}

/** Exported so a bar with its own page title can separate a trail without re-deriving the glyph. */
export function TopBarBreadcrumbSeparator({ className }: { className?: string }) {
  return <span className={cn("text-muted-foreground/60", className)}>/</span>;
}

/** On `sm`+ a breadcrumb, on phones a back arrow to the nearest linked parent; an unlinked last segment is the title at every width. */
export function TopBarBreadcrumbTrail({ segments }: { segments: TopBarCrumb[] }) {
  const last = segments.at(-1);
  const title = last && !last.link ? last : null;
  const trail = title ? segments.slice(0, -1) : segments;
  const parent = trail.findLast((segment) => segment.link);
  return (
    <>
      {parent?.link
        ? cloneElement(parent.link, {
            "aria-label": m.layout_breadcrumb_back({ label: parent.label }),
            className: cn(
              buttonVariants({ variant: "ghost", size: "icon-sm" }),
              "-ml-1.5 sm:hidden",
            ),
            children: <ArrowLeftIcon className="size-4" />,
          })
        : null}
      <span className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
        {trail.map((segment, index) => (
          <Fragment key={`${segment.label}:${index}`}>
            {index > 0 ? <TopBarBreadcrumbSeparator /> : null}
            {segment.link ? (
              cloneElement(segment.link, {
                className: "text-muted-foreground hover:text-foreground truncate",
                children: segment.label,
              })
            ) : (
              <span className="truncate font-medium">{segment.label}</span>
            )}
          </Fragment>
        ))}
      </span>
      {title ? (
        <>
          {trail.length > 0 ? <TopBarBreadcrumbSeparator className="hidden sm:inline" /> : null}
          <PageTopBarTitle>{title.label}</PageTopBarTitle>
        </>
      ) : null}
    </>
  );
}

/** With `title`, every segment links; `children` get `--sticky-top` from the bar height. */
export function TopBarBreadcrumbBar({
  segments,
  title,
  actions,
  children,
}: {
  segments: TopBarCrumb[];
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [barEl, setBarEl] = useState<HTMLDivElement | null>(null);
  const barHeight = useMeasuredHeight(barEl);

  const bar = (
    <PageTopBarSticky ref={setBarEl} width="capped">
      <PageTopBar className="gap-2">
        {title === undefined ? (
          <TopBarBreadcrumbTrail segments={segments} />
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:items-baseline">
            <TopBarBreadcrumbTrail segments={segments} />
            <TopBarBreadcrumbSeparator className="hidden sm:inline" />
            <PageTopBarTitle>{title}</PageTopBarTitle>
          </div>
        )}
        {actions ? <PageTopBarActions>{actions}</PageTopBarActions> : null}
      </PageTopBar>
    </PageTopBarSticky>
  );
  if (children === undefined) {
    return bar;
  }
  return (
    <>
      {bar}
      <div
        className="contents"
        style={
          { "--sticky-top": `calc(var(--header-height) + ${barHeight}px + 1rem)` } as CSSProperties
        }
      >
        {children}
      </div>
    </>
  );
}
