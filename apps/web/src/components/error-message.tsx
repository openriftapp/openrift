import { useRouterState } from "@tanstack/react-router";
import { useState } from "react";

import { Heading } from "@/components/heading";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn, FOOTER_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

export function errorHeadings(): string[] {
  return [
    m.error_heading_rift_collapsed(),
    m.error_heading_misprint(),
    m.error_heading_blank(),
    m.error_heading_void(),
    m.error_heading_not_supposed(),
    m.error_heading_drew_bug(),
    m.error_heading_cant_grade(),
    m.error_heading_not_ideal(),
    m.error_heading_yeah_bug(),
  ];
}

export function errorSubtexts(): string[] {
  return [
    m.error_subtext_shuffled_wrong(),
    m.error_subtext_binder(),
    m.error_subtext_giveth(),
    m.error_subtext_fell_through(),
    m.error_subtext_bad_days(),
    m.error_subtext_looking_into_it(),
    m.error_subtext_not_your_fault(),
    m.error_subtext_rest_is_fine(),
  ];
}

export function errorEmojis(): string[] {
  return [":(", String.raw`¯\_(ツ)_/¯`, m.error_emoji_misprint(), m.error_emoji_damaged()];
}

function notFoundHeadings(): string[] {
  return [
    m.error_notfound_heading_dust(),
    m.error_notfound_heading_never_printed(),
    m.error_notfound_heading_lost(),
    m.error_notfound_heading_page_not_found(),
    m.error_notfound_heading_off_map(),
    m.error_notfound_heading_doesnt_exist(),
    m.error_notfound_heading_no_card(),
    m.error_notfound_heading_no_record(),
  ];
}

function notFoundSubtexts(): string[] {
  return [
    m.error_notfound_subtext_gone(),
    m.error_notfound_subtext_double_check(),
    m.error_notfound_subtext_no_set(),
    m.error_notfound_subtext_maybe(),
    m.error_notfound_subtext_come_up_empty(),
    m.error_notfound_subtext_url_wrong(),
  ];
}

function notFoundEmojis(): string[] {
  return ["?", "404", m.error_emoji_missing(), String.raw`¯\_(ツ)_/¯`];
}

function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index++) {
    hash = Math.trunc(hash * 31 + (input.codePointAt(index) ?? 0));
  }
  return hash;
}

export function pick<T>(arr: T[], seed: string): T {
  const value = arr[Math.abs(hashString(seed)) % arr.length];
  if (value === undefined) {
    throw new Error("pick() from empty array");
  }
  return value;
}

function DevErrorDetails({ error }: { error: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2 flex max-w-lg flex-col items-center gap-2">
      <Button
        type="button"
        variant="link-muted"
        className="h-auto px-0 text-xs"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? m.error_hide_details() : m.error_show_details()}
      </Button>
      {open && (
        <pre className="bg-muted text-muted-foreground max-h-60 w-full overflow-auto rounded-md p-3 text-left text-xs break-words whitespace-pre-wrap">
          {error}
        </pre>
      )}
    </div>
  );
}

export function ErrorMessageLayout({
  emoji,
  heading,
  subtext,
  className,
  goHome,
  reload,
  devError,
}: {
  emoji?: string;
  heading: string;
  subtext?: string;
  className?: string;
  goHome?: boolean;
  reload?: boolean;
  devError?: string;
}) {
  const hasActions = goHome || reload;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 px-4 py-8 text-center",
        className,
      )}
    >
      {emoji && (
        <div className="text-muted-foreground text-4xl font-medium select-none">{emoji}</div>
      )}
      <Heading level={1}>{heading}</Heading>
      {subtext && <p className="text-muted-foreground max-w-md text-sm">{subtext}</p>}
      {hasActions && (
        <div className="flex gap-3">
          {goHome && (
            <a href="/" className={buttonVariants()}>
              {m.error_go_home()}
            </a>
          )}
          {reload && (
            <Button
              type="button"
              variant={goHome ? "outline" : "default"}
              onClick={() => globalThis.location.reload()}
            >
              {m.error_reshuffle()}
            </Button>
          )}
        </div>
      )}
      {devError && <DevErrorDetails error={devError} />}
    </div>
  );
}

// A route can be handed anything as its error, including an object with no message.
function thrownMessage(thrown: unknown): string | undefined {
  if (thrown instanceof Error) {
    return thrown.message;
  }
  if (typeof thrown === "string" || typeof thrown === "number") {
    return String(thrown);
  }
  return undefined;
}

export function RouteErrorFallback({ error }: { error?: unknown }) {
  const message = thrownMessage(error);
  const seed = message ?? "unknown";
  return (
    <ErrorMessageLayout
      emoji={pick(errorEmojis(), `${seed}:emoji`)}
      heading={pick(errorHeadings(), `${seed}:heading`)}
      subtext={pick(errorSubtexts(), `${seed}:subtext`)}
      className="flex-1"
      reload
      devError={message}
    />
  );
}

export function NotFoundFallback() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <ErrorMessageLayout
      emoji={pick(notFoundEmojis(), `${pathname}:emoji`)}
      heading={pick(notFoundHeadings(), `${pathname}:heading`)}
      subtext={pick(notFoundSubtexts(), `${pathname}:subtext`)}
      className="flex-1"
      goHome
    />
  );
}

export function RouteNotFoundFallback() {
  return (
    <>
      <Header />
      <NotFoundFallback />
      <Footer className={FOOTER_PADDING_NO_TOP} />
    </>
  );
}
