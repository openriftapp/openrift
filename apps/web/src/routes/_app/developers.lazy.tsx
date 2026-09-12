import { createLazyFileRoute } from "@tanstack/react-router";

import { ProsePage } from "@/components/prose-page";
import { m } from "@/paraglide/messages.js";

export const Route = createLazyFileRoute("/_app/developers")({
  component: DevelopersPage,
});

// Paths stay relative to the site origin: getSiteUrl() reads window.location.origin
// on the client and can mismatch the SSR value, causing a hydration error.
function endpoints(): { path: string; description: string }[] {
  return [
    { path: "/api/v1/catalog", description: m.developers_endpoint_catalog() },
    { path: "/api/v1/cards/{cardSlug}", description: m.developers_endpoint_card() },
    { path: "/api/v1/prices", description: m.developers_endpoint_prices() },
    { path: "/api/v1/sets", description: m.developers_endpoint_sets() },
    { path: "/api/v1/rules", description: m.developers_endpoint_rules() },
    { path: "/api/v1/promos", description: m.developers_endpoint_promos() },
    { path: "/api/v1/products", description: m.developers_endpoint_products() },
  ];
}

function DevelopersPage() {
  return (
    <ProsePage>
      <h1>{m.developers_title()}</h1>
      <p>{m.developers_intro()}</p>

      <h2>{m.developers_identify_heading()}</h2>
      <p>
        {m.developers_identify_p_1()} <code>User-Agent</code> {m.developers_identify_p_2()}{" "}
        <code>MyDeckTool/1.0 (you@example.com)</code>
        {m.developers_identify_p_3()} <code>User-Agent</code> {m.developers_identify_p_4()}{" "}
        <code>Origin</code> {m.developers_identify_p_5()}
      </p>

      <h2>{m.developers_docs_heading()}</h2>
      <p>
        {m.developers_docs_p_before()} <a href="/api/doc">{m.developers_docs_spec_link()}</a>
        {m.developers_docs_p_middle()} <a href="/api/ui">Swagger UI</a>{" "}
        {m.developers_docs_p_after()}
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
      <p>{m.developers_subendpoints_p()}</p>

      <h2>{m.developers_ingest_heading()}</h2>
      <p>
        {m.developers_ingest_p_1()} <code>POST /api/v1/ingest/deck-check</code>
        {m.developers_ingest_p_2()}{" "}
        <a href="/help/tournament-decklist-api">{m.developers_ingest_link()}</a>{" "}
        {m.developers_ingest_p_3()}
      </p>

      <h2>{m.developers_caching_heading()}</h2>
      <p>
        {m.developers_caching_p_1()}{" "}
        <code>Cache-Control: public, max-age=3600, stale-while-revalidate=86400</code>
        {m.developers_caching_p_2()} <code>max-age=300</code> {m.developers_caching_p_3()}{" "}
        <code>max-age=60</code>
        {m.developers_caching_p_4()} <code>ETag</code> {m.developers_caching_p_5()}{" "}
        <code>max-age</code> {m.developers_caching_p_6()} <code>If-None-Match</code>{" "}
        {m.developers_caching_p_7()}
      </p>

      <h2>{m.developers_attribution_heading()}</h2>
      <p>
        {m.developers_attribution_p_before()}
        <code>/cards/{"{card-slug}"}</code>
        {m.developers_attribution_p_after()}
      </p>
    </ProsePage>
  );
}
