import { Fragment, useState } from "react";

import { PageToc, PageTocMobileTrigger } from "@/components/layout/page-toc";
import { PageDescription } from "@/components/layout/page-top-bar";
import { Input } from "@/components/ui/input";
import { OrnamentRule } from "@/components/ui/ornament";
import type { DesignSection } from "@/features/admin/components/design/design-sections";
import { designTocItems } from "@/features/admin/components/design/design-sections";

export function DesignTierPage({
  description,
  sections,
}: {
  description: string;
  sections: readonly DesignSection[];
}) {
  const [filter, setFilter] = useState("");
  const items = designTocItems(sections, filter);

  return (
    <div className="flex gap-6">
      <div className="sticky top-(--sticky-top) hidden max-h-[calc(100vh-var(--sticky-top))] w-48 shrink-0 flex-col gap-2 lg:flex">
        <Input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter"
          aria-label="Filter design sections"
        />
        <PageToc
          items={items}
          className="static max-h-[calc(100vh-var(--sticky-top)-3.5rem)] w-full"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-10">
        <div className="flex items-start gap-3">
          <PageDescription>{description}</PageDescription>
          <PageTocMobileTrigger items={items} className="ml-auto shrink-0" />
        </div>

        {sections.map((section, index) => (
          <Fragment key={section.id}>
            {index > 0 && <OrnamentRule fade="tips" className="w-full" />}
            <section.Component />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
