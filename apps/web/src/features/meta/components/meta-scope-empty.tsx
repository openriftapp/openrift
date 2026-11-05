import { TrophyIcon } from "lucide-react";
import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import type { MetaEra, MetaScope } from "@/features/meta/lib/meta-scope";
import { defaultEraId, ERA_ALL, ERA_CUSTOM, hasScopeFacets } from "@/features/meta/lib/meta-scope";
import { m } from "@/paraglide/messages.js";

/** The set era the scope narrows to, or undefined for all time, a custom range or no eras yet. */
function activeEra(scope: MetaScope, eras: readonly MetaEra[]): MetaEra | undefined {
  const id = scope.era ?? defaultEraId(eras);
  if (id === undefined || id === ERA_ALL || id === ERA_CUSTOM) {
    return undefined;
  }
  return eras.find((era) => era.id === id);
}

export function MetaScopeEmpty({
  scope,
  eras,
  setScope,
  onPickEra,
  fallback,
  filtered,
  className,
}: {
  scope: MetaScope;
  eras: readonly MetaEra[];
  setScope: (patch: Partial<MetaScope>) => void;
  onPickEra: () => void;
  fallback: ReactNode;
  filtered?: boolean;
  className?: string;
}) {
  const era = filtered || hasScopeFacets(scope) ? undefined : activeEra(scope, eras);
  if (era === undefined) {
    return (
      <Empty className={className}>
        <EmptyHeader>
          <EmptyDescription>{fallback}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <EmptyState
      className={className}
      icon={TrophyIcon}
      title={m.meta_scope_empty_title()}
      description={m.meta_scope_empty_description({ era: era.label })}
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => setScope({ era: ERA_ALL, from: undefined, to: undefined })}>
          {m.meta_scope_empty_show_all()}
        </Button>
        <Button variant="outline" onClick={onPickEra}>
          {m.meta_scope_empty_pick()}
        </Button>
      </div>
    </EmptyState>
  );
}
