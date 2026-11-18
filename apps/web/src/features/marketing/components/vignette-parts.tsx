import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { ClipFrame } from "./clip-frame";

// Vignettes read no data hooks or stores: the landing page must not wait on /init.

export function Vignette({ children, className }: { children: ReactNode; className?: string }) {
  return <ClipFrame className={cn("flex flex-col gap-4 p-5", className)}>{children}</ClipFrame>;
}

export function VignetteHeading({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground text-xs font-medium">{children}</span>;
}

export const FAKE_CONTROL =
  "border-input bg-foreground/5 flex h-(--control-h) w-full min-w-0 items-center rounded-lg border px-2.5 text-base md:text-sm";

/** The `now` layer is the base state, so reduced motion and the server render show the finished miniature. */
export function Swap({
  was,
  now,
  className,
  layerClassName,
  wasAnimation = "motion-safe:animate-vignette-was",
  nowAnimation = "motion-safe:animate-vignette-now",
}: {
  was: ReactNode;
  now: ReactNode;
  className?: string;
  layerClassName?: string;
  wasAnimation?: string;
  nowAnimation?: string;
}) {
  return (
    <span className={cn("inline-grid justify-items-start", className)}>
      <span className={cn("col-start-1 row-start-1 opacity-0", layerClassName, wasAnimation)}>
        {was}
      </span>
      <span className={cn("col-start-1 row-start-1", layerClassName, nowAnimation)}>{now}</span>
    </span>
  );
}

/** Not a real button: the miniatures sit inside a link, so nothing in them may be interactive. */
export function StripGlyph({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground flex size-5 items-center justify-center rounded-md text-xs"
    >
      {children}
    </span>
  );
}
