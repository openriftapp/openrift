import { LanguageChip } from "@/components/language-chip";
import { SectionHeading } from "@/components/ui/section-heading";
import { useLanguages } from "@/hooks/use-languages";
import { cn } from "@/lib/utils";

export function PrintingLanguageHeader({ code, className }: { code: string; className?: string }) {
  const { data } = useLanguages();
  const name = data.languages.find((language) => language.code === code)?.name ?? code;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <LanguageChip code={code} />
      <SectionHeading as="h3" size="sm">
        {name}
      </SectionHeading>
    </div>
  );
}
