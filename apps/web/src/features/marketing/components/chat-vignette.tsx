import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { m } from "@/paraglide/messages.js";

import { Vignette, VignetteHeading } from "./vignette-parts";

const QUERY = "!card viktor innovator";

const REPLY = "Viktor, Innovator — Champion Unit · Mind · Energy 4 · Might 3 · Power 1 —";
const REPLY_URL = "openrift.app/cards/viktor-innovator";

function backlog() {
  return [
    { name: "riftcaptain", text: m.marketing_chat_backlog_top_end() },
    { name: "mothbite", text: m.marketing_chat_backlog_what_does() },
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

        <ChatLine name="mothbite">
          <span
            className="text-primary motion-safe:animate-vignette-type inline-block font-medium"
            style={{ animationTimingFunction: `steps(${QUERY.length}, end)` }}
          >
            {QUERY}
          </span>
        </ChatLine>

        <div className="motion-safe:animate-vignette-reply flex flex-col gap-1">
          <p className="text-sm leading-snug">
            <span className="text-primary font-semibold">Nightbot</span>
            <Badge variant="subtle" className="mx-1.5 align-middle">
              BOT
            </Badge>
            <span className="text-muted-foreground">: </span>
            <span className="text-foreground/90">{REPLY}</span>{" "}
            <span className="text-primary break-all underline underline-offset-2">{REPLY_URL}</span>
          </p>
        </div>
      </div>

      <p className="text-muted-foreground text-xs">{m.marketing_chat_footnote()}</p>
    </Vignette>
  );
}
