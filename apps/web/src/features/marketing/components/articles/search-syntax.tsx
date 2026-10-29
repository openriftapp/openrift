import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { PROSE_MARKUP } from "@/components/message-markup";
import { Code } from "@/components/ui/code";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

type Message = typeof m.help_search_syntax_intro;

interface SyntaxSection {
  id: string;
  heading: () => string;
  body: Message;
  examples: { query: string; description: () => string }[];
}

function sections(): SyntaxSection[] {
  return [
    {
      id: "domains",
      heading: m.help_search_syntax_domains_heading,
      body: m.help_search_syntax_domains_body,
      examples: [
        { query: "d:fury", description: m.help_search_syntax_domains_ex_1 },
        { query: "d=fury,chaos", description: m.help_search_syntax_domains_ex_2 },
        { query: "d<=calm,mind t:unit", description: m.help_search_syntax_domains_ex_3 },
        { query: "d:colorless t:gear", description: m.help_search_syntax_domains_ex_4 },
      ],
    },
    {
      id: "types",
      heading: m.help_search_syntax_types_heading,
      body: m.help_search_syntax_types_body,
      examples: [
        { query: "t:champion d:order", description: m.help_search_syntax_types_ex_1 },
        { query: "t:noxus -t:champion", description: m.help_search_syntax_types_ex_2 },
        { query: "t:poro", description: m.help_search_syntax_types_ex_3 },
        { query: 'tag:"master yi"', description: m.help_search_syntax_types_ex_4 },
      ],
    },
    {
      id: "text",
      heading: m.help_search_syntax_text_heading,
      body: m.help_search_syntax_text_body,
      examples: [
        { query: 'o:"draw 1" t:unit', description: m.help_search_syntax_text_ex_1 },
        { query: "o:stun -t:spell", description: m.help_search_syntax_text_ex_2 },
        { query: "kw:tank -t:unit", description: m.help_search_syntax_text_ex_3 },
        { query: 'kw:"quick draw"', description: m.help_search_syntax_text_ex_4 },
      ],
    },
    {
      id: "costs",
      heading: m.help_search_syntax_costs_heading,
      body: m.help_search_syntax_costs_body,
      examples: [
        { query: "e<=2 t:spell d:mind", description: m.help_search_syntax_costs_ex_1 },
        { query: "p>=2 d:order", description: m.help_search_syntax_costs_ex_2 },
        { query: "t:unit p:0", description: m.help_search_syntax_costs_ex_3 },
        { query: "e:0 t:gear", description: m.help_search_syntax_costs_ex_4 },
      ],
    },
    {
      id: "might",
      heading: m.help_search_syntax_might_heading,
      body: m.help_search_syntax_might_body,
      examples: [
        { query: "m>=6", description: m.help_search_syntax_might_ex_1 },
        { query: "t:unit e=2 m>=4", description: m.help_search_syntax_might_ex_2 },
      ],
    },
    {
      id: "rarity",
      heading: m.help_search_syntax_rarity_heading,
      body: m.help_search_syntax_rarity_body,
      examples: [
        { query: "r:showcase", description: m.help_search_syntax_rarity_ex_1 },
        { query: "r>=epic d:body", description: m.help_search_syntax_rarity_ex_2 },
        { query: "r:e t:spell", description: m.help_search_syntax_rarity_ex_3 },
      ],
    },
    {
      id: "sets",
      heading: m.help_search_syntax_sets_heading,
      body: m.help_search_syntax_sets_body,
      examples: [
        { query: "s:ogn", description: m.help_search_syntax_sets_ex_1 },
        { query: "s:vendetta t:legend", description: m.help_search_syntax_sets_ex_2 },
        { query: "s:ogn cn:1", description: m.help_search_syntax_sets_ex_3 },
        { query: "s:sfd cn>=200", description: m.help_search_syntax_sets_ex_4 },
        { query: "in:ogn in:unl", description: m.help_search_syntax_sets_ex_5 },
      ],
    },
    {
      id: "formats",
      heading: m.help_search_syntax_formats_heading,
      body: m.help_search_syntax_formats_body,
      examples: [
        { query: "f:constructed t:legend", description: m.help_search_syntax_formats_ex_1 },
        { query: "banned:constructed", description: m.help_search_syntax_formats_ex_2 },
        { query: "banned:2v2", description: m.help_search_syntax_formats_ex_3 },
      ],
    },
    {
      id: "prices",
      heading: m.help_search_syntax_prices_heading,
      body: m.help_search_syntax_prices_body,
      examples: [
        { query: "usd>=100", description: m.help_search_syntax_prices_ex_1 },
        { query: "eur>=10 r:rare", description: m.help_search_syntax_prices_ex_2 },
        { query: "usdfoil>=50", description: m.help_search_syntax_prices_ex_3 },
        { query: "usd<1 is:foil t:champion", description: m.help_search_syntax_prices_ex_4 },
      ],
    },
    {
      id: "artist",
      heading: m.help_search_syntax_artist_heading,
      body: m.help_search_syntax_artist_body,
      examples: [
        { query: 'a:"six more vodka"', description: m.help_search_syntax_artist_ex_1 },
        { query: "ft:piltover", description: m.help_search_syntax_artist_ex_2 },
      ],
    },
    {
      id: "printings",
      heading: m.help_search_syntax_printings_heading,
      body: m.help_search_syntax_printings_body,
      examples: [
        { query: "is:foil r:common", description: m.help_search_syntax_printings_ex_1 },
        { query: "is:altart d:calm", description: m.help_search_syntax_printings_ex_2 },
        { query: "is:variant t:legend", description: m.help_search_syntax_printings_ex_3 },
        { query: "marker:prerelease", description: m.help_search_syntax_printings_ex_4 },
        { query: "has:errata", description: m.help_search_syntax_printings_ex_5 },
      ],
    },
    {
      id: "year",
      heading: m.help_search_syntax_year_heading,
      body: m.help_search_syntax_year_body,
      examples: [
        { query: "year=2025", description: m.help_search_syntax_year_ex_1 },
        { query: "date>=2026-07-01", description: m.help_search_syntax_year_ex_2 },
      ],
    },
    {
      id: "reprints",
      heading: m.help_search_syntax_reprints_heading,
      body: m.help_search_syntax_reprints_body,
      examples: [
        { query: "is:reprint s:unl", description: m.help_search_syntax_reprints_ex_1 },
        {
          query: "is:firstprint s:sfd t:champion",
          description: m.help_search_syntax_reprints_ex_2,
        },
      ],
    },
    {
      id: "languages",
      heading: m.help_search_syntax_languages_heading,
      body: m.help_search_syntax_languages_body,
      examples: [
        { query: "lang:fr t:legend", description: m.help_search_syntax_languages_ex_1 },
        { query: "in:tc t:legend", description: m.help_search_syntax_languages_ex_2 },
        { query: "lang:kr t:champion", description: m.help_search_syntax_languages_ex_3 },
      ],
    },
    {
      id: "your-cards",
      heading: m.help_search_syntax_owned_heading,
      body: m.help_search_syntax_owned_body,
      examples: [
        { query: "owned>=4", description: m.help_search_syntax_owned_ex_1 },
        { query: "ctag:aggro", description: m.help_search_syntax_owned_ex_2 },
      ],
    },
    {
      id: "negating",
      heading: m.help_search_syntax_negate_heading,
      body: m.help_search_syntax_negate_body,
      examples: [
        { query: "-t:spell d:fury", description: m.help_search_syntax_negate_ex_1 },
        { query: "not:foil r:epic", description: m.help_search_syntax_negate_ex_2 },
        { query: "-jinx t:champion", description: m.help_search_syntax_negate_ex_3 },
      ],
    },
    {
      id: "exact",
      heading: m.help_search_syntax_exact_heading,
      body: m.help_search_syntax_exact_body,
      examples: [
        { query: '!"Jinx, Rebel"', description: m.help_search_syntax_exact_ex_1 },
        { query: '!"Blind Fury"', description: m.help_search_syntax_exact_ex_2 },
      ],
    },
    {
      id: "or",
      heading: m.help_search_syntax_or_heading,
      body: m.help_search_syntax_or_body,
      examples: [
        { query: "t:spell or t:gear", description: m.help_search_syntax_or_ex_1 },
        { query: "t:unit (a:kudos or a:envar)", description: m.help_search_syntax_or_ex_2 },
      ],
    },
    {
      id: "nesting",
      heading: m.help_search_syntax_nesting_heading,
      body: m.help_search_syntax_nesting_body,
      examples: [
        {
          query: "t:champion (d:fury or d:chaos) e<=3",
          description: m.help_search_syntax_nesting_ex_1,
        },
        {
          query: "(t:legend or t:battlefield) r:showcase",
          description: m.help_search_syntax_nesting_ex_2,
        },
      ],
    },
    {
      id: "display",
      heading: m.help_search_syntax_display_heading,
      body: m.help_search_syntax_display_body,
      examples: [
        { query: '!"Jinx, Rebel" unique:prints', description: m.help_search_syntax_display_ex_1 },
        { query: "t:legend order:usd", description: m.help_search_syntax_display_ex_2 },
        {
          query: "f:constructed order:rarity direction:asc",
          description: m.help_search_syntax_display_ex_3,
        },
        { query: "t:unit prefer:oldest", description: m.help_search_syntax_display_ex_4 },
      ],
    },
    {
      id: "ignored",
      heading: m.help_search_syntax_ignored_heading,
      body: m.help_search_syntax_ignored_body,
      examples: [
        { query: "cost:3 t:unit", description: m.help_search_syntax_ignored_ex_1 },
        { query: "d:purple t:unit", description: m.help_search_syntax_ignored_ex_2 },
      ],
    },
  ];
}

function QueryLink({ query }: { query: string }) {
  return (
    <TextLink render={<Link to="/cards" search={{ q: query }} />}>
      <Code>{query}</Code>
    </TextLink>
  );
}

export default function SearchSyntaxArticle() {
  const list = sections();
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        <ParaglideMessage message={m.help_search_syntax_intro} markup={PROSE_MARKUP} />
      </p>

      <nav aria-label={m.help_search_syntax_contents()}>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
          {list.map((section) => (
            <li key={section.id}>
              <TextLink href={`#${section.id}`}>{section.heading()}</TextLink>
            </li>
          ))}
        </ul>
      </nav>

      {list.map((section) => (
        <section key={section.id} id={section.id} className="scroll-mt-20">
          <Heading className="mb-2">{section.heading()}</Heading>
          <p className="text-muted-foreground mb-3">
            <ParaglideMessage message={section.body} markup={PROSE_MARKUP} />
          </p>
          <ul className="space-y-2">
            {section.examples.map((example) => (
              <li key={example.query} className="flex flex-col gap-0.5">
                <QueryLink query={example.query} />
                <span className="text-muted-foreground">{example.description()}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
