import type { ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DemoGroup,
  DemoRow,
  DemoSection,
  Swatch,
  SwatchRow,
} from "@/features/admin/components/design/demo-primitives";
import type { DesignGroup } from "@/features/admin/components/design/design-sections";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { useCssVars } from "@/hooks/use-css-vars";
import { cn } from "@/lib/utils";

const COLOR_PAIRS = [
  { token: "--background", fg: "var(--foreground)" },
  { token: "--card", fg: "var(--card-foreground)" },
  { token: "--popover", fg: "var(--popover-foreground)" },
  { token: "--primary", fg: "var(--primary-foreground)" },
  { token: "--secondary", fg: "var(--secondary-foreground)" },
  { token: "--muted", fg: "var(--muted-foreground)" },
  { token: "--accent", fg: "var(--accent-foreground)" },
  // Buttons put white text on the destructive fill; there is no
  // --destructive-foreground in this theme.
  { token: "--destructive", fg: "white" },
] as const;

const STATUS_COLOR_PAIRS = [
  { token: "--success", fg: "var(--success-foreground)" },
  { token: "--warning", fg: "var(--warning-foreground)" },
  { token: "--info", fg: "var(--info-foreground)" },
  { token: "--violet", fg: "var(--background)" },
  { token: "--success-soft", fg: "var(--success)" },
  { token: "--warning-soft", fg: "var(--warning)" },
  { token: "--info-soft", fg: "var(--info)" },
  { token: "--violet-soft", fg: "var(--violet)" },
  { token: "--destructive-soft", fg: "var(--destructive)" },
] as const;

const LINE_COLOR_TOKENS = ["--border", "--border-accent", "--input", "--ring"] as const;

const CARD_ART_TOKENS = ["--card-edge", "--gilt"] as const;

const CHART_COLOR_TOKENS = [
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
] as const;

const TOKEN_NAMES = [
  ...COLOR_PAIRS.map((pair) => pair.token),
  ...STATUS_COLOR_PAIRS.map((pair) => pair.token),
  ...LINE_COLOR_TOKENS,
  ...CARD_ART_TOKENS,
  ...CHART_COLOR_TOKENS,
];

// Literal class names so Tailwind's scanner generates them.
const RADIUS_ROLES = [
  { cls: "rounded-none", note: "corner-cut fills" },
  { cls: "rounded-sm", note: "small marks" },
  { cls: "rounded-md", note: "compact controls" },
  { cls: "rounded-lg", note: "default controls, surfaces" },
  { cls: "rounded-xl", note: "card art" },
  { cls: "rounded-full", note: "pills, avatars" },
] as const;

const HEIGHT_TIERS = [
  { cls: "h-5", note: "count pills, chips" },
  { cls: "h-6", note: "xs buttons" },
  { cls: "h-7", note: "sm buttons" },
  { cls: "h-8", note: "default controls" },
  { cls: "h-9", note: "lg buttons" },
  { cls: "h-14", note: "global header" },
] as const;

const GROUPS = {
  colors: { id: "tokens-colors", title: "Colors" },
  radius: { id: "tokens-radius", title: "Radius" },
  heights: { id: "tokens-heights", title: "Heights" },
} as const;

export const DESIGN_TOKENS_GROUPS: readonly DesignGroup[] = Object.values(GROUPS);

function TokenTile({
  token,
  value,
  children,
}: {
  token: string;
  value?: string;
  children: ReactNode;
}) {
  const { copy } = useCopyToClipboard();

  async function handleCopy() {
    if (await copy(`var(${token})`)) {
      toast.success(`Copied var(${token})`);
    } else {
      toast.error("Could not copy the token");
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Pressable
            className="flex min-w-0 flex-col gap-1 text-left"
            onClick={() => void handleCopy()}
          />
        }
      >
        {children}
        <span className="truncate font-mono text-xs">{token.slice(2)}</span>
      </TooltipTrigger>
      <TooltipContent className="font-mono">{value ?? "…"}</TooltipContent>
    </Tooltip>
  );
}

