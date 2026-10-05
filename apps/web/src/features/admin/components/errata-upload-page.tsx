import type { UploadErrataResponse } from "@openrift/shared/contracts/admin/card-mutations";
import { pluralize } from "@openrift/shared/strings";
import { CheckIcon, EyeIcon, FileWarningIcon, UploadIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Disclosure } from "@/components/disclosure";
import { SettingsSection } from "@/components/layout/settings-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import { SectionHeading } from "@/components/ui/section-heading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AdminPageTopBar } from "@/features/admin/components/admin-page-top-bar";
import { JsonFileField } from "@/features/admin/components/json-file-field";
import { useJsonFileInput } from "@/features/admin/hooks/use-json-file-input";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import { parseJsonEntries } from "@/features/admin/lib/json-upload";
import type { BulkErrataEntry } from "@/features/cards/hooks/use-card-errata";
import { useUploadErrata } from "@/features/cards/hooks/use-card-errata";

function parseErrataEntries(text: string) {
  return parseJsonEntries<BulkErrataEntry>(
    text,
    "entries",
    "JSON must contain a non-empty array of errata entries",
  );
}

export function ErrataUploadPage() {
  const file = useJsonFileInput(parseErrataEntries);
  const entries = file.value;
  const [preview, setPreview] = useState<UploadErrataResponse | null>(null);

  const upload = useUploadErrata();

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
          file.reset();
          setPreview(null);
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

        <JsonFileField
          input={file}
          onFile={() => {
            setPreview(null);
            upload.reset();
          }}
          summary={(value, fileName) =>
            `${fileName} (${value.length} ${pluralize(value.length, "entry", "entries")})`
          }
        />

        <div className="flex gap-2">
          <Button
            disabled={!entries || upload.isPending}
            pending={upload.isPending && preview === null}
            onClick={handlePreview}
          >
            <EyeIcon className="size-4" />
            {upload.isPending && preview === null ? "Previewing…" : "Preview"}
          </Button>
          <Button
            disabled={!entries || !preview || upload.isPending}
            pending={upload.isPending && preview !== null}
            onClick={handleApply}
          >
            <UploadIcon className="size-4" />
            {upload.isPending && preview !== null ? "Applying…" : "Apply"}
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
    "announcement": {
      "name": "Spiritforged Errata",
      "publishedOn": "2026-01-14",
      "url": "https://example.com/spiritforged-errata"
    }
  },
  {
    "cardSlug": "gold",
    "correctedRulesText": "[Reaction][>] Kill this, :rb_exhaust:: [Add] :rb_rune_rainbow:.",
    "source": "Riot card gallery",
    "sourceUrl": "https://example.com/card-gallery",
    "effectiveDate": "2026-03-15"
  }
]`;

function FormatHelp() {
  return (
    <Disclosure title="Format and example" contentClassName="space-y-3">
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
          <Code>announcement</Code> (object, optional): the official post the errata came with, as{" "}
          <Code>name</Code>, <Code>publishedOn</Code> (<Code>YYYY-MM-DD</Code>) and <Code>url</Code>
          . Announcements are matched by name and created on first use; the preview lists new ones
          and any changed date or link.
        </li>
        <li>
          <Code>source</Code> (string): only for unannounced errata, where the change was seen. Each
          entry has either an <Code>announcement</Code> or a <Code>source</Code>.
        </li>
        <li>
          <Code>sourceUrl</Code> (string or <Code>null</Code>, optional): link to where the change
          was seen. Unannounced errata only.
        </li>
        <li>
          <Code>effectiveDate</Code> (string <Code>YYYY-MM-DD</Code> or <Code>null</Code>,
          optional): when the change was first seen. Unannounced errata only.
        </li>
      </ul>
      <p>Example:</p>
      <pre className="bg-muted overflow-x-auto rounded-md p-3">
        <code>{EXAMPLE_ERRATA_JSON}</code>
      </pre>
    </Disclosure>
  );
}

function PreviewSummary({ data }: { data: UploadErrataResponse }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">
        <Pill label="New" count={data.newCount} tone="success" />
        <Pill label="Updated" count={data.updatedCount} tone="warning" />
        <Pill label="Unchanged" count={data.unchangedCount} tone="neutral" />
        <Pill label="Matches printed" count={data.matchesPrintedCount} tone="neutral" />
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

      {data.newAnnouncements.length > 0 && (
        <EntryList
          label={`New announcements (${data.newAnnouncements.length})`}
          entries={data.newAnnouncements.map((name) => ({ cardSlug: name, cardName: name }))}
        />
      )}

      {data.changedAnnouncements.length > 0 && (
        <DiffList
          label={`Changed announcements (${data.changedAnnouncements.length})`}
          entries={data.changedAnnouncements.map((announcement) => ({
            cardSlug: announcement.name,
            cardName: announcement.name,
            fields: announcement.fields,
          }))}
        />
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
  tone: "success" | "warning" | "destructive" | "neutral";
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
