import type { UploadErrataResponse } from "@openrift/shared/contracts/admin/card-mutations";
import { CheckIcon, EyeIcon, FileWarningIcon, LoaderIcon, UploadIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminDisclosure } from "@/features/admin/components/admin-disclosure";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import type { BulkErrataEntry } from "@/features/cards/hooks/use-card-errata";
import { useUploadErrata } from "@/features/cards/hooks/use-card-errata";

type ParseResult =
  | { ok: true; entries: BulkErrataEntry[] }
  | { ok: false; error: "invalid-json" | "empty-or-wrong-shape" };

/**
 * Kept as a module-level helper so react-compiler doesn't try to lower the ternary + logical
 * expressions inside the try/catch (it bails on "value blocks" within try statements).
 */
function parseErrataEntries(text: string): ParseResult {
  try {
    const json = JSON.parse(text) as unknown[] | { entries?: unknown };
    const list = Array.isArray(json) ? json : json.entries;
    if (!Array.isArray(list) || list.length === 0) {
      return { ok: false, error: "empty-or-wrong-shape" };
    }
    return { ok: true, entries: list as BulkErrataEntry[] };
  } catch {
    return { ok: false, error: "invalid-json" };
  }
}

export function ErrataUploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [entries, setEntries] = useState<BulkErrataEntry[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadErrataResponse | null>(null);

  const upload = useUploadErrata();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setFileName(file.name);
    setParseError(null);
    setEntries(null);
    setPreview(null);
    upload.reset();

    let text: string;
    try {
      text = await file.text();
    } catch {
      setParseError("Could not read that file");
      return;
    }
    const parsed = parseErrataEntries(text);
    if (!parsed.ok) {
      setParseError(
        parsed.error === "invalid-json"
          ? "Invalid JSON file"
          : "JSON must contain a non-empty array of errata entries",
      );
      return;
    }
    setEntries(parsed.entries);
  }

  function handlePreview() {
    if (!entries) {
      return;
    }
    upload.mutate(
      { dryRun: true, entries },
      {
        onSuccess: (data) => {
          setPreview(data);
        },
      },
    );
  }

  function handleApply() {
    if (!entries) {
      return;
    }
    upload.mutate(
      { dryRun: false, entries },
      {
        onSuccess: () => {
          setEntries(null);
          setFileName(null);
          setPreview(null);
          if (fileRef.current) {
            fileRef.current.value = "";
          }
        },
      },
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminPageTopBar title="Errata" />
      <SettingsSection
        title={
          <span className="flex items-center gap-2">
            <FileWarningIcon className="size-5 shrink-0" />
            Upload Errata
          </span>
        }
        description="Each entry replaces the corrected text for one card, keyed by slug."
      >
        <FormatHelp />

        <div className="flex flex-col gap-2">
          <Label htmlFor="errata-file">JSON file</Label>
          <Input
            id="errata-file"
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={(event) => void handleFileChange(event)}
          />
          {fileName && entries && (
            <p className="text-muted-foreground text-sm">
              {fileName} ({entries.length} entr{entries.length === 1 ? "y" : "ies"})
            </p>
          )}
          {parseError && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <XIcon className="text-destructive size-4 shrink-0" />
              {parseError}
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button disabled={!entries || upload.isPending} onClick={handlePreview}>
            {upload.isPending && preview === null ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Previewing...
              </>
            ) : (
              <>
                <EyeIcon className="size-4" />
                Preview
              </>
            )}
          </Button>
          <Button
            variant="default"
            disabled={!entries || !preview || upload.isPending}
            onClick={handleApply}
          >
            {upload.isPending && preview !== null ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <UploadIcon className="size-4" />
                Apply
              </>
            )}
          </Button>
        </div>

        {preview && <PreviewSummary data={preview} />}

        {upload.isSuccess && !preview && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <CheckIcon className="text-success size-4 shrink-0" />
            Errata applied successfully
          </p>
        )}

        {upload.isError && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <XIcon className="text-destructive size-4 shrink-0" />
            {upload.error.message}
          </p>
        )}
      </SettingsSection>
    </div>
  );
}

const EXAMPLE_ERRATA_JSON = `[
  {
    "cardSlug": "jinx-rebel",
    "correctedRulesText": "When this unit attacks, deal 2 damage to target unit.",
    "correctedEffectText": null,
    "source": "Official rulings, 2026-03-15",
    "sourceUrl": "https://example.com/rulings",
    "effectiveDate": "2026-03-15"
  }
]`;

