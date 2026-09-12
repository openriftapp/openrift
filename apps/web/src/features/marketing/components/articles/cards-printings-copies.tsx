import { imageUrl } from "@openrift/shared/image-url";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Callout } from "@/components/ui/callout";
import { Code } from "@/components/ui/code";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { CardText } from "@/features/cards/components/card-text";
import { cardDetailQueryOptions } from "@/features/cards/hooks/use-card-detail";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

const DIAGRAM_SHORT_CODES = ["OGN-007", "OGN-007a", "SFD-R01b"];

const COPY_COUNTS: Record<string, number> = {
  "OGN-007": 3,
  "OGN-007a": 1,
  "SFD-R01b": 2,
};

function useFuryRuneImages() {
  const { data } = useQuery(cardDetailQueryOptions("fury-rune"));
  const imageByCode = new Map<string, string>();
  if (!data) {
    return imageByCode;
  }
  for (const printing of data.printings) {
    if (DIAGRAM_SHORT_CODES.includes(printing.shortCode) && !imageByCode.has(printing.shortCode)) {
      const id = printing.images[0]?.imageId;
      if (id) {
        imageByCode.set(printing.shortCode, imageUrl(id, "400w"));
      }
    }
  }
  return imageByCode;
}

export default function CardsPrintingsCopiesArticle() {
  const imageByCode = useFuryRuneImages();

  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        {m.help_cards_printings_copies_intro_before()}
        <strong className="text-foreground">{m.help_cards_printings_copies_term_cards()}</strong>
        {m.help_cards_printings_copies_intro_sep()}
        <strong className="text-foreground">
          {m.help_cards_printings_copies_term_printings()}
        </strong>
        {m.help_cards_printings_copies_intro_and()}
        <strong className="text-foreground">{m.help_cards_printings_copies_term_copies()}</strong>.
      </p>

      <Callout>
        <div className="flex flex-col items-center gap-3 text-sm">
          <div className="bg-primary/10 text-primary w-full rounded-md px-4 py-2.5 text-center font-semibold">
            {m.help_cards_printings_copies_diagram_card()}
          </div>
          <Arrow />
          <div className="bg-primary/10 w-full rounded-md p-3">
            <span className="text-primary mb-2 block text-center font-semibold tracking-wide">
              {m.help_cards_printings_copies_view_printings()}
            </span>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PrintingCard
                image={imageByCode.get("OGN-007")}
                code="OGN-007"
                label="Origins · Common · Normal"
              />
              <PrintingCard
                image={imageByCode.get("OGN-007a")}
                code="OGN-007a"
                label="Origins · Showcase · Foil"
              />
              <PrintingCard
                image={imageByCode.get("SFD-R01b")}
                code="SFD-R01b"
                label="Spiritforged · Showcase · Foil"
              />
            </div>
          </div>
          <Arrow />
          <div className="bg-primary/10 w-full rounded-md p-3">
            <span className="text-primary mb-2 block text-center font-semibold tracking-wide">
              {m.help_cards_printings_copies_view_copies()}
            </span>
            <div className="flex justify-center gap-6">
              {DIAGRAM_SHORT_CODES.map((code) => {
                const image = imageByCode.get(code);
                const count = COPY_COUNTS[code] ?? 1;
                return (
                  <div key={code} className="flex flex-col items-center gap-1">
                    <div
                      className="relative"
                      style={{ width: 48 + (count - 1) * 4, height: 68 + (count - 1) * 4 }}
                    >
                      {Array.from({ length: Math.min(count, 3) }, (_, index) => (
                        <div
                          key={index}
                          className="absolute w-12"
                          style={{
                            top: index * 4,
                            left: index * 4,
                            zIndex: index,
                            height: 68,
                          }}
                        >
                          <CardImage
                            src={image}
                            alt={m.help_cards_printings_copies_copy_alt({
                              code,
                              index: index + 1,
                            })}
                            className="h-full w-full shadow-sm"
                          />
                        </div>
                      ))}
                    </div>
                    <span className="text-primary text-xs font-semibold">&times;{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Callout>

      <section>
        <Heading className="mb-2">{m.help_cards_printings_copies_view_cards()}</Heading>
        <p className="text-muted-foreground">
          {m.help_cards_printings_copies_cards_p1_before()}
          <strong className="text-foreground">{m.help_cards_printings_copies_term_card()}</strong>
          {m.help_cards_printings_copies_cards_p1_after()}
        </p>
        <p className="text-muted-foreground mt-2">
          {m.help_cards_printings_copies_cards_p2_before()}
          <TextLink href="/cards">{m.help_cards_printings_copies_browser_link()}</TextLink>
          {m.help_cards_printings_copies_cards_p2_mid()}
          <strong className="text-foreground">{m.help_cards_printings_copies_view_cards()}</strong>
          {m.help_cards_printings_copies_cards_p2_after()}
          <em>{m.help_cards_printings_copies_view_printings()}</em>.
        </p>
        <ExampleTable
          rows={[
            [
              m.help_cards_printings_copies_field_name(),
              <strong key="fury-rune">Fury Rune</strong>,
              <strong key="zero-drive">The Zero Drive</strong>,
              <strong key="master-yi">Master Yi, Unstoppable</strong>,
            ],
            [m.help_cards_printings_copies_field_type(), "Rune", "Gear", "Unit"],
            [m.help_cards_printings_copies_field_supertypes(), "Basic", null, "Champion"],
            [m.help_cards_printings_copies_field_domains(), "Fury", "Mind", "Calm"],
            [m.help_cards_printings_copies_field_might(), null, null, "12"],
            [m.help_cards_printings_copies_field_energy(), null, "3", "12"],
            [m.help_cards_printings_copies_field_power(), null, null, "3"],
            [m.help_cards_printings_copies_field_might_bonus(), null, "2", null],
            [
              m.help_cards_printings_copies_field_keywords(),
              null,
              <CardText key="kw" text="[Equip], [Deathknell]" interactive={false} />,
              null,
            ],
            [
              m.help_cards_printings_copies_field_rules_text(),
              null,
              <CardText
                key="rules"
                text="[Equip] :rb_energy_1::rb_rune_mind: _(:rb_energy_1::rb_rune_mind:: Attach this to a unit you control.)_\n:rb_energy_3::rb_rune_mind:, Banish this: Play all units banished with this, ignoring their costs. _(Use only if unattached.)_"
                interactive={false}
              />,
              null,
            ],
            [
              m.help_cards_printings_copies_field_effect_text(),
              null,
              <CardText
                key="effect"
                text="[Deathknell] — Banish me. _(When I die, get the effect.)_"
                interactive={false}
              />,
              null,
            ],
          ]}
        />
      </section>

      <section>
        <Heading className="mb-2">{m.help_cards_printings_copies_view_printings()}</Heading>
        <p className="text-muted-foreground">
          {m.help_cards_printings_copies_printings_p1_before()}
          <strong className="text-foreground">
            {m.help_cards_printings_copies_term_printing()}
          </strong>
          {m.help_cards_printings_copies_printings_p1_after()}
        </p>
        <p className="text-muted-foreground mt-2">
          {m.help_cards_printings_copies_printings_p2_before()}
          <Code>SFD-R01b</Code>
          {m.help_cards_printings_copies_printings_p2_after()}
        </p>
        <p className="text-muted-foreground mt-2">{m.help_cards_printings_copies_printings_p3()}</p>
        <p className="text-muted-foreground mt-2">
          {m.help_cards_printings_copies_printings_p4_before()}
          <TextLink href="/cards">{m.help_cards_printings_copies_browser_link()}</TextLink>
          {m.help_cards_printings_copies_printings_p4_mid()}
          <strong className="text-foreground">
            {m.help_cards_printings_copies_view_printings()}
          </strong>
          {m.help_cards_printings_copies_printings_p4_after()}
        </p>
        <ExampleTable
          rows={[
            [m.help_cards_printings_copies_field_code(), "OGN-007", "OGN-007a", "SFD-R01b"],
            [m.help_cards_printings_copies_field_set(), "Origins", "Origins", "Spiritforged"],
            [m.help_cards_printings_copies_field_rarity(), "Common", "Showcase", "Showcase"],
            [m.help_cards_printings_copies_field_finish(), "Normal", "Foil", "Foil"],
            [m.help_cards_printings_copies_field_art_variant(), "Normal", "Alt Art", "Alt Art"],
            [
              m.help_cards_printings_copies_field_is_signed(),
              m.help_cards_printings_copies_value_no(),
              m.help_cards_printings_copies_value_no(),
              m.help_cards_printings_copies_value_no(),
            ],
            [
              m.help_cards_printings_copies_field_artist(),
              "Greg Ghielmetti & Leah Chen",
              "Fairfoul",
              "华锐",
            ],
            [m.help_cards_printings_copies_field_promo_type(), null, null, "Promo"],
            [m.help_cards_printings_copies_field_printed_rules_text(), null, null, null],
            [m.help_cards_printings_copies_field_printed_effect_text(), null, null, null],
            [m.help_cards_printings_copies_field_flavor_text(), null, null, null],
          ]}
        />
      </section>

      <section>
        <Heading className="mb-2">{m.help_cards_printings_copies_view_copies()}</Heading>
        <p className="text-muted-foreground">
          {m.help_cards_printings_copies_copies_p1_before()}
          <strong className="text-foreground">{m.help_cards_printings_copies_term_copy()}</strong>
          {m.help_cards_printings_copies_copies_p1_after()}
        </p>
        <p className="text-muted-foreground mt-2">
          {m.help_cards_printings_copies_copies_p2_before()}
          <TextLink href="/collections">{m.help_cards_printings_copies_collection_link()}</TextLink>
          {m.help_cards_printings_copies_copies_p2_mid()}
          <strong className="text-foreground">{m.help_cards_printings_copies_view_copies()}</strong>
          {m.help_cards_printings_copies_copies_p2_after()}
          <strong className="text-foreground">&times;3</strong>
          {m.help_cards_printings_copies_copies_p2_end()}
        </p>
        <ExampleTable
          rows={[
            [
              m.help_cards_printings_copies_field_printing(),
              "OGN-007 · Common · Normal",
              "OGN-007 · Common · Normal",
              "OGN-007a · Showcase · Foil",
            ],
            [m.help_cards_printings_copies_field_collection(), "Main", "Main", "Main"],
            [
              <span key="condition">
                {m.help_cards_printings_copies_field_condition()}{" "}
                <span className="text-muted-foreground/60 italic">
                  {m.help_cards_printings_copies_field_condition_planned()}
                </span>
              </span>,
              "Near Mint",
              "Played",
              "Near Mint",
            ],
          ]}
        />
      </section>
    </div>
  );
}

function PrintingCard({ image, code, label }: { image?: string; code: string; label: string }) {
  return (
    <div className="bg-background flex flex-1 items-center gap-2 rounded-md border px-3 py-2">
      <CardImage src={image} alt={`Fury Rune ${code}`} className="h-14 w-10" />
      <div>
        <span className="font-medium">{code}</span>
        <span className="text-muted-foreground block">{label}</span>
      </div>
    </div>
  );
}

function CardImage({ src, alt, className }: { src?: string; alt: string; className: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showSkeleton = !src || errored || !loaded;
  return (
    <div className={cn("relative overflow-hidden rounded-md", className)}>
      {showSkeleton && <Skeleton className="absolute inset-0" aria-hidden="true" />}
      {src && !errored && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity",
            loaded ? "opacity-100" : "opacity-0",
          )}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}

function Arrow() {
  return (
    <div className="text-muted-foreground flex flex-col items-center text-xs">
      <div className="bg-border h-4 w-px" />
      <div className="text-muted-foreground/60">&#9660;</div>
    </div>
  );
}

function ExampleTable({ rows }: { rows: React.ReactNode[][] }) {
  return (
    <div className="mt-3">
      <Table>
        <TableBody>
          {rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  className={cn(
                    "align-top",
                    cellIndex === 0
                      ? "font-medium"
                      : "text-muted-foreground min-w-32 whitespace-normal",
                  )}
                >
                  {cell === null ? "—" : cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
