import { TriangleAlertIcon } from "lucide-react";

export function SearchProblems({ problems }: { problems: readonly string[] }) {
  if (problems.length === 0) {
    return null;
  }
  return (
    <ul className="border-border text-muted-foreground flex flex-col gap-1 border-b px-3 py-2 text-sm">
      {problems.map((problem) => (
        <li key={problem} className="flex items-start gap-2">
          <TriangleAlertIcon className="text-warning mt-0.5 size-4 shrink-0" />
          <span>{problem}</span>
        </li>
      ))}
    </ul>
  );
}
