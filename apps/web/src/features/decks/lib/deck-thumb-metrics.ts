// Both styles read --deck-card-w, published by the overview's grid container,
// so every thumb lands on the same column grid; the fallback value covers list
// mode, which renders no grid container to set that variable.
export const PORTRAIT_THUMB_STYLE: React.CSSProperties = { width: "var(--deck-card-w, 7.5rem)" };

export const LANDSCAPE_THUMB_STYLE: React.CSSProperties = {
  width: "calc(var(--deck-card-w, 7.5rem) * var(--aspect-card-landscape))",
};

export const PORTRAIT_THUMB_CLASS = "aspect-card max-w-full";
export const LANDSCAPE_THUMB_CLASS = "aspect-card-landscape max-w-full";
