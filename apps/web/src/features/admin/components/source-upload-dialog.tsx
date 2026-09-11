import { CheckIcon, ChevronsUpDownIcon, LoaderIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Code } from "@/components/ui/code";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UploadCandidatesBody } from "@/features/admin/hooks/use-admin-image-mutations";
import { useUploadCandidates } from "@/features/admin/hooks/use-admin-image-mutations";
import { ADMIN_TABLE_CLASS } from "@/features/admin/lib/admin-table-styles";
import type { UploadCandidatesResponse } from "@/lib/server-fns/api-types";

type UploadDetail = UploadCandidatesResponse["newCardDetails"][number];
type UploadDiff = UploadCandidatesResponse["updatedCards"][number];

type ParseResult =
  | { ok: true; candidates: UploadCandidatesBody["candidates"] }
  | { ok: false; error: "invalid-json" | "empty-or-wrong-shape" };

// Module-level so react-compiler doesn't try to lower the ternary + logical
// expressions inside the try/catch (it bails on "value blocks" within try statements).
function parseCandidates(text: string): ParseResult {
  try {
    const json = JSON.parse(text) as unknown[] | { candidates?: unknown };
    const candidates = Array.isArray(json) ? json : json.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return { ok: false, error: "empty-or-wrong-shape" };
    }
    return { ok: true, candidates: candidates as UploadCandidatesBody["candidates"] };
  } catch {
    return { ok: false, error: "invalid-json" };
  }
}

const EXAMPLE_SOURCE_JSON = `[
  {
    "card": {
      "name": "Jinx, Rebel",
      "external_id": "jinx-rebel-001",
      "types": ["unit"],
      "super_types": ["champion"],
      "domains": ["chaos"],
      "might": 3,
      "energy": 2,
      "power": null,
      "rules_text": "When this unit attacks, deal 2 damage to target unit.",
      "effect_text": null,
      "tags": ["Punk"],
      "short_code": "OGN-202"
    },
    "printings": [
      {
        "short_code": "OGN-202",
        "external_id": "jinx-rebel-001-en-foil",
        "set_id": "ogn",
        "set_name": "Origins",
        "rarity": "rare",
        "finish": "foil",
        "artist": "Jane Doe",
        "language": "EN",
        "image_url": "https://example.com/cards/jinx-rebel.jpg"
      }
    ]
  }
]`;

function UploadFormatHelp() {
  return (
    <details className="rounded-md border">
      <summary className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-2 text-sm font-medium select-none">
        Format and example
      </summary>
      <div className="space-y-3 border-t px-3 py-3 text-sm">
        <p>
          The file must contain a JSON array of entries (or an object with a <Code>candidates</Code>{" "}
          field holding the array). Each entry has a <Code>card</Code> object and a{" "}
          <Code>printings</Code> array. Field names use snake_case.
        </p>
        <p>
          <span className="font-medium">Required card fields:</span> <Code>name</Code>,{" "}
          <Code>external_id</Code>. Optional: <Code>type</Code>, <Code>super_types</Code>,{" "}
          <Code>domains</Code>, <Code>might</Code>, <Code>energy</Code>, <Code>power</Code>,{" "}
          <Code>might_bonus</Code>, <Code>rules_text</Code>, <Code>effect_text</Code>,{" "}
          <Code>tags</Code>, <Code>short_code</Code>, <Code>extra_data</Code>.
        </p>
        <p>
          <span className="font-medium">Required printing fields:</span> <Code>short_code</Code>,{" "}
          <Code>external_id</Code>. Optional: <Code>set_id</Code>, <Code>set_name</Code>,{" "}
          <Code>rarity</Code>, <Code>art_variant</Code>, <Code>is_signed</Code>,{" "}
          <Code>marker_slugs</Code>, <Code>distribution_channel_slugs</Code>, <Code>finish</Code>,{" "}
          <Code>artist</Code>, <Code>public_code</Code>, <Code>printed_rules_text</Code>,{" "}
          <Code>printed_effect_text</Code>, <Code>image_url</Code>, <Code>flavor_text</Code>,{" "}
          <Code>language</Code>, <Code>printed_name</Code>, <Code>printed_year</Code>,{" "}
          <Code>extra_data</Code>.
        </p>
        <p className="text-muted-foreground">
          Export the catalog to download a real file in the same format.
        </p>
        <p>Example:</p>
        <pre className="bg-muted overflow-x-auto rounded-md p-3">
          <code>{EXAMPLE_SOURCE_JSON}</code>
        </pre>
      </div>
    </details>
  );
}

