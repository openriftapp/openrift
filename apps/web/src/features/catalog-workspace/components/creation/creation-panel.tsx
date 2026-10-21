import type { DeskReleasePrecision } from "@openrift/shared/contracts/admin/printing-desk";
import { enumLabel } from "@openrift/shared/enum-label";
import { formatReleasePeriod, normalizeToPeriodStart } from "@openrift/shared/set-release";
import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PrintingDeskChannelPicker } from "@/features/admin/components/printing-desk-channel-picker";
import { PrintingDeskMarkerPicker } from "@/features/admin/components/printing-desk-marker-picker";
import { DeskSegmented } from "@/features/admin/components/printing-desk-shared";
import { useDistributionChannels } from "@/features/admin/hooks/use-distribution-channels";
import { useDistinctArtists } from "@/features/cards/hooks/use-distinct-artists";
import { useSets } from "@/features/cards/hooks/use-sets";
import {
  CreationImages,
  CreationImagesSummary,
} from "@/features/catalog-workspace/components/creation/creation-images";
import { FacePicker } from "@/features/catalog-workspace/components/creation/face-picker";
import { FieldRow } from "@/features/catalog-workspace/components/record/field-row";
import { RecordSection } from "@/features/catalog-workspace/components/record/record-pane";
import type {
  CreationDraft,
  DraftFace,
  DraftFaceFields,
  DraftImage,
  DraftPrintingFields,
  DuplicateCandidate,
} from "@/features/catalog-workspace/lib/creation-draft";
import {
  faceToNew,
  MAX_DRAFT_FACES,
  removeFace,
  updateFace,
} from "@/features/catalog-workspace/lib/creation-draft";
import { useEnumOrders, useLanguageList } from "@/hooks/use-enums";

const PRECISION_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
] as const satisfies readonly { value: DeskReleasePrecision; label: string }[];

type EditingRow = `face-${number}` | "images" | "printing";

