import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { imageUrl } from "@openrift/shared/image-url";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";

import { Heading } from "@/components/heading";
import { PROSE_MARKUP, linkMarkup } from "@/components/message-markup";
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
import { cardDetailQueryOptions } from "@/features/cards/lib/card-detail-queries";
import { DevelopersHero } from "@/features/marketing/components/developers-hero";
import type { DevelopersShowcaseCard } from "@/features/marketing/components/developers-hero";
import { HelpPageLayout } from "@/features/marketing/components/help-article-page";
import {
  DEVELOPER_ENDPOINT_PATHS,
  SHOWCASE_CARD_SLUG,
  SHOWCASE_PUBLIC_CODE,
} from "@/features/marketing/lib/developer-endpoints";
import type { DeveloperEndpointPath } from "@/features/marketing/lib/developer-endpoints";
import { useHydrated } from "@/hooks/use-hydrated";
import { getSiteUrl } from "@/lib/site-config";
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

// Paths stay relative to the site origin: getSiteUrl() reads window.location.origin
// on the client and can mismatch the SSR value, causing a hydration error.
const ENDPOINT_DESCRIPTIONS: Record<DeveloperEndpointPath, () => string> = {
  "/api/v1/catalog": m.developers_endpoint_catalog,
  "/api/v1/cards/{cardSlug}": m.developers_endpoint_card,
  "/api/v1/search": m.developers_endpoint_search,
  "/api/v1/search/named": m.developers_endpoint_named,
  "/api/v1/search/random": m.developers_endpoint_random,
  "/api/v1/sets": m.developers_endpoint_sets,
  "/api/v1/prices": m.developers_endpoint_prices,
  "/api/v1/prices/{printingId}": m.developers_endpoint_printing_prices,
  "/api/v1/prices/links": m.developers_endpoint_links,
  "/api/v1/rules": m.developers_endpoint_rules,
  "/api/v1/rules/versions": m.developers_endpoint_rule_versions,
};

function endpoints(): { path: string; description: string }[] {
  return DEVELOPER_ENDPOINT_PATHS.map((path) => ({
    path,
    description: ENDPOINT_DESCRIPTIONS[path](),
  }));
}

function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <TextLink href={href} target="_blank" rel="noreferrer">
      {children}
    </TextLink>
  );
}

function CodeBlock({ children }: { children: string }) {
  return <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">{children}</pre>;
}

function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <Heading>{heading}</Heading>
      {children}
    </section>
  );
}

function Paragraph({ children }: { children: ReactNode }) {
  return <p className="text-muted-foreground">{children}</p>;
}

function useShowcaseCard(): DevelopersShowcaseCard | null {
  const { data } = useQuery(cardDetailQueryOptions(SHOWCASE_CARD_SLUG));
  if (!data) {
    return null;
  }
  const printing =
    data.printings.find(
      (row) => row.publicCode === SHOWCASE_PUBLIC_CODE && row.language === "EN",
    ) ?? data.printings.find((row) => row.images.length > 0);
  if (!printing) {
    return null;
  }
  const imageId = printing.images.at(0)?.imageId;
  return {
    name: data.card.name,
    energy: data.card.energy,
    tags: data.card.tags,
    domains: data.card.domains,
    rulesText: printing.printedRulesText,
    publicCode: printing.publicCode,
    imageSrc: imageId ? imageUrl(imageId, "400w") : null,
  };
}

