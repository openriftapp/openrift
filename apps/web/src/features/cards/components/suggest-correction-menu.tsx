import type { Printing } from "@openrift/shared/types/catalog";
import { Link } from "@tanstack/react-router";
import { FileTextIcon, ImageUpIcon, LayersIcon } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { m } from "@/paraglide/messages.js";

export function SuggestCorrectionMenu({
  cardSlug,
  printing,
  trigger,
  triggerClassName,
  children,
}: {
  cardSlug: string;
  printing?: Printing;
  trigger?: ReactElement;
  triggerClassName?: string;
  children: ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} className={triggerClassName}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link to="/contribute/card/$cardSlug" params={{ cardSlug }} />}>
          <FileTextIcon className="size-4" />
          {m.card_detail_suggest_correction_data()}
        </DropdownMenuItem>
        {printing && (
          <DropdownMenuItem
            render={
              <Link
                to="/contribute/card/$cardSlug/printing/$printingId"
                params={{ cardSlug, printingId: printing.printingId }}
              />
            }
          >
            <LayersIcon className="size-4" />
            {m.card_detail_suggest_correction_printing()}
          </DropdownMenuItem>
        )}
        {printing && printing.images.length > 0 && (
          <DropdownMenuItem
            render={
              <Link
                to="/contribute/card/$cardSlug/printing/$printingId/image"
                params={{ cardSlug, printingId: printing.printingId }}
                search={printing.side === 2 ? { side: 2 } : {}}
              />
            }
          >
            <ImageUpIcon className="size-4" />
            {m.card_detail_suggest_correction_image()}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
