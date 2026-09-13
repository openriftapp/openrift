import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentHostInfo } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";

import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

function buildExamplePayload(tournamentId: string): string {
  return `{
  "tournamentId": "${tournamentId}",
  "entries": [
    {
      "externalId": "1234",
      "playerName": "A. Player",
      "riotId": "Player#EUW",
      "submittedAt": "2026-06-18T20:00:00Z",
      "allowDeckPublishing": true,
      "allowNameSharing": true,
      "allowRiotIdSharing": true,
      "withdrawn": false,
      "cards": [
        { "name": "Darius, Trifarian", "quantity": 1, "section": "champion" },
        { "name": "Blazing Scorcher", "quantity": 3, "section": "main" }
      ]
    }
  ]
}`;
}

function buildExampleResponse(tournamentId: string): string {
  return `{
  "tournamentId": "${tournamentId}",
  "entriesCreated": 1,
  "entriesUpdated": 0,
  "entriesUnchanged": 0,
  "entriesWithdrawn": 0,
  "checksInvalidated": 0,
  "entries": [
    {
      "externalId": "1234",
      "entryId": "019eb565-3d55-7d21-8d86-e9b6939a2c2f",
      "claimUrl": "${getSiteUrl()}/tournaments/claim/8f3c2a…"
    }
  ]
}`;
}

export function DeckCheckIngestGuide({
  tournamentId,
  host,
}: {
  tournamentId: string;
  host: TournamentHostInfo;
}) {
  const orgId = host.type === "organization" ? host.orgId : null;
  const keysLinkRender = orgId ? (
    <Link to="/organizations/$id" params={{ id: orgId }} />
  ) : (
    <Link to="/profile" hash="integrations" />
  );
  const keysLinkLabel = orgId
    ? m.tournaments_deck_check_ingest_host_page_link({ name: host.displayName })
    : m.tournaments_deck_check_ingest_profile_link();

  return (
    <Callout>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          {m.tournaments_deck_check_ingest_summary()}
        </summary>
        <div className="mt-3 flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1">
            <p>
              {m.tournaments_deck_check_ingest_intro()}{" "}
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_manage_keys}
                inputs={{ target: keysLinkLabel }}
                markup={{
                  link: ({ children }) => (
                    <TextLink variant="muted" className="font-medium" render={keysLinkRender}>
                      {children}
                    </TextLink>
                  ),
                }}
              />
            </p>
            <p className="text-muted-foreground">
              {m.tournaments_deck_check_ingest_host_key_lead()}{" "}
              {host.type === "organization"
                ? m.tournaments_deck_check_ingest_host_key_org()
                : m.tournaments_deck_check_ingest_host_key_personal()}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">{m.tournaments_deck_check_ingest_request_heading()}</p>
            <ul className="text-muted-foreground flex list-disc flex-col gap-1 pl-5">
              <li>
                <span className="text-foreground">POST</span>{" "}
                <code className="break-all">{getSiteUrl()}/api/v1/ingest/deck-check</code>
              </li>
              <li>
                {m.tournaments_deck_check_ingest_header_label()}{" "}
                <code>Authorization: Bearer &lt;your key&gt;</code>
              </li>
              <li>
                <ParaglideMessage
                  message={m.tournaments_deck_check_ingest_body}
                  inputs={{ tournamentId }}
                  markup={{
                    code: ({ children }) => <code>{children}</code>,
                    codeid: ({ children }) => <code className="break-all">{children}</code>,
                  }}
                />
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">
              {m.tournaments_deck_check_ingest_example_body_heading()}
            </p>
            <pre className="bg-muted overflow-x-auto rounded-md p-3">
              {buildExamplePayload(tournamentId)}
            </pre>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">
              {m.tournaments_deck_check_ingest_entry_fields_heading()}
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <code>externalId</code>{" "}
                <span className="text-muted-foreground">
                  {m.tournaments_deck_check_ingest_field_external_id()}
                </span>
              </li>
              <li>
                <code>playerName</code>{" "}
                <span className="text-muted-foreground">
                  {m.tournaments_deck_check_ingest_field_player_name()}
                </span>
              </li>
              <li>
                <code>riotId</code>, <code>submittedAt</code>{" "}
                <span className="text-muted-foreground">
                  <ParaglideMessage
                    message={m.tournaments_deck_check_ingest_field_optional}
                    markup={{ code: ({ children }) => <code>{children}</code> }}
                  />
                </span>
              </li>
              <li>
                <code>allowDeckPublishing</code>, <code>allowNameSharing</code>,{" "}
                <code>allowRiotIdSharing</code>{" "}
                <span className="text-muted-foreground">
                  <ParaglideMessage
                    message={m.tournaments_deck_check_ingest_field_consent}
                    markup={{ code: ({ children }) => <code>{children}</code> }}
                  />
                </span>
              </li>
              <li>
                <code>withdrawn</code>{" "}
                <span className="text-muted-foreground">
                  <ParaglideMessage
                    message={m.tournaments_deck_check_ingest_field_withdrawn}
                    markup={{ code: ({ children }) => <code>{children}</code> }}
                  />
                </span>
              </li>
              <li>
                <code>cards[].section</code>{" "}
                <span className="text-muted-foreground">
                  {m.tournaments_deck_check_ingest_field_section()}
                </span>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">{m.tournaments_deck_check_ingest_sections_heading()}</p>
            <p className="text-muted-foreground">
              <code>legend</code>, <code>champion</code>, <code>main</code>, <code>runes</code>,{" "}
              <code>battlefield</code>, <code>sideboard</code>, <code>overflow</code>
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_sections_variants}
                markup={{ code: ({ children }) => <code>{children}</code> }}
              />
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="font-semibold">{m.tournaments_deck_check_ingest_response_heading()}</p>
            <p className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_response}
                markup={{ code: ({ children }) => <code>{children}</code> }}
              />{" "}
              {m.tournaments_deck_check_ingest_response_counts()}
              <code>entriesCreated</code>, <code>entriesUpdated</code>,{" "}
              <code>entriesUnchanged</code>, <code>entriesWithdrawn</code>,{" "}
              <code>checksInvalidated</code>
              {m.tournaments_deck_check_ingest_response_entries()} <code>entries</code>{" "}
              {m.tournaments_deck_check_ingest_response_keyed_by()} <code>externalId</code>.
            </p>
            <pre className="bg-muted overflow-x-auto rounded-md p-3">
              {buildExampleResponse(tournamentId)}
            </pre>
            <p className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_claim}
                markup={{ code: ({ children }) => <code>{children}</code> }}
              />
            </p>
          </div>
        </div>
      </details>
    </Callout>
  );
}
