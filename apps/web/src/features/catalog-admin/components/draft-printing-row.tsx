import type { CandidatePrintingResponse } from "@openrift/shared/types/api/admin";
import { PencilIcon } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ImgWithFallback } from "@/components/ui/img-with-fallback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toEditText } from "@/features/catalog-admin/components/attention-change-list";
import type { RequiredPrintingField } from "@/features/catalog-admin/lib/printing-fields";
import {
  buildPrintingFieldsFromCandidate,
  missingPrintingFields,
  REQUIRED_PRINTING_FIELD_LABELS,
  REQUIRED_PRINTING_FIELDS,
  summarizeCandidatePrinting,
} from "@/features/catalog-admin/lib/printing-fields";

export type PrintingOverrides = Partial<Record<RequiredPrintingField, string>>;

function Thumb({ candidate }: { candidate: CandidatePrintingResponse }) {
  return (
    <span className="bg-muted/30 flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border">
      {candidate.imageUrl ? (
        <ImgWithFallback
          src={candidate.imageUrl}
          alt={candidate.shortCode}
          className="size-full object-contain"
          fallback={<span className="text-muted-foreground text-2xs">Failed</span>}
        />
      ) : (
        <span className="text-muted-foreground text-2xs">None</span>
      )}
    </span>
  );
}

interface DraftPrintingRowProps {
  candidate: CandidatePrintingResponse;
  sourceCount: number;
  isTicked: boolean;
  overrides: PrintingOverrides;
  onToggle: () => void;
  onOverride: (field: RequiredPrintingField, value: string) => void;
}

export function DraftPrintingRow({
  candidate,
  sourceCount,
  isTicked,
  overrides,
  onToggle,
  onOverride,
}: DraftPrintingRowProps) {
  const [editing, setEditing] = useState(false);
  const fields = buildPrintingFieldsFromCandidate(candidate, overrides);
  const missing = missingPrintingFields(fields);
  const record = fields as Record<string, unknown>;

  return (
    <li className="space-y-2 rounded-md px-3 py-2">
      <div className="flex items-center gap-3">
        <Checkbox
          id={`draft-printing-${candidate.id}`}
          checked={isTicked}
          className="shrink-0"
          onCheckedChange={onToggle}
        />
        <Thumb candidate={candidate} />
        <label
          htmlFor={`draft-printing-${candidate.id}`}
          className="min-w-0 flex-1 cursor-pointer space-y-0.5"
        >
          <span className="block truncate text-sm">
            {candidate.shortCode}
            {candidate.language ? ` · ${candidate.language.toUpperCase()}` : ""}
          </span>
          <span className="text-muted-foreground block truncate text-xs">
            {summarizeCandidatePrinting(candidate)} · {sourceCount} source
            {sourceCount === 1 ? "" : "s"}
          </span>
        </label>
        {!candidate.imageUrl && <Badge variant="destructive">No image</Badge>}
        {missing.length > 0 && (
          <Badge variant="warning">
            {missing.map((field) => REQUIRED_PRINTING_FIELD_LABELS[field]).join(", ")} missing
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit ${candidate.shortCode}`}
          onClick={() => setEditing(!editing)}
        >
          <PencilIcon />
        </Button>
      </div>

      {editing && (
        <div className="grid grid-cols-2 gap-3 pl-8 md:grid-cols-3">
          {REQUIRED_PRINTING_FIELDS.map((field) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`draft-${candidate.id}-${field}`}>
                {REQUIRED_PRINTING_FIELD_LABELS[field]}
              </Label>
              <Input
                id={`draft-${candidate.id}-${field}`}
                value={overrides[field] ?? toEditText(record[field])}
                onChange={(event) => onOverride(field, event.target.value)}
              />
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
