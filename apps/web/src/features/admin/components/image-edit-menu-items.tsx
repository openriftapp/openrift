import { ContrastIcon, CropIcon, RotateCcwIcon, RotateCwIcon, ScissorsIcon } from "lucide-react";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ImageEditMenuItems({
  image,
  disabled,
  onRotate,
  onStraighten,
  onToggleTrim,
  onToggleLevels,
}: {
  image: { needsTrim: boolean; needsLevels: boolean };
  disabled: boolean;
  onRotate: (degrees: 90 | 270) => void;
  onStraighten: () => void;
  onToggleTrim: () => void;
  onToggleLevels: () => void;
}) {
  return (
    <>
      <DropdownMenuItem disabled={disabled} onClick={() => onRotate(270)}>
        <RotateCcwIcon />
        Rotate left
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={() => onRotate(90)}>
        <RotateCwIcon />
        Rotate right
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={onStraighten}>
        <CropIcon />
        Straighten…
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={onToggleTrim}>
        <ScissorsIcon />
        {image.needsTrim ? "Turn auto-trim off" : "Turn auto-trim on"}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={disabled} onClick={onToggleLevels}>
        <ContrastIcon />
        {image.needsLevels ? "Turn contrast off" : "Turn contrast on"}
      </DropdownMenuItem>
    </>
  );
}
