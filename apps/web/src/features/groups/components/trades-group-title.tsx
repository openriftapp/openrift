import { ParaglideMessage } from "@inlang/paraglide-js-react";
import { Link } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages.js";

const ALL_GROUPS = "all";

export function TradesGroupTitle({
  groups,
  groupSlug,
  onGroupChange,
}: {
  groups: readonly { slug: string; name: string }[];
  groupSlug: string | null;
  onGroupChange: (groupSlug: string | null) => void;
}) {
  if (groups.length === 0) {
    return m.trades_title();
  }
  const single = groups.length === 1;
  const selected = single ? groups[0] : groups.find((group) => group.slug === groupSlug);
  return (
    <ParaglideMessage
      message={m.trades_title_in}
      inputs={{ group: selected?.name ?? m.trades_title_all_groups() }}
      markup={{
        picker: ({ children }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  className="text-primary decoration-primary/50 hover:text-primary aria-expanded:text-primary hover:decoration-primary h-auto px-1 align-baseline font-[inherit] text-[length:inherit] leading-[inherit] whitespace-normal underline decoration-dashed decoration-2 underline-offset-8 hover:bg-transparent aria-expanded:bg-transparent dark:hover:bg-transparent"
                />
              }
            >
              {children}
              <ChevronDownIcon className="size-[0.6em]!" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {single ? null : (
                <DropdownMenuRadioGroup
                  value={selected?.slug ?? ALL_GROUPS}
                  onValueChange={(value: string) =>
                    onGroupChange(value === ALL_GROUPS ? null : value)
                  }
                >
                  <DropdownMenuRadioItem value={ALL_GROUPS}>
                    {m.trades_market_all_groups()}
                  </DropdownMenuRadioItem>
                  {groups.map((group) => (
                    <DropdownMenuRadioItem key={group.slug} value={group.slug}>
                      {group.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              )}
              {selected === undefined ? null : (
                <>
                  {single ? null : <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    render={<Link to="/groups/$slug" params={{ slug: selected.slug }} />}
                  >
                    {m.trades_group_menu_open_group({ group: selected.name })}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      }}
    />
  );
}
