import { DEFAULT_DOMAIN_COLORS } from "@openrift/shared/domain-colors";
import { enumLabel } from "@openrift/shared/enum-label";
import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { toggleVariants } from "@/components/ui/toggle";
import {
  FIXTURE_CARD_TYPE_LABELS,
  FIXTURE_DESIGNED_CARD,
  FIXTURE_LABELS,
} from "@/features/marketing/lib/vignette-fixtures";
import { getFilterIconPath } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

import { FAKE_CONTROL, Vignette, VignetteHeading } from "./vignette-parts";

const DOMAINS = ["fury", "calm", "mind", "body", "chaos", "order"] as const;

const CARD = FIXTURE_DESIGNED_CARD;
const PICKED_DOMAIN = CARD.domain;

const ART_FILL = `linear-gradient(135deg, ${DEFAULT_DOMAIN_COLORS[PICKED_DOMAIN]}cc, ${DEFAULT_DOMAIN_COLORS[PICKED_DOMAIN]}80)`;

function ControlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-sm leading-none font-medium">{label}</span>
      {children}
    </div>
  );
}

function DomainToggles() {
  return (
    <span className="flex flex-wrap gap-1">
      {DOMAINS.map((domain) => {
        const icon = getFilterIconPath("domains", domain);
        return (
          <span
            key={domain}
            data-active={domain === PICKED_DOMAIN ? "" : undefined}
            className={toggleVariants({ variant: "outline" })}
          >
            {icon && <img src={icon} alt="" className="size-4 shrink-0" />}
            {enumLabel(FIXTURE_LABELS.domains, domain)}
          </span>
        );
      })}
    </span>
  );
}

function MiniCardPreview() {
  return (
    <span className="aspect-card bg-card-blank relative block w-24 shrink-0 overflow-hidden rounded-lg sm:w-28">
      <span aria-hidden="true" className="absolute inset-0" style={{ backgroundImage: ART_FILL }} />
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[55%] bg-linear-to-t from-black/85 via-black/55 to-transparent"
      />
      <span
        role="img"
        aria-label={m.decks_editor_energy({ value: CARD.energy })}
        className="font-numeric text-2xs absolute top-[5%] left-[6%] flex size-4 items-center justify-center rounded-full bg-white/70 font-semibold text-black ring-1 ring-black/70"
      >
        {CARD.energy}
      </span>
      <span
        role="img"
        aria-label={m.marketing_designer_might_aria({ value: CARD.might })}
        className="font-numeric text-2xs absolute top-[5%] right-[7%] flex h-4 items-stretch overflow-hidden font-semibold"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 13% 100%)" }}
      >
        <span className="flex items-center justify-center bg-white/70 pr-px pl-1">
          {/* brightness-0 is how GlyphIcon flattens a white glyph to black. */}
          <img src="/images/might.svg" alt="" className="size-2.5 brightness-0" />
        </span>
        <span className="flex items-center justify-center bg-black/70 px-1 text-white">
          {CARD.might}
        </span>
      </span>
      <span className="font-display absolute inset-x-0 top-[52%] flex flex-col px-2 tracking-wide text-white">
        <span className="text-xs leading-tight font-semibold">{CARD.name}</span>
        <span className="text-2xs leading-tight uppercase italic">{CARD.epithet}</span>
      </span>
      <span aria-hidden="true" className="absolute inset-x-0 top-[68%] flex flex-col gap-1 px-2">
        <span className="h-1 w-full rounded-full bg-white/25" />
        <span className="h-1 w-4/5 rounded-full bg-white/25" />
        <span className="h-1 w-3/5 rounded-full bg-white/25" />
      </span>
    </span>
  );
}

export function DesignerVignette() {
  return (
    <Vignette>
      <VignetteHeading>{m.designer_form_title()}</VignetteHeading>
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <ControlRow label={m.designer_field_name()}>
            <span className={FAKE_CONTROL}>
              <span className="truncate">
                {CARD.name}, {CARD.epithet}
              </span>
            </span>
          </ControlRow>
          <ControlRow label={m.designer_field_type()}>
            <span className={cn(FAKE_CONTROL, "justify-between gap-2")}>
              <span className="truncate">{enumLabel(FIXTURE_CARD_TYPE_LABELS, CARD.type)}</span>
              <ChevronDownIcon
                className="text-muted-foreground size-4 shrink-0"
                aria-hidden="true"
              />
            </span>
          </ControlRow>
          <ControlRow label={m.designer_field_domains()}>
            <DomainToggles />
          </ControlRow>
          <div className="grid grid-cols-2 gap-3">
            <ControlRow label={m.designer_field_energy()}>
              <span className={cn(FAKE_CONTROL, "tabular-nums")}>{CARD.energy}</span>
            </ControlRow>
            <ControlRow label={m.designer_field_might()}>
              <span className={cn(FAKE_CONTROL, "tabular-nums")}>{CARD.might}</span>
            </ControlRow>
          </div>
        </div>
        <MiniCardPreview />
      </div>
    </Vignette>
  );
}
