import { XIcon } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";

import { PaletteScopeToken } from "@/components/command-palette/palette-scope-token";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { m } from "@/paraglide/messages.js";

export function QuickAddSearchField({
  inputRef,
  scopeLabel,
  ariaLabel,
  placeholder,
  value,
  onValueChange,
  onKeyDown,
  onClear,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  scopeLabel: string;
  ariaLabel: string;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  return (
    <InputGroup className="h-11 border-0 has-[[data-slot=input-group-control]:focus-visible]:ring-0 dark:bg-transparent">
      <InputGroupAddon align="inline-start">
        <PaletteScopeToken label={scopeLabel} />
      </InputGroupAddon>
      <InputGroupInput
        ref={inputRef}
        type="text"
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="text-base sm:text-sm"
        autoFocus // oxlint-disable-line jsx-a11y/no-autofocus -- command palette, always focused on open
      />
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" onClick={onClear} aria-label={m.palette_clear_search()}>
            <XIcon className="size-4" />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  );
}
