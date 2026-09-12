import { Heading } from "@/components/heading";
import { Badge } from "@/components/ui/badge";
import { RowList } from "@/components/ui/row-list";
import { keywordAnchorSlug } from "@/features/rules/lib/glossary";
import type { KeywordRow } from "@/features/rules/lib/glossary-content";
import {
  CARD_TYPE_RULES,
  DOMAIN_RULES,
  glossarySymbols,
  supertypeEntries,
} from "@/features/rules/lib/glossary-content";
import { matches } from "@/features/rules/lib/glossary-search";
import { getFilterIconPath } from "@/lib/icons";
import { m } from "@/paraglide/messages.js";

import {
  GlossarySectionHeading,
  GlossaryTermRow,
  GlossaryTermTile,
  RuleRef,
} from "./glossary-shared";

export function DomainsSection({
  domains,
  query,
}: {
  domains: { slug: string; label: string; color?: string | null }[];
  query: string;
}) {
  const visible = domains.filter((domain) => matches(query, domain.label, domain.slug));
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="domains" title={m.glossary_section_domains()} />
      <p className="text-muted-foreground mt-2">{m.glossary_domains_intro()}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((domain) => {
          const slug = domain.slug.toLowerCase();
          const hasIcon = slug !== "colorless";
          const domainIcon = getFilterIconPath("domains", domain.slug);
          const ruleNumber = DOMAIN_RULES[slug];
          return (
            <GlossaryTermTile key={domain.slug} className="flex-row items-center gap-3">
              {hasIcon && domainIcon && (
                <img
                  src={domainIcon}
                  alt={domain.label}
                  width={40}
                  height={40}
                  className="size-10 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="font-medium" style={domain.color ? { color: domain.color } : {}}>
                    {domain.label}
                  </div>
                  {ruleNumber && <RuleRef ruleNumber={ruleNumber} />}
                </div>
                {hasIcon && (
                  <img
                    src={`/images/glyphs/rune-${slug}.svg`}
                    alt={m.glossary_domain_rune_alt({ domain: domain.label })}
                    title={m.glossary_domain_rune_glyph_title({ domain: domain.label })}
                    width={20}
                    height={20}
                    className="mt-1 size-5"
                  />
                )}
              </div>
            </GlossaryTermTile>
          );
        })}
      </ul>
    </section>
  );
}

export function CardTypesSection({
  types,
  query,
}: {
  types: { slug: string; label: string }[];
  query: string;
}) {
  const visible = types.filter((cardType) => matches(query, cardType.label, cardType.slug));
  const visibleSupertypes = supertypeEntries().filter((supertype) =>
    matches(query, supertype.label, supertype.slug, supertype.description),
  );
  if (visible.length === 0 && visibleSupertypes.length === 0) {
    return null;
  }
  const knownIcons = new Set(["battlefield", "gear", "legend", "rune", "spell", "unit"]);
  return (
    <section>
      <GlossarySectionHeading id="card-types" title={m.glossary_section_card_types()} />
      {visible.length > 0 && (
        <>
          <p className="text-muted-foreground mt-2">{m.glossary_card_types_intro()}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((cardType) => {
              const slug = cardType.slug.toLowerCase();
              const hasIcon = knownIcons.has(slug);
              const typeIcon = getFilterIconPath("types", cardType.slug);
              const ruleNumber = CARD_TYPE_RULES[slug];
              return (
                <GlossaryTermTile key={cardType.slug} className="flex-row items-center gap-3">
                  {hasIcon && typeIcon && (
                    <img
                      src={typeIcon}
                      alt={cardType.label}
                      width={32}
                      height={32}
                      className="size-8 shrink-0 brightness-0 dark:invert"
                    />
                  )}
                  <div className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span className="font-medium">{cardType.label}</span>
                    {ruleNumber && <RuleRef ruleNumber={ruleNumber} />}
                  </div>
                </GlossaryTermTile>
              );
            })}
          </ul>
        </>
      )}
      {visibleSupertypes.length > 0 && (
        <>
          <Heading level={3} as="h4" className="mt-6">
            {m.glossary_supertypes_heading()}
          </Heading>
          <p className="text-muted-foreground mt-1">{m.glossary_supertypes_intro()}</p>
          <RowList className="mt-3">
            {visibleSupertypes.map((supertype) => {
              const supertypeIcon = getFilterIconPath("superTypes", supertype.slug);
              return (
                <GlossaryTermRow
                  key={supertype.slug}
                  term={
                    <>
                      {supertypeIcon && (
                        <img
                          src={supertypeIcon}
                          alt=""
                          width={20}
                          height={20}
                          className="size-5 shrink-0 brightness-0 dark:invert"
                        />
                      )}
                      {supertype.label}
                    </>
                  }
                >
                  <p className="text-muted-foreground flex-1">{supertype.description}</p>
                  <RuleRef ruleNumber={supertype.ruleNumber} className="shrink-0" />
                </GlossaryTermRow>
              );
            })}
          </RowList>
        </>
      )}
    </section>
  );
}

function KeywordPill({
  name,
  color,
  darkText,
}: {
  name: string;
  color?: string | null;
  darkText?: boolean;
}) {
  return (
    <Badge
      style={
        color
          ? {
              backgroundColor: color,
              color: darkText ? "#1a1a1a" : "#ffffff",
            }
          : undefined
      }
      variant={color ? "default" : "secondary"}
    >
      {name}
    </Badge>
  );
}

export function KeywordsSection({ keywords, query }: { keywords: KeywordRow[]; query: string }) {
  const visible = keywords.filter((kw) =>
    matches(query, kw.name, kw.info?.summary, kw.info?.ruleNumber),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="keywords" title={m.glossary_section_keywords()} />
      <p className="text-muted-foreground mt-2">{m.glossary_keywords_intro()}</p>
      <ul className="mt-4 grid gap-3 lg:grid-cols-2">
        {visible.map((kw) => (
          <GlossaryTermTile id={keywordAnchorSlug(kw.name)} key={kw.name} className="gap-2">
            <div className="flex items-center justify-between gap-3">
              <KeywordPill name={kw.name} color={kw.color} darkText={kw.darkText} />
              {kw.info?.ruleNumber && <RuleRef ruleNumber={kw.info.ruleNumber} />}
            </div>
            {kw.info?.summary ? (
              <p className="text-muted-foreground">{kw.info.summary}</p>
            ) : (
              <p className="text-muted-foreground italic">{m.glossary_keyword_no_summary()}</p>
            )}
          </GlossaryTermTile>
        ))}
      </ul>
    </section>
  );
}

export function SymbolsSection({ query }: { query: string }) {
  const visible = glossarySymbols().filter((symbol) =>
    matches(query, symbol.label, symbol.summary),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="symbols" title={m.glossary_section_symbols()} />
      <p className="text-muted-foreground mt-2">{m.glossary_symbols_intro()}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {visible.map((sym) => (
          <GlossaryTermTile key={sym.key} className="flex-row items-start gap-3">
            {sym.icon ? (
              <img
                src={sym.icon}
                alt={sym.label}
                width={32}
                height={32}
                className="size-8 shrink-0 brightness-0 dark:invert"
              />
            ) : (
              <div className="size-8 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <div className="font-medium">{sym.label}</div>
              <p className="text-muted-foreground">{sym.summary}</p>
            </div>
          </GlossaryTermTile>
        ))}
      </ul>
    </section>
  );
}
