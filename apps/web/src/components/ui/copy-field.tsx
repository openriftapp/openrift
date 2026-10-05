import type { ReactNode } from "react";

import { CopyTextButton } from "@/components/copy-text-button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

// Hand-authored primitive (not shadcn-scaffolded).
//
// The generic form of the row ShareLinkRow builds for share links: a read-only
// value plus a Copy button that confirms inline. Use this for anything else
// meant to be copied verbatim — a chat-bot command, a code, a snippet. Share
// links keep going through ShareLinkRow, which adds the QR affordance on top.

interface CopyFieldProps {
  /** The text shown and copied. */
  value: string;
  /** Accessible name for the read-only field, e.g. "Nightbot command". */
  "aria-label": string;
  /**
   * Monospace the value. For anything the user reads character by character
   * before pasting it somewhere that cares (commands, codes, URLs).
   */
  mono?: boolean;
  className?: string;
  inputClassName?: string;
  children?: ReactNode;
}

/**
 * A read-only value with a Copy button.
 *
 * The value stays selectable, so a denied clipboard write (insecure context,
 * Safari losing the gesture window) still leaves the user a way to copy it by
 * hand — which is why the failure is swallowed rather than surfaced.
 *
 * @returns The copy row.
 */
export function CopyField({
  value,
  "aria-label": label,
  mono = false,
  className,
  inputClassName,
  children,
}: CopyFieldProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Input
        value={value}
        readOnly
        aria-label={label}
        className={cn("min-w-0 flex-1", mono && "font-mono text-sm", inputClassName)}
        onFocus={(event) => event.currentTarget.select()}
      />
      <CopyTextButton value={value} label={m.common_copy()} normalizeLineBreaks={false} />
      {children}
    </div>
  );
}
