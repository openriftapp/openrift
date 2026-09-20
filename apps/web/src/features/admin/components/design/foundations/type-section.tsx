import { BellIcon, HeartIcon } from "lucide-react";
import { useState } from "react";

import { SectionHeading } from "@/components/ui/section-heading";
import { TextLink } from "@/components/ui/text-link";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  MeasuredSpecLine,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { useShowSpecs } from "@/features/admin/components/design/design-specs";
import { cn } from "@/lib/utils";

const TYPE_TIERS: readonly { role: string; cls: string; note?: string }[] = [
  { role: "Hero", cls: "text-4xl font-bold", note: "landing only, md:text-5xl" },
  { role: "Page title (h1)", cls: "font-heading text-2xl font-bold" },
  { role: "Section (h2)", cls: "font-heading text-lg font-semibold" },
  { role: "Subsection / card title (h3)", cls: "text-base font-medium" },
  { role: "Body", cls: "", note: "responsive: 1.05rem phone, 15px from sm:" },
  { role: "Compact UI", cls: "text-sm" },
  { role: "Metadata", cls: "text-xs" },
  { role: "Micro", cls: "text-2xs" },
];

const GROUPS = {
  scale: { id: "type-scale", title: "Scale" },
  headings: { id: "type-headings", title: "Headings" },
  links: { id: "type-links", title: "Links" },
} as const;

export const DESIGN_TYPE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

function TypeSpecimen({ role, cls, note }: { role: string; cls: string; note?: string }) {
  const showSpecs = useShowSpecs();
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const label = cls === "" ? "(no size class)" : cls;

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <div ref={showSpecs ? setTarget : undefined} className="min-w-0">
        <p className={cn("truncate", cls)}>Summoner Skirmish</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="text-muted-foreground text-xs">{note ? `${role} · ${note}` : role}</span>
        {showSpecs ? (
          <MeasuredSpecLine label={label} target={target} />
        ) : (
          <p className="font-mono text-xs">{label}</p>
        )}
      </div>
    </div>
  );
}

export function TypeSection() {
  return (
    <DemoSection
      id="type"
      title="Type & text"
      note="The fixed type scale and the two primitives that set text on it, SectionHeading and TextLink."
      docs="docs/typography.md"
    >
      <DemoGroup
        {...GROUPS.scale}
        hint="Pick a tier from docs/typography.md, never invent a size. Only h1 and h2 carry font-heading."
      >
        <div className="flex w-full flex-col gap-4">
          {TYPE_TIERS.map((tier) => (
            <TypeSpecimen key={tier.role} role={tier.role} cls={tier.cls} note={tier.note} />
          ))}
        </div>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.headings}
        hint="A label above a list is SectionHeading, never a hand-typed uppercase span."
      >
        <DemoRow label="Default">
          <div className="w-full space-y-4">
            <SectionHeading>Cards in collection</SectionHeading>
            <SectionHeading count={12}>Cards with prices</SectionHeading>
          </div>
        </DemoRow>
        <DemoRow label="Display variant">
          <div className="w-full space-y-4">
            <SectionHeading variant="display">Also coming up</SectionHeading>
            <SectionHeading variant="display" count={7}>
              Past events
            </SectionHeading>
          </div>
        </DemoRow>
        <DemoRow label="Small size">
          <div className="w-full space-y-3">
            <SectionHeading size="sm">Yesterday</SectionHeading>
            <SectionHeading size="sm" count={3}>
              Today
            </SectionHeading>
          </div>
        </DemoRow>
        <DemoRow label="With icon chip">
          <div className="w-full space-y-3">
            <SectionHeading icon={BellIcon} tone="gold" count={2}>
              Action needed
            </SectionHeading>
            <SectionHeading icon={HeartIcon} tone="info" count={5}>
              Wishlists &amp; tradelists
            </SectionHeading>
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.links}
        hint="A link that needs a box is a Button with variant=link, never a TextLink."
      >
        <DemoRow label="Variants" className="block space-y-2">
          <p>
            Read the <TextLink href="#type-links">tournament rules</TextLink> before the Summoner
            Skirmish.
          </p>
          <p className="text-muted-foreground text-sm">
            Hosting costs are covered by{" "}
            <TextLink variant="muted" href="#type-links">
              supporters
            </TextLink>
            .
          </p>
          <p className="font-medium">
            <TextLink variant="inherit" href="#type-links">
              Jinx, Loose Cannon
            </TextLink>
          </p>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
