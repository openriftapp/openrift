import type { CopyResponse } from "@openrift/shared/types/api/collection";
import type { LucideIcon } from "lucide-react";
import { FileTextIcon, LinkIcon, LockIcon, PaintbrushIcon } from "lucide-react";

import { m } from "@/paraglide/messages.js";

// `content` is the fuller tooltip body that spacious surfaces show and compact
// ones ignore.
export interface CopyMarker {
  key: string;
  icon: LucideIcon;
  label: string;
  count?: number;
  content?: string;
}

// Shared by CopyMetadataStrip and CopySummary so they never drift. Excludes
// condition/grade and loan status: each surface renders those its own way.
export function copyMarkers(copy: CopyResponse): CopyMarker[] {
  const markers: CopyMarker[] = [];
  if (copy.isAltered) {
    markers.push({
      key: "altered",
      icon: PaintbrushIcon,
      label: m.collections_copies_marker_altered(),
    });
  }
  if (copy.notesPublic !== null) {
    markers.push({
      key: "note",
      icon: FileTextIcon,
      label: m.collections_copies_marker_note_public(),
      content: copy.notesPublic,
    });
  }
  if (copy.notesPrivate !== null) {
    markers.push({
      key: "private-note",
      icon: LockIcon,
      label: m.collections_copies_marker_note_private(),
      content: copy.notesPrivate,
    });
  }
  if (copy.links.length > 0) {
    markers.push({
      key: "links",
      icon: LinkIcon,
      label:
        copy.links.length === 1
          ? m.collections_copies_links_one({ count: copy.links.length })
          : m.collections_copies_links_other({ count: copy.links.length }),
      count: copy.links.length,
      content: copy.links.map((link) => link.label ?? link.url).join("\n"),
    });
  }
  return markers;
}

// Reuses copyMarkers so the "No details yet" fallback can't drift out of
// sync with the marker fields.
export function copyHasRecordedDetails(copy: CopyResponse): boolean {
  return (
    copy.onLoan ||
    // A reservation alone must still count as a recorded detail.
    copy.reserved ||
    (copy.grader !== null && copy.grade !== null) ||
    copy.condition !== null ||
    copyMarkers(copy).length > 0
  );
}
