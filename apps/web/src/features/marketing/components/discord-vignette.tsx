import { discordEmbedColorHex } from "@openrift/shared/discord-embed";
import { MARKETPLACE_LINKS } from "@openrift/shared/marketplace";
import { ALL_MARKETPLACES } from "@openrift/shared/types/pricing";
import { BotIcon } from "lucide-react";
import { siDiscord } from "simple-icons";

import { Badge } from "@/components/ui/badge";
import { BrandGlyph } from "@/components/ui/brand-glyph";
import type { LandingThumbnailCard } from "@/features/marketing/lib/landing-thumbnails";
import {
  FIXTURE_BOT,
  FIXTURE_CARDS,
  FIXTURE_GROUPS,
  FIXTURE_PRICES,
} from "@/features/marketing/lib/vignette-fixtures";
import { formatterForMarketplace } from "@/lib/format";

import { Vignette } from "./vignette-parts";

const EMBED_ACCENT = discordEmbedColorHex();

// Fallback for when the daily-cached sample predates the art-identity fields.
const UNNAMED = FIXTURE_CARDS.yasuo;

function EmbedField({ name, value }: { name: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-semibold">{name}</span>
      <span className="text-primary text-sm tabular-nums">{value}</span>
    </div>
  );
}

export function DiscordVignette({ card }: { card?: LandingThumbnailCard }) {
  const named = card?.name ? card : undefined;
  const name = named?.name ?? UNNAMED.name;
  const shortCode = named?.shortCode ?? UNNAMED.shortCode;
  const reference = `[[${name}]]`;
  const footer = [shortCode, named?.variantLabel].filter(Boolean).join(" · ");
  return (
    <Vignette>
      <div className="flex gap-3">
        <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
          {FIXTURE_BOT.askingUser.charAt(0).toUpperCase()}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{FIXTURE_BOT.askingUser}</span>
          <p className="text-primary text-sm font-medium">
            <span
              className="motion-safe:animate-vignette-type inline-block"
              style={{ animationTimingFunction: `steps(${reference.length}, end)` }}
            >
              {reference}
            </span>
          </p>
        </div>
      </div>
      <div className="motion-safe:animate-vignette-reply flex gap-3">
        <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
          <BrandGlyph icon={siDiscord} fallback={BotIcon} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{FIXTURE_BOT.botName}</span>
            <Badge variant="subtle">{FIXTURE_BOT.botBadge}</Badge>
          </div>
          <div
            className="bg-background/40 flex flex-col gap-2.5 rounded-md border-l-4 px-3 py-2.5"
            style={{ borderLeftColor: EMBED_ACCENT }}
          >
            <span className="text-primary font-medium">{name}</span>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold">
                {FIXTURE_BOT.tradelistsHeader(FIXTURE_GROUPS.storeCrew)}
              </span>
              {FIXTURE_BOT.holders(shortCode).map((holder) => (
                <div key={holder.name} className="flex flex-col">
                  <span className="text-sm">
                    {holder.name} · {holder.quantity}×
                  </span>
                  <span className="text-muted-foreground text-xs">{holder.detail}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {ALL_MARKETPLACES.map((marketplace) => (
                <EmbedField
                  key={marketplace}
                  name={MARKETPLACE_LINKS[marketplace].label}
                  value={formatterForMarketplace(marketplace)(FIXTURE_PRICES[marketplace].price)}
                />
              ))}
            </div>
            {named && (
              <img
                src={named.url}
                alt=""
                loading="lazy"
                draggable={false}
                className="aspect-[16/9] w-full rounded-md object-cover object-top"
              />
            )}
            <span className="text-muted-foreground text-xs">{footer}</span>
          </div>
          <div className="bg-muted text-muted-foreground w-fit rounded-md px-3 py-1 text-xs font-medium">
            {FIXTURE_BOT.detailsButton}
          </div>
        </div>
      </div>
    </Vignette>
  );
}
