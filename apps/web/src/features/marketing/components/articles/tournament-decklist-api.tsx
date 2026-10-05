import { ParaglideMessage } from "@inlang/paraglide-js-react";

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
import { SOCIAL_LINKS } from "@/lib/social-links";
import { m } from "@/paraglide/messages.js";

const EXAMPLE_REQUEST = `POST /api/v1/ingest/deck-check
Authorization: Bearer orpk_your-key-here
Content-Type: application/json

{
  "tournamentId": "019eb565-3d55-7d21-8d86-e9b6939a2c2f",
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

const EXAMPLE_RESPONSE = `{
  "tournamentId": "019eb565-3d55-7d21-8d86-e9b6939a2c2f",
  "entriesCreated": 1,
  "entriesUpdated": 0,
  "entriesUnchanged": 0,
  "entriesWithdrawn": 0,
  "checksInvalidated": 0,
  "entries": [
    {
      "externalId": "1234",
      "entryId": "019eb565-4a01-7c3b-9f12-c2d80f5a1e77",
      "claimUrl": "https://…/tournaments/claim/8f3c2a…"
    }
  ]
}`;

function errorRows(): { status: string; meaning: string }[] {
  return [
    { status: "400", meaning: m.help_tournament_api_error_400() },
    { status: "401", meaning: m.help_tournament_api_error_401() },
    { status: "404", meaning: m.help_tournament_api_error_404() },
    { status: "409", meaning: m.help_tournament_api_error_409() },
    { status: "413", meaning: m.help_tournament_api_error_413() },
    { status: "422", meaning: m.help_tournament_api_error_422() },
    { status: "429", meaning: m.help_tournament_api_error_429() },
  ];
}

export default function TournamentDecklistApiArticle() {
  return (
    <div className="space-y-8">
      <p className="text-muted-foreground">
        <ParaglideMessage message={m.help_tournament_api_intro} markup={PROSE_MARKUP} />
      </p>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_flow_heading()}</Heading>
        <ol className="text-muted-foreground list-inside list-decimal space-y-2">
          <li>
            <strong className="text-foreground">{m.help_tournament_api_flow_1_strong()}</strong>{" "}
            {m.help_tournament_api_flow_1_rest()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_tournament_api_flow_2_strong()}</strong>{" "}
            {m.help_tournament_api_flow_2_rest()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_tournament_api_flow_3_strong()}</strong>{" "}
            {m.help_tournament_api_flow_3_rest()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_tournament_api_flow_4_strong()}</strong>{" "}
            {m.help_tournament_api_flow_4_rest()}
          </li>
          <li>
            <strong className="text-foreground">{m.help_tournament_api_flow_5_strong()}</strong>{" "}
            {m.help_tournament_api_flow_5_rest()}
          </li>
        </ol>
        <p className="text-muted-foreground mt-3">{m.help_tournament_api_flow_note()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_keys_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_tournament_api_keys}
            markup={{
              strong: PROSE_MARKUP.strong,
              link: linkMarkup("/profile"),
            }}
          />
        </p>
        <p className="text-muted-foreground mt-2">
          <ParaglideMessage message={m.help_tournament_api_keys_format} markup={PROSE_MARKUP} />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_push_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_tournament_api_push_intro}
            markup={{
              code: PROSE_MARKUP.code,
              code2: PROSE_MARKUP.code,
              code3: PROSE_MARKUP.code,
            }}
          />
        </p>
        <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">
          {EXAMPLE_REQUEST}
        </pre>
        <ul className="text-muted-foreground mt-3 space-y-2">
          <li>
            <Code>tournamentId</Code>
            {m.help_tournament_api_field_tournament_id()}
          </li>
          <li>
            <Code>externalId</Code>
            <ParaglideMessage
              message={m.help_tournament_api_field_external_id}
              markup={PROSE_MARKUP}
            />
          </li>
          <li>
            <Code>playerName</Code>
            <ParaglideMessage
              message={m.help_tournament_api_field_player_name}
              markup={{
                code: PROSE_MARKUP.code,
                code2: PROSE_MARKUP.code,
              }}
            />
          </li>
          <li>
            <Code>allowDeckPublishing</Code>, <Code>allowNameSharing</Code>,{" "}
            <Code>allowRiotIdSharing</Code>
            <ParaglideMessage message={m.help_tournament_api_field_consent} markup={PROSE_MARKUP} />
          </li>
          <li>
            <Code>withdrawn</Code>
            <ParaglideMessage
              message={m.help_tournament_api_field_withdrawn}
              markup={PROSE_MARKUP}
            />
          </li>
          <li>
            <Code>cards</Code>
            {m.help_tournament_api_field_cards()}
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">
          <ParaglideMessage
            message={m.help_tournament_api_sections}
            markup={{
              code: PROSE_MARKUP.code,
              code2: PROSE_MARKUP.code,
              code3: PROSE_MARKUP.code,
              code4: PROSE_MARKUP.code,
              code5: PROSE_MARKUP.code,
              code6: PROSE_MARKUP.code,
              code7: PROSE_MARKUP.code,
              code8: PROSE_MARKUP.code,
              code9: PROSE_MARKUP.code,
              code10: PROSE_MARKUP.code,
            }}
          />
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_changes_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_tournament_api_changes} markup={PROSE_MARKUP} />
        </p>
        <p className="text-muted-foreground mt-2">{m.help_tournament_api_changes_replace()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_response_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_tournament_api_response} markup={PROSE_MARKUP} />
        </p>
        <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">
          {EXAMPLE_RESPONSE}
        </pre>
        <p className="text-muted-foreground mt-3">
          <Code>entryId</Code>{" "}
          <ParaglideMessage message={m.help_tournament_api_response_entry} markup={PROSE_MARKUP} />
        </p>
        <p className="text-muted-foreground mt-2">{m.help_tournament_api_response_stable_link()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_limits_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage message={m.help_tournament_api_limits} markup={PROSE_MARKUP} />
        </p>
        <div className="mt-3">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.help_tournament_api_table_status()}</TableHead>
                <TableHead>{m.help_tournament_api_table_meaning()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errorRows().map((row) => (
                <TableRow key={row.status}>
                  <TableCell className="align-top font-mono text-xs">{row.status}</TableCell>
                  <TableCell className="text-muted-foreground align-top whitespace-normal">
                    {row.meaning}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-muted-foreground mt-3">{m.help_tournament_api_failed_note()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_reference_heading()}</Heading>
        <p className="text-muted-foreground">
          <ParaglideMessage
            message={m.help_tournament_api_reference}
            markup={{
              link: linkMarkup("/api/doc"),
              link2: linkMarkup("/api/ui"),
              link3: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
              link4: ({ children }) => (
                <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
                  {children}
                </TextLink>
              ),
            }}
          />
        </p>
      </section>
    </div>
  );
}
