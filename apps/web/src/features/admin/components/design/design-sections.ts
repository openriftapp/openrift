import { matchesTextPhrase } from "@openrift/shared/search-fold";
import type { ComponentType } from "react";

import type { PageTocItem } from "@/components/layout/page-toc";

export interface DesignGroup {
  id: string;
  title: string;
}

export interface DesignSection {
  id: string;
  title: string;
  Component: ComponentType;
  groups: readonly DesignGroup[];
}

export function designTocItems(sections: readonly DesignSection[], filter: string): PageTocItem[] {
  return sections.flatMap((section) => {
    const sectionHit = matchesTextPhrase(filter, [section.title]);
    const groups = sectionHit
      ? section.groups
      : section.groups.filter((group) => matchesTextPhrase(filter, [group.title]));
    if (!sectionHit && groups.length === 0) {
      return [];
    }
    return [
      { id: section.id, label: section.title },
      ...groups.map((group) => ({ id: group.id, label: group.title, level: 1 })),
    ];
  });
}
