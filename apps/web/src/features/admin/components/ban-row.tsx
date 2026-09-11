import type { CardBanResponse } from "@openrift/shared/contracts/admin/card-bans";
import { formatDay } from "@openrift/shared/format-date";
import { PencilIcon, XIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function BanRow({
  ban,
  onEdit,
  onRemove,
}: {
  ban: CardBanResponse;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <Badge variant="destructive">{ban.formatName}</Badge>
      <span className="text-muted-foreground text-sm">since {formatDay(ban.bannedAt)}</span>
      {ban.reason !== null && (
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm italic">
          {ban.reason}
        </span>
      )}
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit the ${ban.formatName} ban`}
        className="ml-auto"
        onClick={onEdit}
      >
        <PencilIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove the ${ban.formatName} ban`}
        onClick={onRemove}
      >
        <XIcon />
      </Button>
    </li>
  );
}
