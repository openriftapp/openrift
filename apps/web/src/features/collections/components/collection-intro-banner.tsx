import { Link } from "@tanstack/react-router";
import { InfoIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { TextLink } from "@/components/ui/text-link";
import { m } from "@/paraglide/messages.js";

export function CollectionIntroBanner({
  showLibrary,
  onDismiss,
}: {
  showLibrary: boolean;
  onDismiss: () => void;
}) {
  return (
    <Callout className="mb-3 flex items-start gap-2 py-2 pr-2 pl-3">
      <InfoIcon className="text-primary mt-1 size-4 shrink-0" />
      <p className="min-w-0 flex-1 py-0.5">
        <span className="text-muted-foreground">
          {showLibrary ? m.collections_intro_line_library() : m.collections_intro_line_owned()}
        </span>{" "}
        <TextLink render={<Link to="/help/$slug" params={{ slug: "collections" }} />}>
          {m.collections_intro_how_it_works()}
        </TextLink>
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDismiss}
        aria-label={m.layout_intro_dismiss()}
        className="text-muted-foreground shrink-0"
      >
        <XIcon className="size-4" />
      </Button>
    </Callout>
  );
}
