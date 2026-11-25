export const WORKSPACE_REASONS = [
  "source-difference",
  "contributor-proposal",
  "new-card",
  "new-printing",
  "new-image",
  "image-rehost-failed",
  "listing",
] as const;

export const WORKSPACE_RECORD_FILTER_VALUES = [
  "promo",
  "no-image",
  "mine",
  "substitute",
  "shared",
  "needs-review",
] as const;

export const WORKSPACE_RECORD_SORTS = ["name", "code", "finish", "language", "updated"] as const;
