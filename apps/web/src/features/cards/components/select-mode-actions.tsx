import { CheckIcon, CheckSquareIcon, XIcon } from "lucide-react";

import {
  PageTopBarButton,
  PageTopBarIconButton,
  PageTopBarPrimaryButton,
} from "@/components/layout/page-top-bar";
import { m } from "@/paraglide/messages.js";

interface SelectModeActionsProps {
  mode: "browse" | "select";
  view: string;
  isAllSelected: boolean;
  hasSelectableItems: boolean;
  onEnterSelect: () => void;
  onExitSelect: () => void;
  onSelectAll: () => void;
  labelsFrom?: "sm" | "lg";
}

const BREAKPOINT_CLASSES = {
  sm: { icon: "sm:hidden", labelled: "hidden sm:flex" },
  lg: { icon: "lg:hidden", labelled: "hidden lg:flex" },
} as const;

export function SelectModeActions({
  mode,
  view,
  isAllSelected,
  hasSelectableItems,
  onEnterSelect,
  onExitSelect,
  onSelectAll,
  labelsFrom = "sm",
}: SelectModeActionsProps) {
  const classes = BREAKPOINT_CLASSES[labelsFrom];

  if (mode === "select") {
    return (
      <>
        <PageTopBarIconButton
          onClick={onSelectAll}
          aria-label={isAllSelected ? m.cards_deselect_all() : m.cards_select_all()}
          className={classes.icon}
        >
          <CheckIcon className="size-4" />
        </PageTopBarIconButton>
        <PageTopBarButton onClick={onSelectAll} className={classes.labelled}>
          <CheckIcon className="size-4" />
          {isAllSelected ? m.cards_deselect_all() : m.cards_select_all()}
        </PageTopBarButton>
        <PageTopBarIconButton
          onClick={onExitSelect}
          aria-label={m.common_done()}
          className={classes.icon}
        >
          <XIcon className="size-4" />
        </PageTopBarIconButton>
        <PageTopBarPrimaryButton onClick={onExitSelect} className={classes.labelled}>
          {m.common_done()}
        </PageTopBarPrimaryButton>
      </>
    );
  }

  if (!hasSelectableItems) {
    return null;
  }

  return (
    <>
      <PageTopBarIconButton
        onClick={onEnterSelect}
        aria-label={m.cards_manage({ view })}
        className={classes.icon}
      >
        <CheckSquareIcon className="size-4" />
      </PageTopBarIconButton>
      <PageTopBarButton onClick={onEnterSelect} className={classes.labelled}>
        <CheckSquareIcon className="size-4" />
        {m.cards_manage({ view })}
      </PageTopBarButton>
    </>
  );
}