function SlugSelect({
  id,
  value,
  items,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  items: readonly { value: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select
      items={items}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) {
          onChange(next);
        }
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function useFaceSummary() {
  const { labels } = useEnumOrders();
  return (fields: DraftFaceFields) =>
    [
      fields.codeTba ? "Code TBA" : fields.shortCode,
      fields.language,
      fields.finish.length > 0 ? enumLabel(labels.finishes, fields.finish) : "",
      fields.rarity.length > 0 ? enumLabel(labels.rarities, fields.rarity) : "",
    ]
      .filter((part) => part.length > 0)
      .join(" · ");
}

function FaceEditor({
  idPrefix,
  fields,
  target,
  onChange,
}: {
  idPrefix: string;
  fields: DraftFaceFields;
  target: CreationDraft["target"];
  onChange: (fields: DraftFaceFields) => void;
}) {
  const { orders, labels } = useEnumOrders();
  const languages = useLanguageList();
  const { data: setData } = useSets();
  const { data: artistData } = useDistinctArtists();
  const setItems = setData.sets.map((set) => ({ value: set.id, label: set.name }));
  const setValue =
    fields.setId.length > 0
      ? fields.setId
      : (setData.sets.find((set) => set.slug === fields.setSlug)?.id ?? "");

  return (
    <div className="@container/face-form">
      <FieldGroup className="@2xl/face-form:grid @2xl/face-form:grid-cols-2 @2xl/face-form:gap-x-6">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-code`}>Card code</FieldLabel>
          <Input
            id={`${idPrefix}-code`}
            value={fields.shortCode}
            disabled={fields.codeTba}
            placeholder="OGN-101p"
            onChange={(event) => onChange({ ...fields, shortCode: event.target.value })}
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${idPrefix}-code-tba`}
              checked={fields.codeTba}
              onCheckedChange={(checked) => onChange({ ...fields, codeTba: checked === true })}
            />
            <FieldLabel htmlFor={`${idPrefix}-code-tba`}>Code not announced yet</FieldLabel>
          </div>
        </Field>

        {target === "accept" && (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-public-code`}>Public code</FieldLabel>
            <Input
              id={`${idPrefix}-public-code`}
              value={fields.publicCode}
              placeholder="OGN-101p/298"
              onChange={(event) => onChange({ ...fields, publicCode: event.target.value })}
            />
          </Field>
        )}

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-set`}>Set</FieldLabel>
          <SlugSelect
            id={`${idPrefix}-set`}
            value={setValue}
            items={setItems}
            onChange={(id) => {
              const set = setData.sets.find((entry) => entry.id === id);
              onChange({
                ...fields,
                setId: id,
                setSlug: set?.slug ?? "",
                setName: set?.name ?? null,
              });
            }}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-language`}>Language</FieldLabel>
          <SlugSelect
            id={`${idPrefix}-language`}
            value={fields.language}
            items={languages.map((entry) => ({ value: entry.code, label: entry.name }))}
            onChange={(language) => onChange({ ...fields, language })}
          />
        </Field>

        <Field>
          <FieldLabel>Finish</FieldLabel>
          <DeskSegmented
            ariaLabel="Finish"
            value={fields.finish}
            onChange={(finish) => onChange({ ...fields, finish })}
            options={orders.finishes.map((slug) => ({
              value: slug,
              label: enumLabel(labels.finishes, slug),
            }))}
          />
        </Field>

        {target === "accept" ? (
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-rarity`}>Rarity</FieldLabel>
            <SlugSelect
              id={`${idPrefix}-rarity`}
              value={fields.rarity}
              items={orders.rarities.map((slug) => ({
                value: slug,
                label: enumLabel(labels.rarities, slug),
              }))}
              onChange={(rarity) => onChange({ ...fields, rarity })}
            />
          </Field>
        ) : (
          fields.rarity.length > 0 && (
            <Field>
              <FieldLabel>Rarity</FieldLabel>
              <p>{enumLabel(labels.rarities, fields.rarity)}</p>
              <FieldDescription>Copied from the base printing.</FieldDescription>
            </Field>
          )
        )}

        <Field>
          <FieldLabel htmlFor={`${idPrefix}-artist`}>Artist</FieldLabel>
          <Input
            id={`${idPrefix}-artist`}
            list={`${idPrefix}-artist-options`}
            value={fields.artist}
            onChange={(event) => onChange({ ...fields, artist: event.target.value })}
          />
          <datalist id={`${idPrefix}-artist-options`}>
            {artistData.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </datalist>
        </Field>

        <div className="@2xl/face-form:col-span-2">
          <PrintingDeskMarkerPicker
            value={fields.markerSlugs}
            onChange={(markerSlugs) => onChange({ ...fields, markerSlugs })}
          />
        </div>
      </FieldGroup>
    </div>
  );
}

