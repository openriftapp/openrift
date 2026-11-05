import { Link } from "@tanstack/react-router";

import { IntroBanner } from "@/components/intro-banner";
import { TextLink } from "@/components/ui/text-link";
import { useCoarsePointer } from "@/hooks/use-coarse-pointer";
import { m } from "@/paraglide/messages.js";

function introLine(showLibrary: boolean, coarsePointer: boolean): string {
  if (!showLibrary) {
    return m.collections_intro_line_owned();
  }
  return coarsePointer
    ? m.collections_intro_line_library()
    : m.collections_intro_line_library_click();
}

export function CollectionIntroBanner({
  showLibrary,
  onDismiss,
}: {
  showLibrary: boolean;
  onDismiss: () => void;
}) {
  const coarsePointer = useCoarsePointer();
  return (
    <IntroBanner
      className="mb-3"
      title={m.collections_intro_title()}
      lead={
        <>
          {introLine(showLibrary, coarsePointer)}{" "}
          <TextLink render={<Link to="/help/$slug" params={{ slug: "collections" }} />}>
            {m.collections_intro_how_it_works()}
          </TextLink>
        </>
      }
      onDismiss={onDismiss}
    />
  );
}
