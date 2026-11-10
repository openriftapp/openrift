import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { Heading } from "@/components/heading";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Button, buttonVariants } from "@/components/ui/button";
import { useOnline } from "@/hooks/use-online";
import { useUserId } from "@/hooks/use-session";
import { needsFullReload, routeErrorKind } from "@/lib/route-error-kind";
import { errorStatus } from "@/lib/server-fns/api-error";
import { forceReload } from "@/lib/stale-bundle-reload";
import { cn, FOOTER_PADDING_NO_TOP } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

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
  devError,
  children,
}: {
  emoji?: string;
  heading: string;
  subtext?: string;
  className?: string;
  goHome?: boolean;
  devError?: string;
  children?: ReactNode;
}) {
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
      {children}
      {goHome && (
        <a href="/" className={buttonVariants()}>
          {m.error_go_home()}
        </a>
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

function useRetry(error: unknown, onRetry?: () => void): () => void {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();
  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  return () => {
    if (needsFullReload(error)) {
      forceReload("retry after a stale bundle error");
      return;
    }
    if (onRetry) {
      onRetry();
      return;
    }
    queryErrorResetBoundary.reset();
    void router.invalidate();
  };
}

function BackLink({ primary }: { primary: boolean }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  return (
    <Link
      to="/"
      className={buttonVariants({ variant: primary ? "default" : "outline" })}
      onClick={(event) => {
        if (canGoBack) {
          event.preventDefault();
          router.history.back();
        }
      }}
    >
      {m.common_back()}
    </Link>
  );
}

function SignInLink() {
  const href = useLocation({ select: (location) => location.href });
  return (
    <Link
      rel="nofollow"
      to="/login"
      search={{ redirect: href, email: undefined }}
      className={buttonVariants()}
    >
      {m.common_sign_in()}
    </Link>
  );
}

/**
 * The page-level error state. Try again re-runs the route loaders; callers
 * outside a route error boundary pass `onRetry` to refetch their own data.
 */
export function RouteErrorFallback({
  error,
  onRetry,
  details,
  className = "flex-1",
}: {
  error?: unknown;
  onRetry?: () => void;
  details?: string;
  className?: string;
}) {
  const online = useOnline();
  const signedIn = useUserId() !== null && errorStatus(error) !== 401;
  const retry = useRetry(error, onRetry);
  const kind = routeErrorKind(error, online);

  const forbidden = kind === "forbidden";
  const actions = (
    <div className="flex gap-3">
      {!forbidden && (
        <Button type="button" onClick={retry}>
          {m.error_try_again()}
        </Button>
      )}
      {forbidden && !signedIn && <SignInLink />}
      <BackLink primary={forbidden && signedIn} />
    </div>
  );

  if (kind === "offline") {
    return (
      <ErrorMessageLayout
        heading={m.error_offline_heading()}
        subtext={m.collections_copies_network_error()}
        className={className}
      >
        {actions}
      </ErrorMessageLayout>
    );
  }
  if (forbidden) {
    return (
      <ErrorMessageLayout
        heading={m.error_forbidden_heading()}
        subtext={signedIn ? m.error_forbidden_subtext() : m.error_forbidden_subtext_signed_out()}
        className={className}
      >
        {actions}
      </ErrorMessageLayout>
    );
  }
  return (
    <ErrorMessageLayout
      heading={m.error_failed_heading()}
      subtext={m.error_failed_subtext()}
      className={className}
      devError={details ?? thrownMessage(error)}
    >
      {actions}
    </ErrorMessageLayout>
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
