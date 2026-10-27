import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ReactNode } from "react";

import { ProsePage } from "@/components/prose-page";
import { DEVELOPER_ENDPOINT_PATHS } from "@/features/marketing/lib/developer-endpoints";
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

const codeMarkup = { code: ({ children }: { children?: ReactNode }) => <code>{children}</code> };

function ExternalLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

export function DevelopersPage() {
  const hydrated = useHydrated();
  const origin = hydrated ? getSiteUrl() : "";

  return (
    <ProsePage>
      <h1>{m.developers_title()}</h1>
      <p>
        <ParaglideMessage
          message={m.developers_intro}
          markup={{
            link: ({ children }) => (
              <ExternalLink href={SOCIAL_LINKS.githubRepo}>{children}</ExternalLink>
            ),
          }}
        />
      </p>

      <h2>{m.developers_quickstart_heading()}</h2>
      <p>{m.developers_quickstart_p()}</p>
      <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">
        <code>{`curl -A "MyDeckTool/1.0 (you@example.com)" -o catalog.json ${origin}/api/v1/catalog`}</code>
      </pre>
      <p>
        <ParaglideMessage message={m.developers_identify_p} markup={codeMarkup} />
      </p>
      <p>
        <ParaglideMessage
          message={m.developers_docs_p}
          markup={{
            link2: ({ children }) => <a href="/api/developers/ui">{children}</a>,
          }}
        />
      </p>

      <h2>{m.developers_read_heading()}</h2>
      <table>
        <thead>
          <tr>
            <th>{m.developers_table_endpoint()}</th>
            <th>{m.developers_table_returns()}</th>
          </tr>
        </thead>
        <tbody>
          {endpoints().map((endpoint) => (
            <tr key={endpoint.path}>
              <td>
                <code>{endpoint.path}</code>
              </td>
              <td>{endpoint.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{m.developers_identify_cors_p()}</p>

      <h2>{m.developers_catalog_heading()}</h2>
      <p>{m.developers_catalog_shape_p()}</p>
      <p>
        <ParaglideMessage message={m.developers_catalog_lookup_p} markup={codeMarkup} />
      </p>
      <p>
        <ParaglideMessage
          message={m.developers_catalog_images_p}
          markup={{
            ...codeMarkup,
            imagepath: () => (
              <code>
                {origin}/media/cards/{"{imageId}-{size}"}.webp
              </code>
            ),
          }}
        />
      </p>
      <p>{m.developers_catalog_images_terms_p()}</p>

      <h2>{m.developers_links_heading()}</h2>
      <p>{m.developers_prices_p()}</p>
      <p>
        <ParaglideMessage message={m.developers_links_p} markup={codeMarkup} />
      </p>

      <h2>{m.developers_caching_heading()}</h2>
      <p>
        <ParaglideMessage message={m.developers_caching_p} markup={codeMarkup} />
      </p>
      <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">
        <code>
          {[
            `$ curl -si -A "MyDeckTool/1.0 (you@example.com)" ${origin}/api/v1/sets`,
            "HTTP/2 200",
            "cache-control: public, max-age=3600, stale-while-revalidate=86400",
            'etag: "ef44dbbc"',
            "",
            `$ curl -si -A "MyDeckTool/1.0 (you@example.com)" -H 'If-None-Match: "ef44dbbc"' ${origin}/api/v1/sets`,
            "HTTP/2 304",
          ].join("\n")}
        </code>
      </pre>
      <p>
        <ParaglideMessage message={m.developers_caching_example_p} markup={codeMarkup} />
      </p>
      <p>{m.developers_limits_p()}</p>

      <h2>{m.developers_terms_heading()}</h2>
      <p>{m.developers_license_p()}</p>
      <p>
        <ParaglideMessage
          message={m.developers_attribution_p}
          markup={{ code: () => <code>/cards/{"{card-slug}"}</code> }}
        />
      </p>
      <p>{m.developers_stability_p()}</p>

      <h2>{m.developers_contact_heading()}</h2>
      <p>
        <ParaglideMessage
          message={m.developers_contribute_p}
          markup={{ link: ({ children }) => <a href="/contribute">{children}</a> }}
        />
      </p>
      <p>
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
      </p>
    </ProsePage>
  );
}
