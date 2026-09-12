import { unsubscribeContract } from "@openrift/shared/contracts/unsubscribe";
import { createLazyFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TextLink } from "@/components/ui/text-link";
import { apiOrpcClient } from "@/lib/server-fns/orpc-client";
import { m } from "@/paraglide/messages.js";

const confirmUnsubscribeFn = createServerFn({ method: "POST" })
  .validator((token: string) => token)
  .handler(({ data }) => apiOrpcClient(unsubscribeContract).confirm({ token: data }));

export const Route = createLazyFileRoute("/unsubscribe")({
  component: UnsubscribePage,
});

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-3">
      <div className="w-full max-w-md">
        <Link to="/" className="text-primary mb-4 inline-block text-lg font-bold">
          OpenRift
        </Link>
        <Card>
          <CardContent className="flex flex-col items-start gap-4 p-6 text-left">
            <h1 className="font-semibold">{title}</h1>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UnsubscribePage() {
  const preview = Route.useLoaderData();
  const { token } = Route.useSearch();
  const [status, setStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [doneLabel, setDoneLabel] = useState<string | null>(null);

  async function handleConfirm() {
    setStatus("submitting");
    try {
      const result = await confirmUnsubscribeFn({ data: token });
      setDoneLabel(result.channelLabel);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (!preview.valid) {
    return (
      <Shell title={m.unsubscribe_invalid_title()}>
        <p className="text-muted-foreground text-sm">{m.unsubscribe_invalid_body()}</p>
        <Button render={<Link to="/" />}>{m.unsubscribe_go_home()}</Button>
      </Shell>
    );
  }

  if (status === "done") {
    return (
      <Shell title={m.unsubscribe_done_title()}>
        <p className="text-muted-foreground text-sm">
          {m.unsubscribe_done_body({ channel: doneLabel ?? preview.channelLabel ?? "" })}
        </p>
        <Button render={<Link to="/" />}>{m.unsubscribe_go_home()}</Button>
      </Shell>
    );
  }

  if (preview.alreadyUnsubscribed) {
    return (
      <Shell title={m.unsubscribe_already_title()}>
        <p className="text-muted-foreground text-sm">
          {m.unsubscribe_already_body({ channel: preview.channelLabel ?? "" })}
        </p>
        <Button render={<Link to="/" />}>{m.unsubscribe_go_home()}</Button>
      </Shell>
    );
  }

  return (
    <Shell title={m.unsubscribe_confirm_title()}>
      <p className="text-muted-foreground text-sm">
        {m.unsubscribe_confirm_body({ channel: preview.channelLabel ?? "" })}
      </p>
      {status === "error" && (
        <Alert variant="destructive">
          <AlertDescription>{m.unsubscribe_error()}</AlertDescription>
        </Alert>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={() => void handleConfirm()} disabled={status === "submitting"}>
          {status === "submitting" ? m.unsubscribe_submitting() : m.unsubscribe_submit()}
        </Button>
        <TextLink variant="muted" className="text-sm" render={<Link to="/" />}>
          {m.unsubscribe_keep()}
        </TextLink>
      </div>
    </Shell>
  );
}
