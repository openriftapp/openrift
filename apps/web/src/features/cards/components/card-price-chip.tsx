// Sized in cqw, so the parent must be an `@container` the width of the card.
function portraitCqw(value: number, isLandscape: boolean): string {
  return isLandscape ? `${(value * 63) / 88}cqw` : `${value}cqw`;
}

export function CardPriceChip({ text, isLandscape }: { text: string; isLandscape: boolean }) {
  return (
    <span
      className="bg-background/85 text-muted-foreground absolute leading-tight font-medium tabular-nums"
      style={{
        fontSize: `max(10px, ${portraitCqw(7.5, isLandscape)})`,
        padding: `${portraitCqw(0.5, isLandscape)} ${portraitCqw(2.5, isLandscape)}`,
        borderRadius: portraitCqw(3, isLandscape),
        left: portraitCqw(2, isLandscape),
        bottom: portraitCqw(2, isLandscape),
      }}
    >
      {text}
    </span>
  );
}