function PrintingEditor({
  printing,
  onChange,
}: {
  printing: DraftPrintingFields;
  onChange: (printing: DraftPrintingFields) => void;
}) {
  const { orders, labels } = useEnumOrders();
  const release = printing.releasedAt
    ? normalizeToPeriodStart({
        releasedAt: printing.releasedAt,
        precision: printing.releasePrecision,
      })
    : null;

  return (
    <div className="@container/printing-form">
      <FieldGroup className="@2xl/printing-form:grid @2xl/printing-form:grid-cols-2 @2xl/printing-form:gap-x-6">
        <div className="@2xl/printing-form:col-span-2">
          <PrintingDeskChannelPicker
            value={printing.distributionChannelSlugs}
            onChange={(distributionChannelSlugs) =>
              onChange({ ...printing, distributionChannelSlugs })
            }
          />
        </div>

        <Field>
          <FieldLabel htmlFor="creation-size">Size</FieldLabel>
          <SlugSelect
            id="creation-size"
            value={printing.size}
            items={orders.cardSizes.map((slug) => ({
              value: slug,
              label: enumLabel(labels.cardSizes, slug),
            }))}
            onChange={(size) => onChange({ ...printing, size })}
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="creation-announced-at">Announced on</FieldLabel>
          <DatePicker
            className="w-44"
            value={printing.announcedAt}
            onValueChange={(announcedAt) => onChange({ ...printing, announcedAt })}
            onClear={() => onChange({ ...printing, announcedAt: null })}
          />
        </Field>

        <Field className="@2xl/printing-form:col-span-2">
          <FieldLabel htmlFor="creation-released-at">Available from</FieldLabel>
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              className="w-44"
              value={printing.releasedAt}
              onValueChange={(releasedAt) => onChange({ ...printing, releasedAt })}
              onClear={() => onChange({ ...printing, releasedAt: null })}
            />
            <DeskSegmented
              ariaLabel="How exact the date is"
              value={printing.releasePrecision === "quarter" ? "month" : printing.releasePrecision}
              onChange={(releasePrecision) => onChange({ ...printing, releasePrecision })}
              options={PRECISION_OPTIONS}
            />
          </div>
          {release !== null && release.precision !== "day" && (
            <FieldDescription>{formatReleasePeriod(release)}</FieldDescription>
          )}
        </Field>

        <Field className="@2xl/printing-form:col-span-2">
          <FieldLabel htmlFor="creation-note">Note</FieldLabel>
          <Textarea
            id="creation-note"
            value={printing.comment}
            placeholder="Handed out at the door, one per player."
            onChange={(event) => onChange({ ...printing, comment: event.target.value })}
          />
        </Field>
      </FieldGroup>
    </div>
  );
}

function usePrintingSummary() {
  const { labels } = useEnumOrders();
  const { data } = useDistributionChannels();
  const channelLabels = new Map(
    data.distributionChannels.map((channel) => [channel.slug, channel.label]),
  );
  return (printing: DraftPrintingFields) => {
    const parts = [
      printing.size.length > 0 ? enumLabel(labels.cardSizes, printing.size) : "",
      printing.distributionChannelSlugs.map((slug) => channelLabels.get(slug) ?? slug).join(", "),
      printing.announcedAt === null ? "" : `announced ${printing.announcedAt}`,
      printing.releasedAt === null
        ? ""
        : `available ${formatReleasePeriod(
            normalizeToPeriodStart({
              releasedAt: printing.releasedAt,
              precision: printing.releasePrecision,
            }),
          )}`,
    ].filter((part) => part.length > 0);
    return parts.length > 0 ? parts.join(" · ") : "No details yet";
  };
}

function DuplicateWarnings({
  candidates,
  onMerge,
}: {
  candidates: readonly DuplicateCandidate[];
  onMerge?: (candidate: DuplicateCandidate) => void;
}) {
  return (
    <>
      {candidates.map((candidate) => (
        <Alert key={candidate.printingId} variant="warning">
          <TriangleAlertIcon />
          <AlertDescription>
            <strong>Possible duplicate:</strong> {candidate.publicCode} · {candidate.language}{" "}
            {candidate.identical
              ? "has the same code, finish, size and markers. Creating this one would fail."
              : candidate.kind === "same-language"
                ? "has the same code stem and channels."
                : "has the same code stem and channels. A different language is a separate printing."}
          </AlertDescription>
          <AlertAction>
            {onMerge ? (
              <Button variant="outline" size="sm" onClick={() => onMerge(candidate)}>
                Merge into it
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link
                    to="/admin/workspace/printings/$printingId"
                    params={{ printingId: candidate.printingId }}
                  />
                }
              >
                Open it
              </Button>
            )}
          </AlertAction>
        </Alert>
      ))}
    </>
  );
}

function FaceValue({
  face,
  summary,
  actions,
}: {
  face: DraftFace;
  summary: (fields: DraftFaceFields) => string;
  actions: ReactNode;
}) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      {face.mode === "new" ? (
        <span>New face {summary(face.fields)}</span>
      ) : (
        <span>
          {face.label} <Badge variant="secondary">Existing face</Badge>
        </span>
      )}
      {actions}
    </span>
  );
}