function SourceNameField({
  names,
  value,
  onChange,
}: {
  names: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const trimmed = value.trim();
  const isNew = trimmed !== "" && !names.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  return (
    <div className="space-y-2">
      <Label>
        Source name <span className="text-destructive">*</span>
      </Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger className="border-input focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full items-center justify-between rounded-lg border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50">
          <span className={value ? "text-foreground" : "text-muted-foreground"}>
            {value || "Select or type a source name…"}
          </span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent className="w-[var(--anchor-width)] p-0" align="start">
          <Command
            filter={(itemValue, search) => {
              if (itemValue.startsWith("__create__")) {
                return 1;
              }
              return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Type or select a source…"
              value={value}
              onValueChange={onChange}
              onFocus={(event) => event.target.select()}
            />
            <CommandList>
              <CommandEmpty className="text-muted-foreground py-3 text-center text-sm">
                No sources yet.
              </CommandEmpty>
              {names.length > 0 && (
                <CommandGroup heading="Existing sources">
                  {names.map((name) => (
                    <CommandItem
                      key={name}
                      value={name}
                      data-checked={value === name || undefined}
                      onSelect={(selected) => {
                        onChange(selected);
                        setOpen(false);
                      }}
                    >
                      {name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {isNew && (
                <CommandGroup>
                  <CommandItem
                    value={`__create__${trimmed}`}
                    onSelect={() => {
                      onChange(trimmed);
                      setOpen(false);
                    }}
                  >
                    Create &ldquo;{trimmed}&rdquo;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <p className="text-muted-foreground text-sm">
        A unique label naming where this data came from.
      </p>
    </div>
  );
}

function ItemList({ label, items }: { label: string; items: UploadDetail[] }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader className="bg-muted sticky top-0">
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Code</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="text-muted-foreground">{item.shortCode ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function DiffTable({ label, items }: { label: string; items: UploadDiff[] }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <div className="max-h-64 overflow-y-auto rounded-md border">
        <Table className={ADMIN_TABLE_CLASS}>
          <TableHeader className="bg-muted sticky top-0">
            <TableRow>
              <TableHead>Card</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Field</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.flatMap((item, itemIndex) =>
              item.fields.map((field, fieldIndex) => (
                <TableRow key={`${itemIndex}-${fieldIndex}`}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.shortCode ?? "—"}</TableCell>
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

function UploadSummary({ data }: { data: UploadCandidatesResponse }) {
  return (
    <div className="space-y-2">
      <div className="text-muted-foreground flex items-start gap-1 text-sm">
        <CheckIcon className="text-success mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Upload complete for &ldquo;{data.provider}&rdquo;</p>
          <p>
            Cards: {data.newCards} new, {data.removedCards} removed, {data.updates} updated,{" "}
            {data.unchanged} unchanged
          </p>
          <p>
            Printings: {data.newPrintings} new, {data.removedPrintings} removed,{" "}
            {data.printingUpdates} updated, {data.printingsUnchanged} unchanged
          </p>
          {data.errors.length > 0 && (
            <ul className="text-muted-foreground ml-5 list-disc">
              {data.errors.slice(0, 10).map((message, index) => (
                <li key={index}>{message}</li>
              ))}
              {data.errors.length > 10 && <li>…and {data.errors.length - 10} more</li>}
            </ul>
          )}
        </div>
      </div>
      {data.newCardDetails.length > 0 && (
        <ItemList label="Added cards" items={data.newCardDetails} />
      )}
      {data.removedCardDetails.length > 0 && (
        <ItemList label="Removed cards" items={data.removedCardDetails} />
      )}
      {data.updatedCards.length > 0 && (
        <DiffTable label="Updated cards" items={data.updatedCards} />
      )}
      {data.newPrintingDetails.length > 0 && (
        <ItemList label="Added printings" items={data.newPrintingDetails} />
      )}
      {data.removedPrintingDetails.length > 0 && (
        <ItemList label="Removed printings" items={data.removedPrintingDetails} />
      )}
      {data.updatedPrintings.length > 0 && (
        <DiffTable label="Updated printings" items={data.updatedPrintings} />
      )}
    </div>
  );
}

export function SourceUploadDialog({
  names,
  initialName,
  onClose,
}: {
  names: string[];
  initialName: string;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(initialName);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileData, setFileData] = useState<UploadCandidatesBody["candidates"] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const upload = useUploadCandidates();

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    setParseError(null);
    setFileData(null);
    if (name === "") {
      setName(file.name.replace(/\.json$/iu, ""));
    }

    let text: string;
    try {
      text = await file.text();
    } catch {
      setParseError("Could not read that file");
      return;
    }
    const parsed = parseCandidates(text);
    if (!parsed.ok) {
      setParseError(
        parsed.error === "invalid-json"
          ? "Invalid JSON file"
          : "The file must hold a non-empty array of entries",
      );
      return;
    }
    setFileData(parsed.candidates);
  }

  function handleUpload() {
    if (!fileData || name.trim() === "") {
      return;
    }
    upload.mutate(
      { provider: name.trim(), candidates: fileData },
      {
        onSuccess: () => {
          setFileData(null);
          setFileName(null);
          if (fileRef.current) {
            fileRef.current.value = "";
          }
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload source</DialogTitle>
          <DialogDescription>
            Rows are stored for review against what the catalog already holds.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <UploadFormatHelp />

          <div className="space-y-2">
            <Label htmlFor="source-file">JSON file</Label>
            <Input
              id="source-file"
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              onChange={(event) => void handleFileChange(event)}
            />
            {fileName && fileData && (
              <p className="text-muted-foreground text-sm">
                {fileName} ({fileData.length} card{fileData.length === 1 ? "" : "s"})
              </p>
            )}
            {parseError && (
              <p className="text-muted-foreground flex items-center gap-1 text-sm">
                <XIcon className="text-destructive size-4 shrink-0" />
                {parseError}
              </p>
            )}
          </div>

          <SourceNameField names={names} value={name} onChange={setName} />

          <Button
            disabled={!fileData || name.trim() === "" || upload.isPending}
            onClick={handleUpload}
          >
            {upload.isPending ? (
              <>
                <LoaderIcon className="size-4 animate-spin" />
                Uploading…
              </>
            ) : (
              "Upload"
            )}
          </Button>

          {upload.isSuccess && <UploadSummary data={upload.data} />}

          {upload.isError && (
            <p className="text-muted-foreground flex items-center gap-1 text-sm">
              <XIcon className="text-destructive size-4 shrink-0" />
              {upload.error.message}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
