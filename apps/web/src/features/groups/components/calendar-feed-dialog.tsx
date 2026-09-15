import type { FriendGroupCalendarFeedKind } from "@openrift/shared/types/api/friend-group";
import { CalendarPlusIcon, ExternalLinkIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { PageTopBarButton } from "@/components/layout/page-top-bar";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/ui/copy-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDisableFriendGroupCalendarFeed,
  useEnableFriendGroupCalendarFeed,
  useFriendGroupCalendarFeeds,
} from "@/features/groups/hooks/use-friend-group-calendar-feeds";
import {
  calendarFeedUrl,
  googleCalendarSubscribeUrl,
  webcalUrl,
} from "@/features/groups/lib/calendar-feed-links";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

interface CalendarFeedProps {
  slug: string;
  kind: FriendGroupCalendarFeedKind;
}

export function CalendarFeedButton({ slug, kind }: CalendarFeedProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PageTopBarButton aria-label={m.groups_calendar_feed_button()} onClick={() => setOpen(true)}>
        <CalendarPlusIcon className="size-4" />
        <span className="hidden sm:inline">{m.groups_calendar_feed_button()}</span>
      </PageTopBarButton>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <CalendarFeedDialogBody slug={slug} kind={kind} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CalendarFeedDialogBody({ slug, kind }: CalendarFeedProps) {
  const feeds = useFriendGroupCalendarFeeds(slug);
  const enableFeed = useEnableFriendGroupCalendarFeed();
  const disableFeed = useDisableFriendGroupCalendarFeed();
  const token = feeds.data?.items.find((item) => item.kind === kind)?.token;
  const feedUrl = token === undefined ? null : calendarFeedUrl(getSiteUrl(), token);

  let content: ReactNode;
  if (feeds.isPending) {
    content = <Skeleton className="h-9 w-full" />;
  } else if (feedUrl === null) {
    content = <p className="text-muted-foreground">{m.groups_calendar_feed_off_note()}</p>;
  } else {
    content = <CalendarFeedLink feedUrl={feedUrl} />;
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {kind === "tournaments"
            ? m.groups_calendar_feed_tournaments_title()
            : m.groups_calendar_feed_shop_events_title()}
        </DialogTitle>
        <DialogDescription>
          {kind === "tournaments"
            ? m.groups_calendar_feed_tournaments_description()
            : m.groups_calendar_feed_shop_events_description()}
        </DialogDescription>
      </DialogHeader>
      {content}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>{m.common_close()}</DialogClose>
        {feedUrl === null ? (
          <Button
            disabled={feeds.isPending || enableFeed.isPending}
            onClick={() => enableFeed.mutate({ slug, kind })}
          >
            {m.groups_calendar_feed_enable()}
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={disableFeed.isPending}
            onClick={() => disableFeed.mutate({ slug, kind })}
          >
            {m.groups_calendar_feed_disable()}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}

function CalendarFeedLink({ feedUrl }: { feedUrl: string }) {
  return (
    <div className="flex flex-col gap-3">
      <CopyField value={feedUrl} label={m.groups_calendar_feed_url_label()} mono />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- text label is inside the Button children
          render={<a href={webcalUrl(feedUrl)} />}
        >
          <CalendarPlusIcon />
          {m.groups_calendar_feed_open_app()}
        </Button>
        <Button
          variant="outline"
          // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- text label is inside the Button children
          render={<a href={googleCalendarSubscribeUrl(feedUrl)} target="_blank" rel="noreferrer" />}
        >
          <ExternalLinkIcon />
          {m.groups_calendar_feed_google()}
        </Button>
      </div>
      <p className="text-muted-foreground">{m.groups_calendar_feed_on_note()}</p>
    </div>
  );
}
