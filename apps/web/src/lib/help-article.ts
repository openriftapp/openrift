import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";

import type { Locale } from "@/paraglide/runtime.js";

interface HelpArticleLabels {
  title: string;
  description: string;
}

export interface HelpArticle {
  slug: string;
  labels: (options?: { locale?: Locale }) => HelpArticleLabels;
  icon: LucideIcon;
  component: () => Promise<{ default: ComponentType }>;
  featureFlag?: string;
}
