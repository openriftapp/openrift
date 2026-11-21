import { ConfirmActionButton } from "@/components/confirm-action-dialog";
import { ShareLinkRow } from "@/components/share/share-link-row";
import { Button } from "@/components/ui/button";
import { runReportedMutation } from "@/lib/run-reported-mutation";

export function TokenLinkControl({
  url,
  label,
  enableLabel,
  enableAriaLabel,
  disableLabel,
  disableAriaLabel,
  disableTitle,
  disableDescription,
  disableConfirmLabel,
  locked = false,
  disableLocked = false,
  pending,
  defaultQrOpen = false,
  onSet,
}: {
  url: string | null;
  label: string;
  enableLabel: string;
  enableAriaLabel?: string;
  disableLabel: string;
  disableAriaLabel?: string;
  disableTitle: string;
  disableDescription: string;
  disableConfirmLabel: string;
  locked?: boolean;
  disableLocked?: boolean;
  pending: boolean;
  defaultQrOpen?: boolean;
  onSet: (enabled: boolean) => Promise<unknown>;
}) {
  if (url === null) {
    return (
      <Button
        className="w-fit"
        aria-label={enableAriaLabel}
        disabled={locked}
        pending={pending}
        onClick={() => void runReportedMutation(() => onSet(true))}
      >
        {enableLabel}
      </Button>
    );
  }
  return (
    <ShareLinkRow
      url={url}
      label={label}
      defaultQrOpen={defaultQrOpen}
      actions={
        <ConfirmActionButton
          trigger={<Button variant="ghost-destructive" aria-label={disableAriaLabel} />}
          disabled={disableLocked || pending}
          title={disableTitle}
          description={disableDescription}
          confirmLabel={disableConfirmLabel}
          onConfirm={() => onSet(false)}
        >
          {disableLabel}
        </ConfirmActionButton>
      }
    />
  );
}
