import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { formatReleasePeriod, isReleasedAnywhere } from "@openrift/shared/set-release";
import { Link } from "@tanstack/react-router";

import { RowList } from "@/components/ui/row-list";
import { TextLink } from "@/components/ui/text-link";
import type { SetEntry } from "@/features/rules/lib/glossary-content";
import { numberingPatterns } from "@/features/rules/lib/glossary-content";
import { matches } from "@/features/rules/lib/glossary-search";
import { m } from "@/paraglide/messages.js";

import { GlossarySectionHeading, GlossaryTermRow, GlossaryTermTile } from "./glossary-shared";

export function SetsSection({ sets, query }: { sets: SetEntry[]; query: string }) {
  const visible = sets.filter((setEntry) =>
    matches(query, setEntry.slug, setEntry.name, setEntry.setType),
  );
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="sets" title={m.glossary_section_sets()} />
      <p className="text-muted-foreground mt-2">
        <ParaglideMessage
          message={m.glossary_sets_intro}
          markup={{
            link: ({ children }) => <TextLink render={<Link to="/sets" />}>{children}</TextLink>,
          }}
        />
      </p>
      <ul className="mt-4 grid gap-2 lg:grid-cols-2">
        {visible.map((set) => (
          <GlossaryTermTile key={set.slug}>
            <div className="flex flex-wrap items-baseline gap-2">
              <code className="bg-muted shrink-0 rounded-md px-2 py-0.5 font-mono">{set.slug}</code>
              <TextLink
                variant="inherit"
                className="font-medium"
                render={<Link to="/sets/$setSlug" params={{ setSlug: set.slug }} />}
              >
                {set.name}
              </TextLink>
              <span className="text-muted-foreground">
                {set.setType === "supplemental"
                  ? m.glossary_set_type_supplemental()
                  : m.glossary_set_type_main()}
              </span>
              {!isReleasedAnywhere(set.releases) && (
                <span className="bg-warning-soft text-warning rounded-md px-1.5 py-0.5 text-xs">
                  {m.glossary_set_unreleased()}
                </span>
              )}
            </div>
            <p className="text-muted-foreground">
              {m.glossary_set_card_count({ count: set.cardCount })}
              {Object.keys(set.releases)
                .toSorted()
                .map((language) => ` · ${language} ${formatReleasePeriod(set.releases[language])}`)
                .join("")}
            </p>
          </GlossaryTermTile>
        ))}
      </ul>
    </section>
  );
}

export function NumberingSection({ query }: { query: string }) {
  const visible = numberingPatterns().filter((item) => matches(query, item.pattern, item.summary));
  if (visible.length === 0) {
    return null;
  }
  return (
    <section>
      <GlossarySectionHeading id="numbering" title={m.glossary_section_numbering()} />
      <p className="text-muted-foreground mt-2">{m.glossary_numbering_intro()}</p>
      <RowList className="mt-4">
        {visible.map((item) => (
          <GlossaryTermRow
            key={item.pattern}
            term={
              <code className="bg-muted shrink-0 rounded-md px-2 py-0.5 font-mono">
                {item.pattern}
              </code>
            }
          >
            <p className="text-muted-foreground flex-1">{item.summary}</p>
          </GlossaryTermRow>
        ))}
      </RowList>
    </section>
  );
}
