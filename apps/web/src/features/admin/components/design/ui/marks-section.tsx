import {
  FolderIcon,
  HeartIcon,
  LinkIcon,
  PackageIcon,
  TrophyIcon,
  UsersIcon,
  ZapIcon,
} from "lucide-react";
import { siDiscord, siTwitch, siYoutube } from "simple-icons";

import { LanguageChip } from "@/components/language-chip";
import { Badge } from "@/components/ui/badge";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import { Code } from "@/components/ui/code";
import { CountPill } from "@/components/ui/count-pill";
import { CountryFlag } from "@/components/ui/country-flag";
import { DateLeaf } from "@/components/ui/date-leaf";
import { IconChip } from "@/components/ui/icon-chip";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { useLanguageList } from "@/hooks/use-enums";

const BADGE_VARIANTS = [
  "default",
  "secondary",
  "destructive",
  "outline",
  "ghost",
  "link",
  "success",
  "warning",
  "violet",
  "info",
  "muted",
  "subtle",
  "count",
] as const;

const GROUPS = {
  badge: { id: "marks-badge", title: "Badge" },
  countPill: { id: "marks-count-pill", title: "Count pill" },
  iconChip: { id: "marks-icon-chip", title: "Icon chip" },
  brandGlyph: { id: "marks-brand-glyph", title: "Brand glyph" },
  dateLeaf: { id: "marks-date-leaf", title: "Date leaf" },
  countryFlag: { id: "marks-country-flag", title: "Country flag" },
  languageChip: { id: "marks-language-chip", title: "Language chip" },
  code: { id: "marks-code", title: "Code" },
} as const;

export const MARKS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

export function MarksSection() {
  const languages = useLanguageList();

  return (
    <DemoSection
      id="marks"
      title="Marks & chips"
      note="The small static marks that label, count or classify a thing."
    >
      <DemoGroup {...GROUPS.badge}>
        <SwatchRow label="Variants">
          {BADGE_VARIANTS.map((variant) => (
            <Swatch key={variant} label={variant} colors>
              <Badge variant={variant}>{variant}</Badge>
            </Swatch>
          ))}
        </SwatchRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.countPill} hint="All pills share the h-5 tier.">
        <SwatchRow label="Variants">
          <Swatch label="default" colors>
            <CountPill>
              <PackageIcon className="size-3" />
              <span>4</span>
            </CountPill>
          </Swatch>
          <Swatch label="ghost" colors>
            <CountPill variant="ghost">
              <PackageIcon className="size-3" />
              <span>4</span>
            </CountPill>
          </Swatch>
          <Swatch label="primary" colors>
            <CountPill variant="primary">Requested</CountPill>
          </Swatch>
          <Swatch label="success" colors>
            <CountPill variant="success">Reserved</CountPill>
          </Swatch>
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.iconChip}
        hint="The square default size anchors dashboard tiles, and round sm marks feed and rail rows."
      >
        <SwatchRow label="Tones">
          <Swatch label="neutral">
            <IconChip icon={PackageIcon} tone="neutral" />
          </Swatch>
          <Swatch label="primary">
            <IconChip icon={PackageIcon} tone="primary" />
          </Swatch>
          <Swatch label="gold">
            <IconChip icon={ZapIcon} tone="gold" />
          </Swatch>
          <Swatch label="info">
            <IconChip icon={FolderIcon} tone="info" />
          </Swatch>
          <Swatch label="success">
            <IconChip icon={UsersIcon} tone="success" />
          </Swatch>
          <Swatch label="violet">
            <IconChip icon={TrophyIcon} tone="violet" />
          </Swatch>
        </SwatchRow>
        <SwatchRow label="Round small">
          <Swatch label="sm round">
            <IconChip icon={HeartIcon} tone="primary" size="sm" shape="round" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.brandGlyph}
        hint="Inherits the surrounding text color, and falls back to a lucide icon when the brand is unknown."
      >
        <SwatchRow label="Known brands">
          <Swatch label="YouTube">
            <BrandGlyph icon={siYoutube} fallback={LinkIcon} />
          </Swatch>
          <Swatch label="Twitch">
            <BrandGlyph icon={siTwitch} fallback={LinkIcon} />
          </Swatch>
          <Swatch label="Discord">
            <BrandGlyph icon={siDiscord} fallback={LinkIcon} />
          </Swatch>
          <Swatch label="unknown">
            <BrandGlyph fallback={LinkIcon} />
          </Swatch>
        </SwatchRow>
        <SwatchRow label="Sizes">
          <Swatch label="size-3">
            <BrandGlyph icon={siYoutube} fallback={LinkIcon} className="size-3" />
          </Swatch>
          <Swatch label="size-4 (default)">
            <BrandGlyph icon={siYoutube} fallback={LinkIcon} />
          </Swatch>
          <Swatch label="size-6">
            <BrandGlyph icon={siYoutube} fallback={LinkIcon} className="size-6" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.dateLeaf}
        hint="Pass preformatted month and day parts, plus the year on a surface that spans several."
      >
        <SwatchRow label="Sizes">
          <Swatch label="sm">
            <DateLeaf month="JUL" day="13" size="sm" />
          </Swatch>
          <Swatch label="default">
            <DateLeaf month="AUG" day="8" />
          </Swatch>
          <Swatch label="with year">
            <DateLeaf month="AUG" day="8" caption="2026" size="sm" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.countryFlag}
        hint="A code the package ships no flag for falls back to the code plate alone."
      >
        <SwatchRow label="Forms">
          <Swatch label="default">
            <CountryFlag code="de" />
          </Swatch>
          <Swatch label="sm">
            <CountryFlag code="jp" size="sm" />
          </Swatch>
          <Swatch label="no code">
            <CountryFlag code="fr" showCode={false} />
          </Swatch>
          <Swatch label="no flag" colors>
            <CountryFlag code="uk" />
          </Swatch>
        </SwatchRow>
      </DemoGroup>

      <DemoGroup
        {...GROUPS.languageChip}
        hint="Colors are admin-managed in the languages taxonomy, and an unset language falls back to neutral gray."
      >
        <DemoRow label="Printing languages">
          {languages.map((lang) => (
            <LanguageChip key={lang.code} code={lang.code} />
          ))}
        </DemoRow>
      </DemoGroup>

      <DemoGroup {...GROUPS.code}>
        <DemoRow label="In help copy">
          <p className="text-sm">
            Send a <Code>POST</Code> to <Code>/api/v1/ingest/deck-check</Code> with your{" "}
            <Code>orpk_…</Code> key.
          </p>
        </DemoRow>
      </DemoGroup>
    </DemoSection>
  );
}
