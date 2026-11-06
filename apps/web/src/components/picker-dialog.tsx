import { CheckIcon, PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CommandEmpty } from "@/components/ui/command";
import {
  Dialog,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogForm } from "@/components/ui/dialog-form";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { PickerGroup, PickerList, PickerRow } from "@/components/ui/picker-list";
import { m } from "@/paraglide/messages.js";

export interface PickerOption {
  value: string;
  label: ReactNode;
  keywords?: string[];
  icon?: ReactNode;
  meta?: ReactNode;
  group?: string;
  disabled?: boolean;
}

export interface PickerSectionProps {
  options: PickerOption[];
  hint?: ReactNode;
  groups?: { key: string; label: string }[];
  selected?: string | null;
  checked?: ReadonlySet<string>;
  onPick: (value: string) => void;
  searchPlaceholder?: string;
  noMatchesText?: ReactNode;
  emptyText: ReactNode;
  disabled?: boolean;
}

export function PickerSection({
  options,
  hint,
  groups,
  selected = null,
  checked,
  onPick,
  searchPlaceholder,
  noMatchesText,
  emptyText,
  disabled = false,
}: PickerSectionProps) {
  const [highlightedId, setHighlightedId] = useState("");

  if (options.length === 0) {
    return emptyText === null ? null : (
      <Empty>
        <EmptyDescription>{emptyText}</EmptyDescription>
      </Empty>
    );
  }

  const renderRow = (option: PickerOption) => {
    const isChecked = checked?.has(option.value) ?? false;
    const isSelected = checked ? isChecked : selected === option.value;
    return (
      <PickerRow
        key={option.value}
        value={option.value}
        keywords={option.keywords}
        onSelect={() => onPick(option.value)}
        selected={isSelected}
        disabled={disabled || option.disabled}
        className="px-3 py-2"
      >
        {checked ? (
          <Checkbox checked={isChecked} tabIndex={-1} aria-hidden className="pointer-events-none" />
        ) : null}
        {option.icon}
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
        {option.meta ? (
          <span className="text-muted-foreground text-2xs max-w-1/2 shrink-0 truncate">
            {option.meta}
          </span>
        ) : null}
        {!checked && isSelected ? <CheckIcon className="size-4 shrink-0" /> : null}
      </PickerRow>
    );
  };

  const list = (
    <PickerList
      searchPlaceholder={searchPlaceholder}
      highlightedId={highlightedId}
      onHighlightChange={setHighlightedId}
    >
      {noMatchesText ? <CommandEmpty>{noMatchesText}</CommandEmpty> : null}
      {groups ? (
        <>
          {options
            .filter((option) => option.group === undefined)
            .map((option) => renderRow(option))}
          {groups.map((group) => {
            const rows = options.filter((option) => option.group === group.key);
            return rows.length === 0 ? null : (
              <PickerGroup key={group.key} label={group.label}>
                {rows.map((option) => renderRow(option))}
              </PickerGroup>
            );
          })}
        </>
      ) : (
        options.map((option) => renderRow(option))
      )}
    </PickerList>
  );

  return hint ? (
    <div className="space-y-2">
      <p className="text-sm">{hint}</p>
      {list}
    </div>
  ) : (
    list
  );
}

interface PickerCreateAction {
  key: string;
  label: string;
  placeholder?: string;
  onClick?: () => void;
}

export interface PickerCreate {
  actions: PickerCreateAction[];
  onCreate?: (key: string, name: string, done: () => void) => void;
  disabled?: boolean;
}

