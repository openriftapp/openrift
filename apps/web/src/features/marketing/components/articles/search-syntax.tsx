import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { SearchKeyId } from "@openrift/shared/search-query/keys";
import { SEARCH_KEYS } from "@openrift/shared/search-query/keys";
import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { PROSE_MARKUP } from "@/components/message-markup";
import { Code } from "@/components/ui/code";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { searchKeyLabel } from "@/features/cards/lib/search-clause-labels";
import { m } from "@/paraglide/messages.js";

const KEY_EXAMPLES: Record<SearchKeyId, string> = {
  type: "t:unit",
  oracle: 'o:"draw a card"',
  keyword: "kw:shield",
  domain: "d<=fury,chaos",
  energy: "e<=3",
  might: "m>=5",
  power: "p=2",
  rarity: "r>=rare",
  set: "s:ogn",
  number: "cn>=200",
  artist: 'a:"kudos productions"',
  flavor: "ft:piltover",
  lang: "lang:fr",
  format: "f:constructed",
  banned: "banned:constructed",
  usd: "usd<5",
  eur: "eur<5",
  price: "price>=20",
  is: "is:foil",
  not: "not:foil",
  has: "has:errata",
  otag: "otag:teemo",
  marker: "marker:prerelease",
  channel: "channel:proving-grounds",
  ctag: "ctag:aggro",
  owned: "owned>=1",
  year: "year=2025",
  date: "date>=2026-01",
  order: "order:energy",
  direction: "direction:desc",
  unique: "unique:prints",
  in: "in:fr",
  prefer: "prefer:oldest",
};

function examples(): { description: string; query: string }[] {
  return [
    { description: m.help_search_syntax_example_fury_units(), query: "t:unit d:fury e<=3" },
    { description: m.help_search_syntax_example_deck_domains(), query: "d<=fury,chaos t:unit" },
    {
      description: m.help_search_syntax_example_cheap_epics(),
      query: "r:epic usd<5 f:constructed",
    },
    {
      description: m.help_search_syntax_example_two_domains(),
      query: "(d:calm or d:mind) t:spell",
    },
    { description: m.help_search_syntax_example_no_spells(), query: "kw:shield -t:spell" },
    {
      description: m.help_search_syntax_example_alt_arts(),
      query: "is:altart s:sfd order:price direction:desc",
    },
    { description: m.help_search_syntax_example_banned(), query: "banned:constructed" },
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
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        <ParaglideMessage message={m.help_search_syntax_intro} markup={PROSE_MARKUP} />
      </p>

      <section>
        <Heading className="mb-2">{m.help_search_syntax_basics_heading()}</Heading>
        <ul className="text-muted-foreground list-inside list-disc space-y-2">
          <li>
            <ParaglideMessage message={m.help_search_syntax_basics_words} markup={PROSE_MARKUP} />
          </li>
          <li>
            <ParaglideMessage message={m.help_search_syntax_basics_exact} markup={PROSE_MARKUP} />
          </li>
          <li>
            <ParaglideMessage message={m.help_search_syntax_basics_negate} markup={PROSE_MARKUP} />
          </li>
          <li>
            <ParaglideMessage message={m.help_search_syntax_basics_or} markup={PROSE_MARKUP} />
          </li>
          <li>
            <ParaglideMessage message={m.help_search_syntax_basics_compare} markup={PROSE_MARKUP} />
          </li>
        </ul>
      </section>

      <section>
        <Heading className="mb-2">{m.help_search_syntax_examples_heading()}</Heading>
        <ul className="space-y-2">
          {examples().map((example) => (
            <li key={example.query} className="flex flex-col gap-0.5">
              <span className="text-muted-foreground">{example.description}</span>
              <QueryLink query={example.query} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <Heading className="mb-2">{m.help_search_syntax_keys_heading()}</Heading>
        <p className="text-muted-foreground mb-3">{m.help_search_syntax_keys_intro()}</p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{m.help_search_syntax_table_key()}</TableHead>
              <TableHead>{m.help_search_syntax_table_searches()}</TableHead>
              <TableHead>{m.help_search_syntax_table_example()}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SEARCH_KEYS.map((definition) => (
              <TableRow key={definition.id}>
                <TableCell className="font-mono whitespace-normal">
                  {definition.aliases.join(" ")}
                </TableCell>
                <TableCell className="whitespace-normal">{searchKeyLabel(definition.id)}</TableCell>
                <TableCell>
                  <Code>{KEY_EXAMPLES[definition.id]}</Code>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground mt-3">
          <ParaglideMessage message={m.help_search_syntax_keys_notes} markup={PROSE_MARKUP} />
        </p>
      </section>
    </div>
  );
}
