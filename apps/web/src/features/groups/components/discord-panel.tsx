import { formatDay } from "@openrift/shared/format-date";
import { BotIcon, CheckIcon, CopyIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { SettingsSection } from "@/components/layout/settings-section";
import { Button } from "@/components/ui/button";
import { RowList, RowListItem } from "@/components/ui/row-list";
import {
  useCreateFriendGroupDiscordLinkCode,
  useDeleteFriendGroupDiscordLink,
  useFriendGroupDiscordLinks,
} from "@/features/groups/hooks/use-friend-group-discord";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { m } from "@/paraglide/messages.js";

// While a code is outstanding the links list polls, so the redeem shows up without a reload.
export function DiscordPanel({ slug }: { slug: string }) {
  const createCode = useCreateFriendGroupDiscordLinkCode();
  const removeLink = useDeleteFriendGroupDiscordLink();
  const [pending, setPending] = useState<{
    code: string;
    knownLinkIds: string[];
  } | null>(null);
  const { copied, copy } = useCopyToClipboard();

  const { data } = useFriendGroupDiscordLinks(slug, {
    refetchInterval: pending === null ? undefined : 5000,
  });
  const redeemed =
    pending !== null && data.items.some((item) => !pending.knownLinkIds.includes(item.id));

  async function handleGenerate() {
    try {
      const result = await createCode.mutateAsync(slug);
      setPending({ code: result.code, knownLinkIds: data.items.map((item) => item.id) });
    } catch {
      /* Reported by the global mutation error toast. */
    }
  }

  return (
    <SettingsSection
      id="discord"
      className="scroll-mt-28"
      title={
        <span className="flex items-center gap-2">
          <BotIcon className="size-4" />
          {m.groups_discord_title()}
        </span>
      }
      description={m.groups_discord_description()}
    >
      {data.items.length > 0 ? (
        <RowList>
          {data.items.map((item) => (
            <RowListItem key={item.id} className="justify-between">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">
                  {item.guildName ?? m.groups_discord_server_fallback({ id: item.guildId })}
                </span>
                <span className="text-muted-foreground text-sm">
                  {m.groups_discord_linked_on({ date: formatDay(item.linkedAt) })}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => removeLink.mutate({ slug, linkId: item.id })}
                disabled={removeLink.isPending}
              >
                <Trash2Icon className="size-4" />
                {m.groups_discord_unlink()}
              </Button>
            </RowListItem>
          ))}
        </RowList>
      ) : (
        <p className="text-muted-foreground text-sm">{m.groups_discord_none_linked()}</p>
      )}
      {pending === null ? (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleGenerate()}
            disabled={createCode.isPending}
          >
            {m.groups_discord_generate()}
          </Button>
        </div>
      ) : redeemed ? (
        <p className="text-sm">{m.groups_discord_redeemed()}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">{m.groups_discord_run_command()}</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted rounded-md px-2 py-1 font-mono text-sm">
              /link code:{pending.code}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void copy(`/link code:${pending.code}`)}
            >
              {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
              {copied ? m.common_copied() : m.common_copy()}
            </Button>
          </div>
        </div>
      )}
    </SettingsSection>
  );
}