export function CreationPanel({
  draft,
  onChange,
  duplicateCandidates = [],
  layout = "summary",
  onChangeCard,
  onMergeDuplicate,
  disabled = false,
}: {
  draft: CreationDraft;
  onChange: (draft: CreationDraft) => void;
  duplicateCandidates?: DuplicateCandidate[];
  layout?: "summary" | "steps";
  onChangeCard?: () => void;
  onMergeDuplicate?: (candidate: DuplicateCandidate) => void;
  disabled?: boolean;
}) {
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [pickerFor, setPickerFor] = useState<number | null>(null);
  const faceSummary = useFaceSummary();
  const printingSummary = usePrintingSummary();
  const steps = layout === "steps";
  const cardSlug = draft.card?.mode === "existing" ? draft.card.slug : undefined;
  const canAddFace = draft.faces.length < MAX_DRAFT_FACES;

  function setFaceFields(index: number, fields: DraftFaceFields) {
    const face = draft.faces[index];
    if (face) {
      onChange(updateFace(draft, index, { ...face, fields }));
    }
  }

  function setFaceImages(index: number, images: DraftImage[]) {
    const face = draft.faces[index];
    if (face) {
      onChange(updateFace(draft, index, { ...face, images }));
    }
  }

  function pickFace(index: number, picked: DraftFace) {
    const current = draft.faces[index];
    const face = { ...picked, images: current?.images ?? [] };
    onChange(
      index < draft.faces.length
        ? updateFace(draft, index, face)
        : { ...draft, faces: [...draft.faces, face] },
    );
  }

  function faceActions(face: DraftFace, index: number) {
    return (
      <>
        {face.mode === "existing" && index === 0 && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(updateFace(draft, index, faceToNew(face)))}
          >
            New face from it
          </Button>
        )}
        {(index > 0 || cardSlug !== undefined) && (
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setPickerFor(index)}
          >
            Pick existing face…
          </Button>
        )}
        {index > 0 && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={() => onChange(removeFace(draft, index))}
          >
            Remove
          </Button>
        )}
      </>
    );
  }

  function faceEditor(face: DraftFace, index: number) {
    return face.mode === "new" ? (
      <FaceEditor
        idPrefix={`creation-face-${index}`}
        fields={face.fields}
        target={draft.target}
        onChange={(fields) => setFaceFields(index, fields)}
      />
    ) : undefined;
  }

  const otherFaceIds = (index: number) =>
    draft.faces.flatMap((face, i) =>
      i !== index && face.mode === "existing" ? [face.faceId] : [],
    );

  const picker = (
    <FacePicker
      open={pickerFor !== null}
      onOpenChange={(open) => {
        if (!open) {
          setPickerFor(null);
        }
      }}
      cardSlug={pickerFor === 0 ? cardSlug : undefined}
      excludeFaceIds={pickerFor === null ? [] : otherFaceIds(pickerFor)}
      title={pickerFor === 0 ? "Pick existing face" : "Pick the second face"}
      onPick={(face) => {
        if (pickerFor !== null) {
          pickFace(pickerFor, face);
        }
      }}
    />
  );

  const addSecondFace = canAddFace && (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() => setPickerFor(draft.faces.length)}
    >
      Add second face…
    </Button>
  );

  const footnote = (
    <p className="text-muted-foreground text-sm">
      Picking an existing face makes its fields read-only here. A second face is always an existing
      one.
    </p>
  );

  if (steps) {
    return (
      <div className="flex flex-col gap-3.5">
        <DuplicateWarnings candidates={duplicateCandidates} onMerge={onMergeDuplicate} />
        <RecordSection title="Faces" actions={addSecondFace}>
          <div className="flex flex-col gap-4">
            {draft.faces.map((face, index) => (
              <div
                key={index}
                className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0"
              >
                <p className="font-medium">{index === 0 ? "Face" : "Second face"}</p>
                <FaceValue face={face} summary={faceSummary} actions={faceActions(face, index)} />
                {faceEditor(face, index)}
              </div>
            ))}
            {footnote}
          </div>
        </RecordSection>
        <RecordSection title="Images">
          <div className="flex flex-col gap-4">
            {draft.faces.map((face, index) => (
              <div key={index} className="flex flex-col gap-2">
                {draft.faces.length > 1 && (
                  <p className="font-medium">{index === 0 ? "Face" : "Second face"}</p>
                )}
                <CreationImages
                  images={face.images}
                  disabled={disabled}
                  onChange={(images) => setFaceImages(index, images)}
                />
              </div>
            ))}
          </div>
        </RecordSection>
        <RecordSection title="Printing details">
          <PrintingEditor
            printing={draft.printing}
            onChange={(printing) => onChange({ ...draft, printing })}
          />
        </RecordSection>
        {picker}
      </div>
    );
  }

  const done = (
    <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
      Done
    </Button>
  );

  return (
    <div className="flex flex-col gap-3.5">
      <DuplicateWarnings candidates={duplicateCandidates} onMerge={onMergeDuplicate} />
      <RecordSection title="What gets created" actions={addSecondFace}>
        <FieldRow
          label="Card"
          value={
            draft.card === null ? (
              <span className="text-muted-foreground">No card picked</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                {draft.card.mode === "new" ? `New card ${draft.card.name}` : draft.card.name}
                {draft.card.mode === "existing" && draft.card.note !== undefined && (
                  <Badge variant="secondary">{draft.card.note}</Badge>
                )}
                {draft.card.mode === "new" && draft.card.summary.length > 0 && (
                  <span className="text-muted-foreground">{draft.card.summary}</span>
                )}
              </span>
            )
          }
          onEdit={onChangeCard}
        />
        {draft.faces.map((face, index) => {
          const row: EditingRow = `face-${index}`;
          const editor = editing === row ? faceEditor(face, index) : undefined;
          return (
            <FieldRow
              key={index}
              label={index === 0 ? "Face" : "Second face"}
              value={
                <FaceValue face={face} summary={faceSummary} actions={faceActions(face, index)} />
              }
              onEdit={face.mode === "new" && !disabled ? () => setEditing(row) : undefined}
              editing={
                editor === undefined ? undefined : (
                  <div className="flex flex-col gap-2">
                    {editor}
                    <div>{done}</div>
                  </div>
                )
              }
            />
          );
        })}
        <FieldRow
          label="Images"
          value={
            <div className="flex flex-col gap-1">
              {draft.faces.map((face, index) => (
                <CreationImagesSummary key={index} images={face.images} />
              ))}
            </div>
          }
          onEdit={disabled ? undefined : () => setEditing("images")}
          editing={
            editing === "images" ? (
              <div className="flex flex-col gap-3">
                {draft.faces.map((face, index) => (
                  <div key={index} className="flex flex-col gap-2">
                    {draft.faces.length > 1 && (
                      <p className="font-medium">{index === 0 ? "Face" : "Second face"}</p>
                    )}
                    <CreationImages
                      images={face.images}
                      onChange={(images) => setFaceImages(index, images)}
                    />
                  </div>
                ))}
                <div>{done}</div>
              </div>
            ) : undefined
          }
        />
        <FieldRow
          label="Printing"
          value={printingSummary(draft.printing)}
          onEdit={disabled ? undefined : () => setEditing("printing")}
          editing={
            editing === "printing" ? (
              <div className="flex flex-col gap-2">
                <PrintingEditor
                  printing={draft.printing}
                  onChange={(printing) => onChange({ ...draft, printing })}
                />
                <div>{done}</div>
              </div>
            ) : undefined
          }
        />
        <div className="pt-2">{footnote}</div>
      </RecordSection>
      {picker}
    </div>
  );
}
