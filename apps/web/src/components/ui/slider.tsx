import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  "aria-label": ariaLabel, // custom: extract aria-label to forward to thumbs
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = value ?? defaultValue ?? [min, max]; // custom: a numeric value is one thumb
  const thumbCount = Array.isArray(_values) ? _values.length : 1; // custom: a numeric value is one thumb

  return (
    <SliderPrimitive.Root
      className={cn(
        // custom: half-thumb padding keeps centered thumbs in the edge footprint; drop with the edge revert
        "data-horizontal:w-full data-horizontal:px-1.5 data-vertical:h-full data-vertical:py-1.5",
        className,
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      // custom: center, not edge: Base UI 1.9.0 edge thumbs that mount inside a hidden parent (the
      // phone filter drawer) stay invisible; back to edge once a release ships mui/base-ui#6000
      thumbAlignment="center"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-muted relative grow overflow-hidden rounded-full select-none data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: thumbCount }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            aria-label={ariaLabel} // custom: forward aria-label for accessibility
            // custom: ring-2 thumb halos — app-wide focus width (scaffold ships ring-3)
            className="border-ring ring-ring/50 relative block size-3 shrink-0 rounded-full border bg-white transition-[color,box-shadow] select-none after:absolute after:-inset-2 hover:ring-2 focus-visible:ring-2 focus-visible:outline-hidden active:ring-2 disabled:pointer-events-none disabled:opacity-50"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
