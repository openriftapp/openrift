import type { CSSProperties } from "react";

import { useDomainColors } from "@/hooks/use-domain-colors";
import { getDomainGradientStyle } from "@/lib/domain";
import { cn } from "@/lib/utils";

const TICK_CLIP: CSSProperties = { clipPath: "polygon(0 0, 100% 0, 78% 100%, 0 100%)" };

export function CardFlavorBand({
  text,
  domains,
  surface,
}: {
  text: string;
  domains: string[];
  surface: "light" | "dark";
}) {
  const domainColors = useDomainColors();
  return (
    <div
      className={cn(
        "relative mb-[0.67cqw] py-[1.7cqw] pr-[3cqw] pl-[3.34cqw]",
        surface === "light" ? "bg-black/5" : "bg-black/30",
      )}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-[0.3cqw] h-[1.8cqw] w-[2.2cqw]"
        style={{ ...TICK_CLIP, ...getDomainGradientStyle(domains, "", domainColors) }}
      />
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[1.8cqw] bottom-0 left-[0.3cqw] w-[0.55cqw]",
          surface === "light" ? "bg-black/15" : "bg-white/20",
        )}
      />
      <p
        className={cn(
          "text-[0.97em] leading-[1.2] tracking-[-0.03em] italic",
          surface === "light" ? "text-black/70" : "text-white/60",
        )}
      >
        {text}
      </p>
    </div>
  );
}
