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
}

export function SelectModeActions({
  mode,
  view,
  isAllSelected,
  hasSelectableItems,
  onEnterSelect,
  onExitSelect,
  onSelectAll,
}: SelectModeActionsProps) {
  if (mode === "select") {
    return (
      <>
        <PageTopBarIconButton
          onClick={onSelectAll}
          aria-label={isAllSelected ? m.cards_deselect_all() : m.cards_select_all()}
          className="sm:hidden"
        >
          <CheckIcon className="size-4" />
        </PageTopBarIconButton>
        <PageTopBarButton onClick={onSelectAll} className="hidden sm:flex">
          <CheckIcon className="size-4" />
          {isAllSelected ? m.cards_deselect_all() : m.cards_select_all()}
        </PageTopBarButton>
        <PageTopBarIconButton
          onClick={onExitSelect}
          aria-label={m.common_done()}
          className="sm:hidden"
        >
          <XIcon className="size-4" />
        </PageTopBarIconButton>
        <PageTopBarPrimaryButton onClick={onExitSelect} className="hidden sm:flex">
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
        className="sm:hidden"
      >
        <CheckSquareIcon className="size-4" />
      </PageTopBarIconButton>
      <PageTopBarButton onClick={onEnterSelect} className="hidden sm:flex">
        <CheckSquareIcon className="size-4" />
        {m.cards_manage({ view })}
      </PageTopBarButton>
    </>
  );
}
