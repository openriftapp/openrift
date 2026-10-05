import type { VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { buttonVariants } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { m } from "@/paraglide/messages.js";

type CopySource =
  | { value: string; getText?: never }
  | { getText: () => string | Promise<string>; value?: never };

type CopyTextButtonProps = CopySource & {
  label: string;
  /** Keeps line breaks intact through iOS Safari's clipboard. */
  normalizeLineBreaks?: boolean;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  icon?: LucideIcon;
  iconOnly?: boolean;
  className?: string;
};

async function resolveText(
  value: string | undefined,
  getText: (() => string | Promise<string>) | undefined,
): Promise<string | null> {
  try {
    return value ?? (await getText?.()) ?? "";
  } catch {
    return null;
  }
}

/**
 * A copy button with its own inline "Copied" feedback. Each instance holds
 * its own feedback state, so several can sit side by side without sharing a
 * checkmark.
 */
export function CopyTextButton({
  label,
  value,
  getText,
  normalizeLineBreaks = true,
  variant = "outline",
  size,
  icon: Icon = CopyIcon,
  iconOnly = false,
  className,
}: CopyTextButtonProps) {
  const { copied, copy } = useCopyToClipboard();
  const currentLabel = copied ? m.common_copied() : label;

  const handleCopy = async () => {
    const text = await resolveText(value, getText);
    if (text === null) {
      return;
    }
    const payload = normalizeLineBreaks ? text.replaceAll("\n", "\r\n") : text;
    await copy(payload);
  };

  return (
    <Button
      variant={variant}
      size={size ?? (iconOnly ? "icon" : "default")}
      className={className}
      aria-label={iconOnly ? currentLabel : undefined}
      onClick={() => void handleCopy()}
    >
      {copied ? <CheckIcon /> : <Icon />}
      {iconOnly ? null : currentLabel}
    </Button>
  );
}
