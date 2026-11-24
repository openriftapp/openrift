import type { ComponentProps } from "react";

/** Render-slot target for a new-tab link: `render={<ExternalAnchor href={url} />}`. The host supplies children and styling. */
function ExternalAnchor({ children, ...props }: ComponentProps<"a">) {
  return (
    <a target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  );
}

export { ExternalAnchor };