function ColorTokenTile({ token, fg, value }: { token: string; fg?: string; value?: string }) {
  return (
    <TokenTile token={token} value={value}>
      <span
        className="border-border flex h-12 items-center justify-center rounded-md border text-sm"
        style={{ backgroundColor: `var(${token})`, color: fg }}
      >
        {fg ? "Aa" : null}
      </span>
    </TokenTile>
  );
}

function LineTokenTile({ token, value, ring }: { token: string; value?: string; ring?: boolean }) {
  return (
    <TokenTile token={token} value={value}>
      <span
        className="flex h-12 rounded-md"
        style={
          ring ? { boxShadow: `0 0 0 2px var(${token})` } : { border: `1px solid var(${token})` }
        }
      />
    </TokenTile>
  );
}

export function TokensSection() {
  const values = useCssVars(TOKEN_NAMES);

  return (
    <DemoSection
      id="tokens"
      title="Tokens"
      note="The color, radius and height vocabulary every component names, read live from the rendered page."
      docs="apps/web/src/index.css · docs/design-language.md"
    >
      <DemoGroup {...GROUPS.colors} hint="Click a tile to copy its var().">
        <DemoRow label="Color pairs">
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
            {COLOR_PAIRS.map((pair) => (
              <ColorTokenTile
                key={pair.token}
                token={pair.token}
                fg={pair.fg}
                value={values[pair.token]}
              />
            ))}
          </div>
        </DemoRow>
        <DemoRow label="Status" hint="Use these for state, never a raw Tailwind hue.">
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-9">
            {STATUS_COLOR_PAIRS.map((pair) => (
              <ColorTokenTile
                key={pair.token}
                token={pair.token}
                fg={pair.fg}
                value={values[pair.token]}
              />
            ))}
          </div>
        </DemoRow>
        <DemoRow label="Lines & focus">
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
            {LINE_COLOR_TOKENS.map((token) => (
              <LineTokenTile
                key={token}
                token={token}
                value={values[token]}
                ring={token === "--ring"}
              />
            ))}
          </div>
        </DemoRow>
        <DemoRow label="Card art" hint="Edges and marks drawn on top of card images.">
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
            <LineTokenTile token="--card-edge" value={values["--card-edge"]} />
            <ColorTokenTile token="--gilt" value={values["--gilt"]} />
          </div>
        </DemoRow>
        <DemoRow label="Charts">
          <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-5">
            {CHART_COLOR_TOKENS.map((token) => (
              <ColorTokenTile key={token} token={token} value={values[token]} />
            ))}
          </div>
        </DemoRow>
      </DemoGroup>
      <DemoGroup {...GROUPS.radius}>
        <SwatchRow
          label="Radius roles"
          hint="Each step has one job, derived from --radius, 0.375rem. Tailwind's larger steps are not part of the vocabulary."
        >
          {RADIUS_ROLES.map(({ cls, note }) => (
            <Swatch key={cls} label={`${cls} · ${note}`}>
              <div className={cn("bg-muted border-border-accent size-12 border", cls)} />
            </Swatch>
          ))}
        </SwatchRow>
        <SwatchRow
          label="Corner cut"
          hint="Filled buttons swap border-radius for the clip-path cut: --btn-cut is 8px, 5px on xs and sm."
        >
          <Swatch label="btn-corner-cut" colors>
            <Button>Primary</Button>
          </Swatch>
          <Swatch label="--btn-cut: 5px" colors>
            <Button size="sm">Compact</Button>
          </Swatch>
        </SwatchRow>
      </DemoGroup>
      <DemoGroup {...GROUPS.heights}>
        <SwatchRow
          label="Height ladder"
          hint="Boxed controls in one row share a tier. h-8 is the default control height."
        >
          {HEIGHT_TIERS.map(({ cls, note }) => (
            <Swatch key={cls} label={`${cls} · ${note}`}>
              <div className={cn("bg-muted border-border w-14 rounded-md border", cls)} />
            </Swatch>
          ))}
        </SwatchRow>
      </DemoGroup>
    </DemoSection>
  );
}
