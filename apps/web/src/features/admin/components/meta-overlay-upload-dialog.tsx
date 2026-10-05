import { pluralize } from "@openrift/shared/strings";
import type { MetaUploadBody, MetaUploadResponse } from "@openrift/shared/types/api/meta";
import { UploadIcon } from "lucide-react";
import { useState } from "react";

import { Disclosure } from "@/components/disclosure";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StatStripItem } from "@/components/ui/stat-strip";
import { StatStrip } from "@/components/ui/stat-strip";
import { JsonFileField } from "@/features/admin/components/json-file-field";
import { useUploadMetaOverlays } from "@/features/admin/hooks/use-admin-meta-overlays";
import { useJsonFileInput } from "@/features/admin/hooks/use-json-file-input";
import type { JsonParseResult } from "@/features/admin/lib/json-upload";
import { parseMetaUploadFile } from "@/features/meta/lib/meta-source-review";

const EXAMPLE_UPLOAD_JSON = `{
  "provider": "riftdecks",
  "events": [
    {
      "externalId": "summoner-skirmish-2026-08",
      "name": "Summoner Skirmish",
      "eventDate": "2026-08-02",
      "format": "standard",
      "playerCount": 64,
      "organizer": "Piltover Game Night",
      "sourceUrl": "https://example.test/events/1",
      "players": [
        {
          "externalId": "summoner-skirmish-2026-08-1",
          "playerName": "Rin",
          "rank": 1,
          "rankIsTier": false,
          "wins": 6,
          "losses": 1,
          "draws": 0,
          "legendName": "Yasuo",
          "cards": [{ "name": "Yasuo", "zone": "legend", "quantity": 1 }]
        },
        {
          "externalId": "summoner-skirmish-2026-08-2",
          "playerName": "Kael",
          "rank": 8,
          "rankIsTier": true,
          "wins": 4,
          "losses": 3,
          "draws": 0,
          "legendName": "Lux"
        }
      ]
    }
  ]
}`;

function FormatHelp() {
  return (
    <Disclosure title="Format and example" contentClassName="space-y-3 py-3">
      <p>
        The file is the whole request body: a <Code>provider</Code> string and a non-empty{" "}
        <Code>events</Code> array. Each event replaces its own staged copy in full, keyed by{" "}
        <Code>externalId</Code>; events left out of the file are untouched. A player carries a list
        only when the source published one; the rest are standings rows with a legend. Card and
        legend names are matched against the catalog on ingest. A field the file leaves out is
        claimed by nothing and stays with whichever source publishes it.
      </p>
      <pre className="bg-muted overflow-x-auto rounded-md p-3">
        <code>{EXAMPLE_UPLOAD_JSON}</code>
      </pre>
    </Disclosure>
  );
}

function summaryItems(result: MetaUploadResponse): StatStripItem[] {
  return [
    { key: "new-events", value: result.newEvents, label: "new events" },
    { key: "updated-events", value: result.updatedEvents, label: "updated events" },
    { key: "unchanged-events", value: result.unchangedEvents, label: "unchanged events" },
    { key: "ignored-skipped", value: result.ignoredSkipped, label: "skipped (ignored)" },
    { key: "new-players", value: result.newPlayers, label: "new players" },
    { key: "updated-players", value: result.updatedPlayers, label: "updated players" },
    { key: "unchanged-players", value: result.unchangedPlayers, label: "unchanged players" },
  ];
}

function UploadSummary({ result }: { result: MetaUploadResponse }) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Staged under <span className="font-mono">{result.provider}</span>.
      </p>
      <StatStrip items={summaryItems(result)} />

      {result.newEventDetails.length > 0 && (
        <Disclosure title={`New events (${result.newEventDetails.length})`}>
          <ul className="space-y-1">
            {result.newEventDetails.map((event) => (
              <li key={event.externalId}>
                {event.name}{" "}
                <span className="text-muted-foreground font-mono">{event.externalId}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {result.updatedEventDetails.length > 0 && (
        <Disclosure title={`Updated events (${result.updatedEventDetails.length})`}>
          <ul className="space-y-1">
            {result.updatedEventDetails.map((event) => (
              <li key={event.externalId}>
                {event.name}{" "}
                <span className="text-muted-foreground font-mono">{event.externalId}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {result.unresolvedCards.length > 0 && (
        <Disclosure title={`Lists with unmatched card names (${result.unresolvedCards.length})`}>
          <ul className="space-y-2">
            {result.unresolvedCards.map((entry) => (
              <li key={`${entry.eventExternalId}-${entry.playerExternalId}`}>
                <span className="text-muted-foreground font-mono">
                  {entry.eventExternalId} / {entry.playerExternalId}
                </span>
                <div>{entry.names.join(", ")}</div>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      {result.errors.length > 0 && (
        <Disclosure title={`Errors (${result.errors.length})`}>
          <ul className="text-muted-foreground space-y-1">
            {result.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </Disclosure>
      )}
    </div>
  );
}

function parseUploadBody(text: string): JsonParseResult<MetaUploadBody> {
  const parsed = parseMetaUploadFile(text);
  return parsed.ok ? { ok: true, value: parsed.body } : parsed;
}

/**
 * Validates only the envelope; per-event validation happens server-side and
 * comes back in the summary's error list.
 */
export function MetaOverlayUploadDialog({ onClose }: { onClose: () => void }) {
  const upload = useUploadMetaOverlays();
  const file = useJsonFileInput(parseUploadBody);
  const body = file.value;
  const [result, setResult] = useState<MetaUploadResponse | null>(null);

  async function handleUpload() {
    if (!body) {
      return;
    }
    let response: MetaUploadResponse;
    try {
      response = await upload.mutateAsync(body);
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    setResult(response);
    file.reset();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a source file</DialogTitle>
          <DialogDescription>
            Nothing reaches the archive until you accept it in the queue.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <FormatHelp />

          <JsonFileField
            input={file}
            onFile={() => setResult(null)}
            summary={(value, fileName) => (
              <>
                {fileName}: {value.events.length} {pluralize(value.events.length, "event")} under{" "}
                <span className="font-mono">{value.provider}</span>
              </>
            )}
          />

          {result && <UploadSummary result={result} />}
        </div>

        <DialogFooter>
          <DialogCancel>Close</DialogCancel>
          <Button onClick={() => void handleUpload()} disabled={!body} pending={upload.isPending}>
            <UploadIcon />
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