export function DevelopersPage() {
  const hydrated = useHydrated();
  const origin = hydrated ? getSiteUrl() : "";
  const showcase = useShowcaseCard();
  const userAgent = "MyDeckTool/1.0 (you@example.com)";

  return (
    <HelpPageLayout title={m.developers_title()}>
      <div className="space-y-8">
        <DevelopersHero
          origin={origin}
          card={showcase}
          lead={
            <ParaglideMessage
              message={m.developers_intro}
              markup={{
                link: ({ children }) => (
                  <ExternalLink href={SOCIAL_LINKS.githubRepo}>{children}</ExternalLink>
                ),
              }}
            />
          }
        />

        <Section heading={m.developers_quickstart_heading()}>
          <Paragraph>{m.developers_quickstart_p()}</Paragraph>
          <CodeBlock>{`curl -A "${userAgent}" -o catalog.json ${origin}/api/v1/catalog`}</CodeBlock>
          <Paragraph>
            <ParaglideMessage message={m.developers_identify_p} markup={PROSE_MARKUP} />
          </Paragraph>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_docs_p}
              markup={{ link2: linkMarkup("/api/developers/ui") }}
            />
          </Paragraph>
        </Section>

        <Section heading={m.developers_read_heading()}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.developers_table_endpoint()}</TableHead>
                <TableHead>{m.developers_table_returns()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endpoints().map((endpoint) => (
                <TableRow key={endpoint.path}>
                  <TableCell className="align-top">
                    <Code>{endpoint.path}</Code>
                  </TableCell>
                  <TableCell className="text-muted-foreground align-top whitespace-normal">
                    {endpoint.description}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_identify_cors_p}
              markup={{
                link: ({ children }) => (
                  <ExternalLink href={SOCIAL_LINKS.discordInvite}>{children}</ExternalLink>
                ),
              }}
            />
          </Paragraph>
        </Section>

        <Section heading={m.developers_catalog_heading()}>
          <Paragraph>{m.developers_catalog_shape_p()}</Paragraph>
          <Paragraph>
            <ParaglideMessage message={m.developers_catalog_lookup_p} markup={PROSE_MARKUP} />
          </Paragraph>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_catalog_images_p}
              markup={{
                ...PROSE_MARKUP,
                imagepath: () => (
                  <Code>
                    {origin}/media/cards/{"{imageId}-{size}"}.webp
                  </Code>
                ),
              }}
            />
          </Paragraph>
          <Paragraph>{m.developers_catalog_images_terms_p()}</Paragraph>
        </Section>

        <Section heading={m.developers_search_heading()}>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_search_p}
              markup={{ ...PROSE_MARKUP, link: linkMarkup("/help/search-syntax") }}
            />
          </Paragraph>
          <CodeBlock>{`curl -A "${userAgent}" "${origin}/api/v1/search?q=t%3Aunit%20d%3Afury%20e%3C%3D3&limit=20"`}</CodeBlock>
          <Paragraph>
            <ParaglideMessage message={m.developers_search_details_p} markup={PROSE_MARKUP} />
          </Paragraph>
        </Section>

        <Section heading={m.developers_links_heading()}>
          <Paragraph>{m.developers_prices_p()}</Paragraph>
          <Paragraph>
            <ParaglideMessage message={m.developers_links_p} markup={PROSE_MARKUP} />
          </Paragraph>
        </Section>

        <Section heading={m.developers_caching_heading()}>
          <Paragraph>
            <ParaglideMessage message={m.developers_caching_p} markup={PROSE_MARKUP} />
          </Paragraph>
          <CodeBlock>
            {[
              `$ curl -si -A "${userAgent}" ${origin}/api/v1/sets`,
              "HTTP/2 200",
              "cache-control: public, max-age=3600, stale-while-revalidate=86400",
              'etag: "ef44dbbc"',
              "",
              `$ curl -si -A "${userAgent}" -H 'If-None-Match: "ef44dbbc"' ${origin}/api/v1/sets`,
              "HTTP/2 304",
            ].join("\n")}
          </CodeBlock>
          <Paragraph>
            <ParaglideMessage message={m.developers_caching_example_p} markup={PROSE_MARKUP} />
          </Paragraph>
          <Paragraph>{m.developers_limits_p()}</Paragraph>
        </Section>

        <Section heading={m.developers_attribution_heading()}>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_attribution_p}
              markup={{ code: () => <Code>/cards/{"{card-slug}"}</Code> }}
            />
          </Paragraph>
        </Section>

        <Section heading={m.developers_terms_heading()}>
          <Paragraph>{m.developers_license_p()}</Paragraph>
          <Paragraph>{m.developers_stability_p()}</Paragraph>
        </Section>

        <Section heading={m.developers_contact_heading()}>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_contribute_p}
              markup={{ link: linkMarkup("/contribute") }}
            />
          </Paragraph>
          <Paragraph>
            <ParaglideMessage
              message={m.developers_contact_p}
              markup={{
                link: ({ children }) => (
                  <ExternalLink href={SOCIAL_LINKS.githubIssues}>{children}</ExternalLink>
                ),
                link2: ({ children }) => (
                  <ExternalLink href={SOCIAL_LINKS.discordInvite}>{children}</ExternalLink>
                ),
              }}
            />
          </Paragraph>
        </Section>
      </div>
    </HelpPageLayout>
  );
}
