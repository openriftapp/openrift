import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** One share action: a link out when `href` is set, a plain action otherwise. */
export function ShareButton({
  label,
  icon,
  onClick,
  href,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  href?: string;
}) {
  // Button-styled anchor, not Button-in-<a> (invalid) or BaseUI's `render` escape
  // hatch (it stamps role="button" on the anchor, so it stops announcing as a link).
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "w-full gap-2")}
      >
        {icon}
        {label}
      </a>
    );
  }

  return (
    <Button variant="outline" size="lg" className="w-full gap-2" onClick={onClick}>
      {icon}
      {label}
    </Button>
  );
}