function PickerCreateRow({
  create,
  active,
  onActiveChange,
}: {
  create: PickerCreate;
  active: PickerCreateAction | null;
  onActiveChange: (action: PickerCreateAction | null) => void;
}) {
  const [name, setName] = useState("");
  const close = () => {
    onActiveChange(null);
    setName("");
  };

  if (active) {
    return (
      <DialogForm
        className="flex items-center gap-2 pt-1"
        onSubmit={() => {
          const trimmed = name.trim();
          if (trimmed && !create.disabled) {
            create.onCreate?.(active.key, trimmed, close);
          }
        }}
      >
        <Input
          autoFocus // oxlint-disable-line jsx-a11y/no-autofocus -- intentional inside dialog
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={active.placeholder}
        />
        <Button type="submit" size="sm" disabled={!name.trim() || create.disabled}>
          {m.common_create()}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={close}>
          {m.common_cancel()}
        </Button>
      </DialogForm>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {create.actions.map((action) => (
        <Button
          key={action.key}
          variant="ghost"
          size="sm"
          className="text-muted-foreground justify-start"
          onClick={() => (action.placeholder ? onActiveChange(action) : action.onClick?.())}
          disabled={create.disabled}
        >
          <PlusIcon className="size-3.5" />
          {action.label}
        </Button>
      ))}
    </div>
  );
}

interface PickerConfirm {
  label: string;
  pendingLabel: string;
  onConfirm: (value: string) => void;
}

type PickerDialogMode =
  | { onPick: (value: string) => void; confirm?: undefined; create?: PickerCreate }
  | { confirm: PickerConfirm; onPick?: undefined; create?: undefined };

type PickerDialogBodyProps = Omit<PickerSectionProps, "onPick" | "selected" | "checked" | "hint"> &
  PickerDialogMode & {
    alert?: boolean;
    title: ReactNode;
    description?: ReactNode;
    before?: ReactNode;
    after?: ReactNode;
    pending?: boolean;
  };

export function PickerDialogBody({
  alert = false,
  title,
  description,
  before,
  after,
  pending = false,
  disabled = false,
  onPick,
  confirm,
  create,
  emptyText,
  ...section
}: PickerDialogBodyProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [activeCreate, setActiveCreate] = useState<PickerCreateAction | null>(null);

  const Title = alert ? AlertDialogTitle : DialogTitle;
  const Description = alert ? AlertDialogDescription : DialogDescription;
  const Cancel = alert ? AlertDialogCancel : DialogCancel;

  const pick = (value: string) => {
    if (pending) {
      return;
    }
    if (confirm) {
      setSelected(value);
      return;
    }
    onPick(value);
  };

  const body = (
    <>
      <div className="flex flex-col gap-1">
        <Title>{title}</Title>
        {description ? <Description>{description}</Description> : null}
      </div>
      {before}
      <PickerSection
        {...section}
        emptyText={activeCreate ? null : emptyText}
        selected={confirm ? selected : null}
        onPick={pick}
        disabled={pending || disabled}
      />
      {after}
      {create ? (
        <PickerCreateRow create={create} active={activeCreate} onActiveChange={setActiveCreate} />
      ) : null}
      <div className="flex justify-end gap-2 pt-2">
        <Cancel disabled={pending}>{m.common_cancel()}</Cancel>
        {confirm ? (
          <Button type="submit" disabled={selected === null || pending}>
            {pending ? confirm.pendingLabel : confirm.label}
          </Button>
        ) : null}
      </div>
    </>
  );

  return confirm ? (
    <DialogForm onSubmit={() => selected !== null && !pending && confirm.onConfirm(selected)}>
      {body}
    </DialogForm>
  ) : (
    body
  );
}

type PickerDialogProps = PickerDialogBodyProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PickerDialog({ open, onOpenChange, ...body }: PickerDialogProps) {
  const [session, setSession] = useState({ open, count: 0 });
  if (session.open !== open) {
    setSession({ open, count: open ? session.count + 1 : session.count });
  }

  if (body.alert) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent>
          <PickerDialogBody key={session.count} {...body} />
        </AlertDialogContent>
      </AlertDialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <PickerDialogBody key={session.count} {...body} />
      </DialogContent>
    </Dialog>
  );
}
