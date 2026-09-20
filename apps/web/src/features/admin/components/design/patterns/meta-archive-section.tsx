import { useState } from "react";

import {
  Demo,
  DemoGrid,
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { MetaIdentity } from "@/features/meta/components/meta-identity";
import { MetaScopeBar } from "@/features/meta/components/meta-scope-bar";
import { MetaTierBadge } from "@/features/meta/components/meta-tier-badge";
import { useMetaEras } from "@/features/meta/hooks/use-meta-eras";
import { formatRecord } from "@/features/meta/lib/meta-format";
import type { MetaScope } from "@/features/meta/lib/meta-scope";

const GROUPS = {
  tierBadge: { id: "meta-archive-tier-badge", title: "MetaTierBadge" },
  identity: { id: "meta-archive-identity", title: "MetaIdentity" },
  scopeBar: { id: "meta-archive-scope-bar", title: "MetaScopeBar" },
  record: { id: "meta-archive-record", title: "formatRecord" },
} as const;

export const META_ARCHIVE_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

const DEMO_LEGEND = "Lux, Lady of Luminosity";

export function MetaArchiveSection() {
  const [scope, setScope] = useState<MetaScope>({});
  const eras = useMetaEras();

  return (
    <DemoSection
      id="meta-archive"
      title="Meta archive"
      note="The identity pieces every /meta surface composes instead of rolling its own."
      docs="features/meta/components/"
    >
      <DemoGroup
        {...GROUPS.tierBadge}
        hint="Gold is the archive's colour for winning, so only Premier carries the accent hairline."
      >
        <SwatchRow label="Tiers">
          {(["premier", "competitive", "local"] as const).map((tier) => (
            <Swatch key={tier} label={tier} colors>
              <MetaTierBadge tier={tier} />
            </Swatch>
          ))}
        </SwatchRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.identity}
        hint="The legend card title always renders, and the compact top-8 bracket is the one surface allowed to drop it."
      >
        <DemoGrid>
          <Demo name="row" hint="Bylines and headers.">
            <MetaIdentity name={DEMO_LEGEND} domains={["order", "calm"]} />
          </Demo>
          <Demo name="stacked" hint="Two-line table cell.">
            <MetaIdentity name={DEMO_LEGEND} domains={["order", "calm"]} layout="stacked" />
          </Demo>
          <Demo name="tile" hint="Deck tiles and winner cards.">
            <MetaIdentity name={DEMO_LEGEND} domains={["order", "calm"]} layout="tile" />
          </Demo>
          <Demo name="championOnly" hint="The compact bracket, and nowhere else.">
            <MetaIdentity name={DEMO_LEGEND} championOnly />
          </Demo>
          <Demo
            name="linked"
            hint="Links the champion at its card page. Omit the slug inside a wrapper that is itself a link."
          >
            <MetaIdentity name={DEMO_LEGEND} slug="lady-of-luminosity" />
          </Demo>
          <Demo name="untagged" hint="A legend with no champion is all champion.">
            <MetaIdentity name="Emperor of the Sands" />
          </Demo>
        </DemoGrid>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.scopeBar}
        hint="The bar is controlled, and the country select only appears once there is more than one to choose between."
      >
        <DemoRow label="Era, format, tier, country" className="flex-col items-stretch gap-3">
          <MetaScopeBar
            scope={scope}
            setScope={(patch) => setScope((prev) => ({ ...prev, ...patch }))}
            clearScope={() => setScope({})}
            eras={eras}
            countries={["de", "jp", "us"]}
          />
          <p className="text-muted-foreground text-2xs font-mono">{JSON.stringify(scope)}</p>
        </DemoRow>
      </DemoGroup>
      <DemoGroup
        {...GROUPS.record}
        hint="A record always renders all three parts, so a column never mixes 5-1 with 5-1-0."
      >
        <DemoRow label="Records">
          <span className="font-heading tabular-nums">{formatRecord(14, 1, 0)}</span>
          <span className="font-heading tabular-nums">{formatRecord(5, 1, null)}</span>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
