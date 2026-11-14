import { cardUrl } from "@openrift/shared/site-paths";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { FIXTURE_CHAT } from "@/features/marketing/lib/vignette-fixtures";
import { getSiteUrl } from "@/lib/site-config";
import { m } from "@/paraglide/messages.js";

import { Vignette, VignetteHeading } from "./vignette-parts";

const CHAT = FIXTURE_CHAT;

function backlog() {
  return [
    { name: CHAT.firstViewer, text: m.marketing_chat_backlog_top_end() },
    { name: CHAT.askingViewer, text: m.marketing_chat_backlog_what_does() },
  ];
}

function ChatLine({ name, children }: { name: string; children: ReactNode }) {
  return (
    <p className="text-sm leading-snug">
      <span className="text-foreground/70 font-semibold">{name}</span>
      <span className="text-muted-foreground">: </span>
      {children}
    </p>
  );
}

export function ChatVignette() {
  return (
    <Vignette>
      <VignetteHeading>{m.marketing_chat_heading()}</VignetteHeading>

      <div className="flex flex-col gap-2">
        {backlog().map((line) => (
          <ChatLine key={line.name} name={line.name}>
            <span className="text-muted-foreground">{line.text}</span>
          </ChatLine>
        ))}

        <ChatLine name={CHAT.askingViewer}>
          <span
            className="text-primary motion-safe:animate-vignette-type inline-block font-medium"
            style={{ animationTimingFunction: `steps(${CHAT.query.length}, end)` }}
          >
            {CHAT.query}
          </span>
        </ChatLine>

        <div className="motion-safe:animate-vignette-reply flex flex-col gap-1">
          <p className="text-sm leading-snug">
            <span className="text-primary font-semibold">{CHAT.botName}</span>
            <Badge variant="subtle" className="mx-1.5 align-middle">
              {CHAT.botBadge}
            </Badge>
            <span className="text-muted-foreground">: </span>
            <span className="text-foreground/90">{CHAT.reply}</span>{" "}
            <span className="text-primary break-all underline underline-offset-2">
              {cardUrl(getSiteUrl(), CHAT.cardSlug)}
            </span>
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{m.marketing_chat_footnote()}</p>
    </Vignette>
  );
}
