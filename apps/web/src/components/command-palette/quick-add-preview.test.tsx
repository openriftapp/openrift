import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuickAddPreviews } from "@/components/command-palette/quick-add-preview";
import { stubPrinting } from "@/test/factories";

const withImage = stubPrinting({
  card: { name: "Yasuo" },
  images: [{ imageId: "img-1" }],
});

describe("QuickAddPreviews", () => {
  it("renders nothing without a printing or an image", () => {
    const { container, rerender } = render(<QuickAddPreviews printing={null} isMobile={false} />);
    expect(container.innerHTML).toBe("");
    rerender(<QuickAddPreviews printing={stubPrinting({ images: [] })} isMobile={false} />);
    expect(container.innerHTML).toBe("");
  });

  it("adds the phone preview only on phones", () => {
    const { rerender } = render(<QuickAddPreviews printing={withImage} isMobile={false} />);
    expect(screen.getAllByRole("img")).toHaveLength(1);
    rerender(<QuickAddPreviews printing={withImage} isMobile />);
    expect(screen.getAllByRole("img")).toHaveLength(2);
  });

  it("drops the preview once its image fails to load", () => {
    render(<QuickAddPreviews printing={withImage} isMobile={false} />);
    fireEvent.error(screen.getByRole("img"));
    expect(screen.queryByRole("img")).toBeNull();
  });
});
