import { Heading } from "@/components/heading";
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
        {m.help_tournament_api_intro_before()}{" "}
        <strong className="text-foreground">{m.help_tournament_api_intro_tab()}</strong>{" "}
        {m.help_tournament_api_intro_after()}
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
          {m.help_tournament_api_keys_before()}{" "}
          <strong className="text-foreground">{m.help_tournament_api_keys_section()}</strong>{" "}
          {m.help_tournament_api_keys_mid()}{" "}
          <TextLink href="/profile">{m.help_tournament_api_keys_profile_link()}</TextLink>
          {m.help_tournament_api_keys_after()}
        </p>
        <p className="text-muted-foreground mt-2">
          {m.help_tournament_api_keys_format_before()} <Code>orpk_…</Code>{" "}
          {m.help_tournament_api_keys_format_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_push_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_tournament_api_push_intro_before()} <Code>POST</Code>{" "}
          {m.help_tournament_api_push_intro_mid()} <Code>/api/v1/ingest/deck-check</Code>{" "}
          {m.help_tournament_api_push_intro_after()} <Code>Authorization</Code>{" "}
          {m.help_tournament_api_push_intro_end()}
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
            {m.help_tournament_api_field_external_id_before()} <Code>openrift:</Code>
            {m.help_tournament_api_field_external_id_after()}
          </li>
          <li>
            <Code>playerName</Code>
            {m.help_tournament_api_field_player_name_before()} <Code>riotId</Code>
            {m.help_tournament_api_field_player_name_mid()} <Code>submittedAt</Code>
            {m.help_tournament_api_field_player_name_after()}
          </li>
          <li>
            <Code>allowDeckPublishing</Code>, <Code>allowNameSharing</Code>,{" "}
            <Code>allowRiotIdSharing</Code>
            {m.help_tournament_api_field_consent_before()} <Code>false</Code>
            {m.help_tournament_api_field_consent_after()}
          </li>
          <li>
            <Code>withdrawn</Code>
            {m.help_tournament_api_field_withdrawn_before()} <Code>true</Code>
            {m.help_tournament_api_field_withdrawn_after()}
          </li>
          <li>
            <Code>cards</Code>
            {m.help_tournament_api_field_cards()}
          </li>
        </ul>
        <p className="text-muted-foreground mt-3">
          {m.help_tournament_api_sections_before()} <Code>legend</Code>, <Code>champion</Code>,{" "}
          <Code>main</Code>, <Code>runes</Code>, <Code>battlefield</Code>, <Code>sideboard</Code>,{" "}
          {m.help_tournament_api_sections_mid()} <Code>overflow</Code>
          {m.help_tournament_api_sections_variants()} <Code>deck</Code>, <Code>maindeck</Code>,{" "}
          <Code>side</Code>, {m.help_tournament_api_sections_after()}
        </p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_changes_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_tournament_api_changes_before()} <Code>withdrawn</Code>{" "}
          {m.help_tournament_api_changes_after()}
        </p>
        <p className="text-muted-foreground mt-2">{m.help_tournament_api_changes_replace()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_response_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_tournament_api_response_before()} <Code>externalId</Code>
          {m.help_tournament_api_response_after()}
        </p>
        <pre className="bg-muted mt-3 overflow-x-auto rounded-md p-3 text-sm">
          {EXAMPLE_RESPONSE}
        </pre>
        <p className="text-muted-foreground mt-3">
          <Code>entryId</Code> {m.help_tournament_api_response_entry_before()} <Code>claimUrl</Code>{" "}
          {m.help_tournament_api_response_entry_after()}
        </p>
        <p className="text-muted-foreground mt-2">{m.help_tournament_api_response_stable_link()}</p>
      </section>

      <section>
        <Heading className="mb-2">{m.help_tournament_api_limits_heading()}</Heading>
        <p className="text-muted-foreground">
          {m.help_tournament_api_limits_before()} <Code>RateLimit</Code>{" "}
          {m.help_tournament_api_limits_after()}
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
          {m.help_tournament_api_reference_before()}{" "}
          <TextLink href="/api/doc">{m.help_tournament_api_reference_openapi()}</TextLink>
          {m.help_tournament_api_reference_mid()} <TextLink href="/api/ui">Swagger UI</TextLink>
          {m.help_tournament_api_reference_after()}{" "}
          <TextLink href={SOCIAL_LINKS.discordInvite} target="_blank" rel="noreferrer">
            Discord
          </TextLink>{" "}
          {m.help_tournament_api_reference_or()}{" "}
          <TextLink href={SOCIAL_LINKS.githubIssues} target="_blank" rel="noreferrer">
            GitHub
          </TextLink>{" "}
          {m.help_tournament_api_reference_end()}
        </p>
      </section>
    </div>
  );
}
