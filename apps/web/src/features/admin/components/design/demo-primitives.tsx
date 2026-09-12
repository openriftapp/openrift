import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatSpecLine, isTransparentColor, useElementSpec } from "@/hooks/use-element-spec";
import { cn } from "@/lib/utils";

export function DemoSection({
  id,
  title,
  note,
  docs,
  children,
}: {
  id: string;
  title: string;
  note?: string;
  docs?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-(--sticky-top)">
      <div className="mb-6 flex flex-col gap-1">
        <Heading level={2}>{title}</Heading>
        {note && <p className="text-muted-foreground max-w-prose text-sm">{note}</p>}
        {docs && <p className="text-muted-foreground text-2xs font-mono">→ {docs}</p>}
      </div>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

export function DemoGroup({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="scroll-mt-(--sticky-top)">
      <div className="mb-4 flex flex-col gap-1">
        <Heading level={3}>{title}</Heading>
        {hint && <p className="text-muted-foreground max-w-prose text-xs">{hint}</p>}
      </div>
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}

export function DemoRow({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <SectionHeading as="span">{label}</SectionHeading>
        {hint && <p className="text-muted-foreground max-w-prose text-xs">{hint}</p>}
      </div>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
    </div>
  );
}

export function SwatchRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <DemoRow label={label} hint={hint} className="items-end gap-x-5 gap-y-4">
      {children}
    </DemoRow>
  );
}

export function Swatch({
  label,
  colors = false,
  children,
}: {
  label: string;
  colors?: boolean;
  children: ReactNode;
}) {
  const { ref, spec } = useElementSpec<HTMLDivElement>();
  return (
    <div className="flex flex-col justify-end gap-1.5">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <p className="font-mono text-xs">{label}</p>
          {colors && spec && (
            <span className="flex items-center gap-1">
              {!isTransparentColor(spec.background) && (
                <ColorChip value={spec.background} label={`bg ${spec.background}`} />
              )}
              <ColorChip value={spec.color} label={`text ${spec.color}`} />
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-2xs font-mono">
          {spec ? formatSpecLine(spec) : "measuring…"}
        </p>
      </div>
      <div ref={ref} className="flex items-start">
        {children}
      </div>
    </div>
  );
}

function ColorChip({ value, label }: { value: string; label: string }) {
  return (
    <span
      title={label}
      className="border-border-opaque inline-block size-3 shrink-0 rounded-sm border"
      style={{ backgroundColor: value }}
    />
  );
}

export function Demo({
  name,
  hint,
  spec,
  children,
  className,
}: {
  name: string;
  hint: string;
  spec?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("row-span-2 grid min-w-0 grid-rows-subgrid gap-2", className)}>
      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
        {spec && <p className="text-muted-foreground text-2xs font-mono">{spec}</p>}
      </div>
      <div className="flex min-w-0 flex-wrap content-start items-center gap-2">{children}</div>
    </div>
  );
}

export function DemoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
