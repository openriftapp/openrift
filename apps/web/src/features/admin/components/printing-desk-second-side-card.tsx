import type {
  DeskPrintingRow,
  DeskSecondSide,
  DeskSharedPrinting,
} from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatPrintingCode, isTbaCode } from "@openrift/shared/printing-code";
import { Link } from "@tanstack/react-router";
import { PencilIcon, XIcon } from "lucide-react";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PrintingDeskMarkerPicker } from "@/features/admin/components/printing-desk-marker-picker";
import { DeskSegmented } from "@/features/admin/components/printing-desk-shared";
import { SideSearch } from "@/features/admin/components/side-search";
import {
  useRemoveDeskSecondSide,
  useSetDeskSecondSide,
  useUpdateDeskPrinting,
} from "@/features/admin/hooks/use-printing-desk";
import { useSets } from "@/features/cards/hooks/use-sets";
import { useEnumOrders, useLanguageLabels, useLanguageList } from "@/hooks/use-enums";
import { errorText } from "@/lib/error-text";

export function SecondSideCard({ printing }: { printing: DeskPrintingRow }) {
  const setSecondSide = useSetDeskSecondSide();
  const removeSecondSide = useRemoveDeskSecondSide();
  const [editing, setEditing] = useState(false);
  const second = printing.secondSide;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sides</CardTitle>
        <CardDescription>
          A side that is on several printings is one record. Editing it changes every printing that
          shows it.
        </CardDescription>
        {second && printing.canEdit && !editing && (
          <CardAction>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon />
              Edit second side
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <section className="space-y-1">
          <h3 className="font-medium">First side</h3>
          <p>
            {printing.cardName} · {formatPrintingCode(printing.publicCode)}
          </p>
          <SharedWith printings={printing.sharedWith} />
        </section>

        <section className="space-y-2">
          <h3 className="font-medium">Second side</h3>
          {second && editing ? (
            <SecondSideEditFields
              printingId={printing.printingId}
              side={second}
              onDone={() => setEditing(false)}
            />
          ) : second ? (
            <>
              <SecondSideSummary side={second} />
              <SharedWith printings={second.sharedWith} />
              {printing.canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={removeSecondSide.isPending}
                  onClick={() => removeSecondSide.mutate({ printingId: printing.printingId })}
                >
                  <XIcon />
                  Make single-sided
                </Button>
              )}
            </>
          ) : printing.canEdit ? (
            <SideSearch
              excludeFaceIds={[printing.faceId]}
              disabled={setSecondSide.isPending}
              onPick={(side) =>
                setSecondSide.mutate({ printingId: printing.printingId, faceId: side.faceId })
              }
            />
          ) : (
            <p className="text-muted-foreground">None.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function SecondSideSummary({ side }: { side: DeskSecondSide }) {
  const { labels } = useEnumOrders();
  const languageLabels = useLanguageLabels();
  return (
    <p>
      {side.cardName} · {formatPrintingCode(side.publicCode)} · {side.setName} ·{" "}
      {enumLabel(labels.finishes, side.finish)} · {languageLabels[side.language] ?? side.language}
      {side.markerSlugs.length > 0 && ` · ${side.markerSlugs.join(", ")}`}
    </p>
  );
}

function SharedWith({ printings }: { printings: readonly DeskSharedPrinting[] }) {
  if (printings.length === 0) {
    return null;
  }
  return (
    <p className="text-muted-foreground text-sm">
      Also on{" "}
      {printings.map((shared, index) => (
        <span key={shared.printingId}>
          {index > 0 && ", "}
          <Link
            to="/admin/printing-desk/printings/$printingId"
            params={{ printingId: shared.printingId }}
            className="underline"
          >
            {formatPrintingCode(shared.publicCode)}
          </Link>
        </span>
      ))}
      .
    </p>
  );
}

function SecondSideEditFields({
  printingId,
  side,
  onDone,
}: {
  printingId: string;
  side: DeskSecondSide;
  onDone: () => void;
}) {
  const updatePrinting = useUpdateDeskPrinting();
  const { orders, labels } = useEnumOrders();
  const languages = useLanguageList();
  const { data: setData } = useSets();
  const [markerSlugs, setMarkerSlugs] = useState<string[]>([...side.markerSlugs]);
  const [codeTba, setCodeTba] = useState(isTbaCode(side.publicCode));
  const [shortCode, setShortCode] = useState(isTbaCode(side.publicCode) ? "" : side.shortCode);
  const [setId, setSetId] = useState(side.setId);
  const [language, setLanguage] = useState(side.language);
  const [finish, setFinish] = useState(side.finish);
  const [artist, setArtist] = useState(side.artist);
  const [formError, setFormError] = useState<string | null>(null);

  const canSubmit =
    (codeTba || shortCode.trim().length > 0) &&
    artist.trim().length > 0 &&
    !updatePrinting.isPending;

  async function submit() {
    setFormError(null);
    const update = {
      printingId,
      side: 2 as const,
      markerSlugs,
      codeTba,
      shortCode: codeTba ? undefined : shortCode.trim(),
      setId,
      language,
      finish,
      artist: artist.trim(),
    };
    try {
      await updatePrinting.mutateAsync(update);
      onDone();
    } catch (error) {
      setFormError(errorText(error, "Could not save the side."));
    }
  }

  return (
    <>
      <FieldGroup>
        <PrintingDeskMarkerPicker value={markerSlugs} onChange={setMarkerSlugs} />
        <Field>
          <FieldLabel htmlFor="side2-code">Card code</FieldLabel>
          <Input
            id="side2-code"
            value={shortCode}
            disabled={codeTba}
            onChange={(event) => setShortCode(event.target.value)}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id="side2-code-tba"
              checked={codeTba}
              onCheckedChange={(checked) => setCodeTba(checked === true)}
            />
            <FieldLabel htmlFor="side2-code-tba">Code not announced yet</FieldLabel>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="side2-set">Set</FieldLabel>
          <Select
            items={setData.sets.map((set) => ({ value: set.id, label: set.name }))}
            value={setId}
            onValueChange={(value) => {
              if (value !== null) {
                setSetId(value);
              }
            }}
          >
            <SelectTrigger id="side2-set" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setData.sets.map((set) => (
                <SelectItem key={set.id} value={set.id}>
                  {set.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="side2-language">Language</FieldLabel>
          <Select
            items={languages.map((entry) => ({ value: entry.code, label: entry.name }))}
            value={language}
            onValueChange={(value) => {
              if (value !== null) {
                setLanguage(value);
              }
            }}
          >
            <SelectTrigger id="side2-language" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((entry) => (
                <SelectItem key={entry.code} value={entry.code}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel>Finish</FieldLabel>
          <DeskSegmented
            ariaLabel="Finish of the second side"
            value={finish}
            onChange={setFinish}
            options={orders.finishes.map((slug) => ({
              value: slug,
              label: enumLabel(labels.finishes, slug),
            }))}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="side2-artist">Artist</FieldLabel>
          <Input
            id="side2-artist"
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
          />
        </Field>
      </FieldGroup>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-2">
        <Button disabled={!canSubmit} onClick={() => void submit()}>
          Save side
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </>
  );
}
