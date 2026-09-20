import type { ReactNode } from "react";
import { Fragment, useEffect, useState } from "react";

import { Heading } from "@/components/heading";
import { SectionHeading } from "@/components/ui/section-heading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useShowSpecs } from "@/features/admin/components/design/design-specs";
import type { ElementSpec } from "@/hooks/use-element-spec";
import {
  formatSpecLine,
  isTransparentColor,
  observeThemeChanges,
  readElementSpec,
} from "@/hooks/use-element-spec";
import { cn } from "@/lib/utils";

const LABEL_TRACK = "7rem";
const CELL_TRACK = "9rem";

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
        {note && <p className="text-muted-foreground text-sm">{note}</p>}
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
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
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
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
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

function useTargetSpec(target: HTMLElement | null): ElementSpec | null {
  const [spec, setSpec] = useState<ElementSpec | null>(null);

  useEffect(() => {
    const measured = target?.firstElementChild;
    if (!measured) {
      return;
    }
    const measure = () => setSpec(readElementSpec(measured));
    measure();
    return observeThemeChanges(measure);
  }, [target]);

  return spec;
}

export function MeasuredSpecLine({
  label,
  target,
  colors = false,
}: {
  label: string;
  target: HTMLElement | null;
  colors?: boolean;
}) {
  const spec = useTargetSpec(target);

  return (
    <>
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
    </>
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
  const showSpecs = useShowSpecs();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);

  return (
    <div className="flex flex-col justify-end gap-1.5">
      <div className="flex flex-col gap-0.5">
        {showSpecs ? (
          <MeasuredSpecLine label={label} target={target} colors={colors} />
        ) : (
          <p className="font-mono text-xs">{label}</p>
        )}
      </div>
      <div ref={showSpecs ? setTarget : undefined} className="flex items-start">
        {children}
      </div>
    </div>
  );
}

function ColorChip({ value, label }: { value: string; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="border-border inline-block size-3 shrink-0 rounded-sm border"
            style={{ backgroundColor: value }}
          />
        }
      />
      <TooltipContent className="font-mono">{label}</TooltipContent>
    </Tooltip>
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
  const showSpecs = useShowSpecs();

  return (
    <div className={cn("row-span-2 grid min-w-0 grid-rows-subgrid gap-2", className)}>
      <div className="flex flex-col gap-1">
        <p className="font-mono text-sm font-medium">{name}</p>
        <p className="text-muted-foreground text-xs">{hint}</p>
        {showSpecs && spec && <p className="text-muted-foreground text-2xs font-mono">{spec}</p>}
      </div>
      <div className="flex min-w-0 flex-wrap content-start items-center gap-2">{children}</div>
    </div>
  );
}

export function DemoGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-6 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

export function Matrix<S extends { label: string }>({
  label,
  hint,
  states,
  rows,
}: {
  label: string;
  hint: string;
  states: readonly S[];
  rows: readonly { label: string; render: (state: S) => ReactNode }[];
}) {
  return (
    <DemoRow label={label} hint={hint} className="block">
      <div className="overflow-x-auto">
        <div
          className="grid w-max items-center gap-x-4 gap-y-3"
          style={{ gridTemplateColumns: `${LABEL_TRACK} repeat(${states.length}, ${CELL_TRACK})` }}
        >
          <div />
          {states.map((state) => (
            <SectionHeading key={state.label} as="span" size="sm">
              {state.label}
            </SectionHeading>
          ))}
          {rows.map((row) => (
            <Fragment key={row.label}>
              <p className="text-muted-foreground pr-2 font-mono text-xs">{row.label}</p>
              {states.map((state) => (
                <div key={state.label} className="flex items-center">
                  {row.render(state)}
                </div>
              ))}
            </Fragment>
          ))}
        </div>
      </div>
    </DemoRow>
  );
}

export interface Surface {
  name: string;
  background: string;
  color: string;
  borderColor: string;
  spec: string;
}

export function readSurface(element: HTMLElement): Surface {
  const style = globalThis.getComputedStyle(element);
  return {
    name: element.dataset.slot ?? element.tagName.toLowerCase(),
    background: style.backgroundColor,
    color: style.color,
    borderColor: style.borderTopColor,
    spec: formatSpecLine(readElementSpec(element)),
  };
}

export function SurfaceReadout({ surface }: { surface: Surface | null }) {
  return (
    <div className="bg-background/85 no-scrollbar sticky top-(--sticky-top) z-10 flex h-8 items-center gap-x-5 overflow-x-auto rounded-lg px-3 backdrop-blur">
      {surface ? (
        <>
          <p className="shrink-0 font-mono text-xs font-medium whitespace-nowrap">{surface.name}</p>
          <ReadoutValue label="bg" value={surface.background} />
          <ReadoutValue label="text" value={surface.color} />
          <ReadoutValue label="border" value={surface.borderColor} />
          <p className="text-muted-foreground text-2xs shrink-0 font-mono whitespace-nowrap">
            {surface.spec}
          </p>
        </>
      ) : (
        <p className="text-muted-foreground text-xs whitespace-nowrap">
          Hover or focus a sample below to read its settled colors.
        </p>
      )}
    </div>
  );
}

function ReadoutValue({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <ColorChip value={value} label={`${label} ${value}`} />
      <span className="text-muted-foreground text-2xs font-mono whitespace-nowrap">{label}</span>
    </span>
  );
}

function useMeasuredFill(target: HTMLElement | null): string {
  const [background, setBackground] = useState("");

  useEffect(() => {
    if (!target) {
      return;
    }
    const measure = () => setBackground(globalThis.getComputedStyle(target).backgroundColor);
    measure();
    return observeThemeChanges(measure);
  }, [target]);

  return background;
}

export function FillSwatch({ label, className }: { label: string; className: string }) {
  const showSpecs = useShowSpecs();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const background = useMeasuredFill(target);

  const swatch = (
    <div
      ref={showSpecs ? setTarget : undefined}
      className={cn("border-border size-10 rounded-lg border", className)}
    />
  );

  return (
    <div className="flex flex-col gap-1.5">
      {showSpecs ? (
        <Tooltip>
          <TooltipTrigger render={swatch} />
          <TooltipContent className="font-mono">{background || "measuring…"}</TooltipContent>
        </Tooltip>
      ) : (
        swatch
      )}
      <p className="font-mono text-xs">{label}</p>
    </div>
  );
}
