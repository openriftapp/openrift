import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { stubCollection } from "@/test/factories";

import { CollectionRadioPicker } from "./collection-radio-picker";

describe("CollectionRadioPicker", () => {
  it("counts each collection's copies", () => {
    render(
      <CollectionRadioPicker
        collections={[
          stubCollection({ id: "c1", name: "Binder", copyCount: 12 }),
          stubCollection({ id: "c2", name: "Box", copyCount: 1 }),
        ]}
        selectedId="c1"
        onSelectedIdChange={() => {}}
        newName=""
        onNewNameChange={() => {}}
        idPrefix="pick"
      />,
    );

    expect(screen.getByText("12 copies")).toBeInTheDocument();
    expect(screen.getByText("1 copy")).toBeInTheDocument();
  });
});
