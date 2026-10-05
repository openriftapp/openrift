import { legendDisplayName } from "@openrift/shared/card-name";
import { pluralize } from "@openrift/shared/strings";
import { LinkIcon } from "lucide-react";
import { toast } from "sonner";

import { useResolveMetaOverlayName } from "@/features/admin/hooks/use-admin-meta-overlays";
import { CatalogCardPicker } from "@/features/cards/components/catalog-card-picker";

// The pick is stored as a name alias, so every future upload from any provider
// matches it without asking again; rematching runs immediately for other staged decks.
export function MetaCardNamePicker({ name }: { name: string }) {
  const resolveName = useResolveMetaOverlayName();

  async function handlePick(cardId: string, cardName: string) {
    let resolved = 0;
    try {
      const result = await resolveName.mutateAsync({ name, cardId });
      resolved = result.updated;
    } catch {
      // Reported by the global mutation error toast.
      return;
    }
    toast.success(`"${name}" now means ${cardName}`, {
      description: `${resolved} staged card ${pluralize(resolved, "row")} resolved.`,
    });
  }

  return (
    <CatalogCardPicker
      label="Link card"
      icon={<LinkIcon />}
      size="xs"
      disabled={resolveName.isPending}
      onPick={(card, _catalog, cardId) => void handlePick(cardId, legendDisplayName(card))}
    />
  );
}
