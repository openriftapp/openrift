import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { m } from "@/paraglide/messages.js";

export interface SharingConsent {
  allowDeckPublishing: boolean;
  allowNameSharing: boolean;
  allowRiotIdSharing: boolean;
}

export function SharingConsentFields({
  idPrefix,
  value,
  labels,
  onChange,
}: {
  idPrefix: string;
  value: SharingConsent;
  labels: { publish: string; name: string; riotId: string };
  onChange: (patch: Partial<SharingConsent>) => void;
}) {
  const dependents = [
    { key: "allowNameSharing", id: `${idPrefix}-share-name`, label: labels.name },
    { key: "allowRiotIdSharing", id: `${idPrefix}-share-riot-id`, label: labels.riotId },
  ] as const;

  return (
    <div className="flex flex-col gap-2">
      <Label>{m.tournaments_deck_check_public_sharing()}</Label>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${idPrefix}-publish`}
          checked={value.allowDeckPublishing}
          onCheckedChange={(checked) => onChange({ allowDeckPublishing: checked === true })}
        />
        <Label htmlFor={`${idPrefix}-publish`} className="font-normal">
          {labels.publish}
        </Label>
      </div>
      {dependents.map((field) => (
        <div key={field.key} className="ml-6 flex items-center gap-2">
          <Checkbox
            id={field.id}
            checked={value[field.key]}
            disabled={!value.allowDeckPublishing}
            onCheckedChange={(checked) => onChange({ [field.key]: checked === true })}
          />
          <Label
            htmlFor={field.id}
            className="font-normal data-[disabled]:opacity-50"
            data-disabled={!value.allowDeckPublishing || undefined}
          >
            {field.label}
          </Label>
        </div>
      ))}
    </div>
  );
}