function FormatHelp() {
  return (
    <AdminDisclosure title="Format and example" contentClassName="space-y-3">
      <p>
        The file must contain a JSON array of entries (or an object with an <Code>entries</Code>{" "}
        field holding the array). Each entry has these fields:
      </p>
      <ul className="ml-5 list-disc space-y-1">
        <li>
          <Code>cardSlug</Code> (string, required): slug of the card to errata.
        </li>
        <li>
          <Code>correctedRulesText</Code> (string or <Code>null</Code>): corrected rules text. At
          least one of rules or effect text must be set.
        </li>
        <li>
          <Code>correctedEffectText</Code> (string or <Code>null</Code>): corrected effect text.
        </li>
        <li>
          <Code>source</Code> (string, required): short label describing where the correction comes
          from.
        </li>
        <li>
          <Code>sourceUrl</Code> (string or <Code>null</Code>, optional): link to the source.
        </li>
        <li>
          <Code>effectiveDate</Code> (string <Code>YYYY-MM-DD</Code> or <Code>null</Code>,
          optional): date the errata took effect.
        </li>
      </ul>
      <p>Example:</p>
      <pre className="bg-muted overflow-x-auto rounded-md p-3">
        <code>{EXAMPLE_ERRATA_JSON}</code>
      </pre>
    </AdminDisclosure>
  );
}

function PreviewSummary({ data }: { data: UploadErrataResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Pill label="New" count={data.newCount} tone="success" />
        <Pill label="Updated" count={data.updatedCount} tone="warning" />
        <Pill label="Unchanged" count={data.unchangedCount} tone="muted" />
        <Pill label="Matches printed" count={data.matchesPrintedCount} tone="muted" />
        <Pill label="Errors" count={data.errors.length} tone="destructive" />
      </div>

      {data.errors.length > 0 && (
        <ul className="text-muted-foreground ml-5 list-disc text-sm">
          {data.errors.slice(0, 10).map((err, index) => (
            <li key={index}>{err}</li>
          ))}
          {data.errors.length > 10 && <li>...and {data.errors.length - 10} more</li>}
        </ul>
      )}

      {data.newEntries.length > 0 && (
        <EntryList label={`New errata (${data.newEntries.length})`} entries={data.newEntries} />
      )}

      {data.updatedEntries.length > 0 && (
        <DiffList
          label={`Updated errata (${data.updatedEntries.length})`}
          entries={data.updatedEntries}
        />
      )}

      {data.skippedMatchesPrinted.length > 0 && (
        <EntryList
          label={`Skipped — already matches printed text (${data.skippedMatchesPrinted.length})`}
          entries={data.skippedMatchesPrinted}
        />
      )}
    </div>
  );
}

function Pill({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "success" | "warning" | "destructive" | "muted";
}) {
  return (
    <Badge variant={tone} className="h-auto rounded-md px-2 py-0.5 text-sm">
      {label}: {count}
    </Badge>
  );
}

function EntryList({
  label,
  entries,
}: {
  label: string;
  entries: { cardSlug: string; cardName: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading as="h3" size="sm">
        {label}
      </SectionHeading>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader className="bg-muted sticky top-0">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Slug</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.cardSlug}>
                <TableCell className="font-medium">{entry.cardName}</TableCell>
                <TableCell className="text-muted-foreground">{entry.cardSlug}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DiffList({
  label,
  entries,
}: {
  label: string;
  entries: {
    cardSlug: string;
    cardName: string;
    fields: { field: string; from: string | null; to: string | null }[];
  }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <SectionHeading as="h3" size="sm">
        {label}
      </SectionHeading>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader className="bg-muted sticky top-0">
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.flatMap((entry) =>
              entry.fields.map((field, fieldIndex) => (
                <TableRow key={`${entry.cardSlug}-${fieldIndex}`}>
                  <TableCell className="font-medium">{entry.cardName}</TableCell>
                  <TableCell>{field.field}</TableCell>
                  <TableCell
                    className="text-destructive max-w-48 truncate"
                    title={JSON.stringify(field.from)}
                  >
                    {JSON.stringify(field.from)}
                  </TableCell>
                  <TableCell
                    className="text-success max-w-48 truncate"
                    title={JSON.stringify(field.to)}
                  >
                    {JSON.stringify(field.to)}
                  </TableCell>
                </TableRow>
              )),
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
