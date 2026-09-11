import { LanguageChip } from "@/components/language-chip";
import { useLanguages } from "@/hooks/use-languages";
import { cn } from "@/lib/utils";

export function PrintingLanguageHeader({ code, className }: { code: string; className?: string }) {
  const { data } = useLanguages();
  const name = data.languages.find((language) => language.code === code)?.name ?? code;

  return (
    <div className={cn("bg-muted/30 flex items-center gap-2 px-3 py-1", className)}>
      <LanguageChip code={code} />
      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {name}
      </span>
    </div>
  );
}
