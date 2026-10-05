import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { TournamentHostInfo } from "@openrift/shared/types/api/tournament";
import { Link } from "@tanstack/react-router";

import { Disclosure } from "@/components/disclosure";
import { PROSE_MARKUP } from "@/components/message-markup";
import { Code } from "@/components/ui/code";
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
    <Disclosure
      title={m.tournaments_deck_check_ingest_summary()}
      className="bg-muted/30"
      contentClassName="flex flex-col gap-4"
    >
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
            <Code className="break-all">{getSiteUrl()}/api/v1/ingest/deck-check</Code>
          </li>
          <li>
            {m.tournaments_deck_check_ingest_header_label()}{" "}
            <Code>Authorization: Bearer &lt;your key&gt;</Code>
          </li>
          <li>
            <ParaglideMessage
              message={m.tournaments_deck_check_ingest_body}
              inputs={{ tournamentId }}
              markup={{
                ...PROSE_MARKUP,
                codeid: ({ children }) => <Code className="break-all">{children}</Code>,
              }}
            />
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{m.tournaments_deck_check_ingest_example_body_heading()}</p>
        <pre className="bg-muted overflow-x-auto rounded-md p-3">
          {buildExamplePayload(tournamentId)}
        </pre>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{m.tournaments_deck_check_ingest_entry_fields_heading()}</p>
        <ul className="flex flex-col gap-2">
          <li>
            <Code>externalId</Code>{" "}
            <span className="text-muted-foreground">
              {m.tournaments_deck_check_ingest_field_external_id()}
            </span>
          </li>
          <li>
            <Code>playerName</Code>{" "}
            <span className="text-muted-foreground">
              {m.tournaments_deck_check_ingest_field_player_name()}
            </span>
          </li>
          <li>
            <Code>riotId</Code>, <Code>submittedAt</Code>{" "}
            <span className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_field_optional}
                markup={PROSE_MARKUP}
              />
            </span>
          </li>
          <li>
            <Code>allowDeckPublishing</Code>, <Code>allowNameSharing</Code>,{" "}
            <Code>allowRiotIdSharing</Code>{" "}
            <span className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_field_consent}
                markup={PROSE_MARKUP}
              />
            </span>
          </li>
          <li>
            <Code>withdrawn</Code>{" "}
            <span className="text-muted-foreground">
              <ParaglideMessage
                message={m.tournaments_deck_check_ingest_field_withdrawn}
                markup={PROSE_MARKUP}
              />
            </span>
          </li>
          <li>
            <Code>cards[].section</Code>{" "}
            <span className="text-muted-foreground">
              {m.tournaments_deck_check_ingest_field_section()}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{m.tournaments_deck_check_ingest_sections_heading()}</p>
        <p className="text-muted-foreground">
          <Code>legend</Code>, <Code>champion</Code>, <Code>main</Code>, <Code>runes</Code>,{" "}
          <Code>battlefield</Code>, <Code>sideboard</Code>, <Code>overflow</Code>
          <ParaglideMessage
            message={m.tournaments_deck_check_ingest_sections_variants}
            markup={PROSE_MARKUP}
          />
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="font-semibold">{m.tournaments_deck_check_ingest_response_heading()}</p>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.tournaments_deck_check_ingest_response}
            markup={PROSE_MARKUP}
          />{" "}
          {m.tournaments_deck_check_ingest_response_counts()}
          <Code>entriesCreated</Code>, <Code>entriesUpdated</Code>, <Code>entriesUnchanged</Code>,{" "}
          <Code>entriesWithdrawn</Code>, <Code>checksInvalidated</Code>
          {m.tournaments_deck_check_ingest_response_entries()} <Code>entries</Code>{" "}
          {m.tournaments_deck_check_ingest_response_keyed_by()} <Code>externalId</Code>.
        </p>
        <pre className="bg-muted overflow-x-auto rounded-md p-3">
          {buildExampleResponse(tournamentId)}
        </pre>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.tournaments_deck_check_ingest_claim} markup={PROSE_MARKUP} />
        </p>
      </div>
    </Disclosure>
  );
}
