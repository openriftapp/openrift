import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";

import { Heading } from "@/components/heading";
import { PROSE_MARKUP } from "@/components/message-markup";
import { Code } from "@/components/ui/code";
import { TextLink } from "@/components/ui/text-link";
import { searchSyntaxSections } from "@/features/marketing/lib/search-syntax-examples";
import { m } from "@/paraglide/messages.js";

function QueryLink({ query }: { query: string }) {
  return (
    <TextLink render={<Link to="/cards" search={{ q: query }} />}>
      <Code>{query}</Code>
    </TextLink>
  );
}

export default function SearchSyntaxArticle() {
  const list = searchSyntaxSections();
  return (
    <div className="space-y-8 [&_code]:whitespace-nowrap">
      <p className="text-muted-foreground">
        <ParaglideMessage message={m.help_search_syntax_intro} markup={PROSE_MARKUP} />
      </p>

      <nav aria-label={m.help_search_syntax_contents()}>
        <ul className="flex flex-wrap gap-2">
          {list.map((section) => (
            <li key={section.id}>
              <TextLink
                href={`#${section.id}`}
                variant="inherit"
                className="bg-muted text-muted-foreground hover:text-foreground inline-block rounded-full px-3 py-1 hover:no-underline"
              >
                {section.heading()}
              </TextLink>
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
