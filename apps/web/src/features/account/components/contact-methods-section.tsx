import { CONTACT_METHOD_LABELS } from "@openrift/shared/contact-methods";
import { CONTACT_METHOD_TYPES } from "@openrift/shared/types/api/contact-method";
import type { ContactMethod, ContactMethodType } from "@openrift/shared/types/api/contact-method";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useContactMethods,
  useCreateContactMethod,
  useDeleteContactMethod,
  useUpdateContactMethod,
} from "@/features/account/hooks/use-contact-methods";
import { m } from "@/paraglide/messages.js";

const TYPE_ITEMS: { value: ContactMethodType; label: string }[] = CONTACT_METHOD_TYPES.map(
  (value) => ({ value, label: CONTACT_METHOD_LABELS[value] }),
);

function placeholderFor(type: ContactMethodType): string {
  const placeholders: Record<ContactMethodType, string> = {
    discord: m.profile_contacts_placeholder_discord(),
    signal: "+49 151 …",
    telegram: "@handle",
    whatsapp: "+49 151 …",
    phone: "+49 151 …",
    email: "you@example.com",
    in_person: m.profile_contacts_placeholder_in_person(),
    other: m.profile_contacts_placeholder_other(),
  };
  return placeholders[type];
}

function TypeSelect({
  value,
  onValueChange,
  id,
}: {
  value: ContactMethodType;
  onValueChange: (value: ContactMethodType) => void;
  id?: string;
}) {
  return (
    <Select
      items={TYPE_ITEMS}
      value={value}
      onValueChange={(next) => onValueChange(next as ContactMethodType)}
    >
      <SelectTrigger id={id} className="w-40 shrink-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TYPE_ITEMS.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ContactMethodRow({ method }: { method: ContactMethod }) {
  const [type, setType] = useState<ContactMethodType>(method.type);
  const [value, setValue] = useState(method.value);
  const update = useUpdateContactMethod();
  const remove = useDeleteContactMethod();

  const dirty = type !== method.type || value.trim() !== method.value;
  const canSave = dirty && value.trim().length > 0;

  async function handleSave() {
    try {
      await update.mutateAsync({ id: method.id, type, value: value.trim() });
      toast.success(m.profile_contacts_saved_toast());
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="flex min-h-8 items-center gap-2">
      <TypeSelect value={type} onValueChange={setType} />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholderFor(type)}
        maxLength={200}
        className="flex-1"
        aria-label={m.profile_contacts_value_aria()}
      />
      {canSave ? (
        <Button disabled={update.isPending} onClick={() => void handleSave()}>
          {m.profile_contacts_save()}
        </Button>
      ) : null}
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={m.profile_contacts_remove_aria()}
        disabled={remove.isPending}
        onClick={() => remove.mutate({ id: method.id })}
      >
        <Trash2Icon className="size-4" />
      </Button>
    </div>
  );
}

function AddContactMethod() {
  const [type, setType] = useState<ContactMethodType>("discord");
  const [value, setValue] = useState("");
  const create = useCreateContactMethod();

  const canAdd = value.trim().length > 0;

  async function handleAdd() {
    try {
      await create.mutateAsync({ type, value: value.trim() });
      setValue("");
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <div className="flex min-h-8 items-center gap-2">
      <TypeSelect value={type} onValueChange={setType} id="contact-add-type" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholderFor(type)}
        maxLength={200}
        className="flex-1"
        aria-label={m.profile_contacts_new_value_aria()}
      />
      <Button disabled={!canAdd || create.isPending} onClick={() => void handleAdd()}>
        <PlusIcon />
        {m.profile_contacts_add()}
      </Button>
    </div>
  );
}

export function ContactMethodsSection() {
  const { contactMethods } = useContactMethods();

  return (
    <SettingsSection
      id="contacts"
      title={m.profile_contacts_title()}
      description={m.profile_contacts_description()}
    >
      {contactMethods.map((method) => (
        <ContactMethodRow key={method.id} method={method} />
      ))}
      <AddContactMethod />
    </SettingsSection>
  );
}
