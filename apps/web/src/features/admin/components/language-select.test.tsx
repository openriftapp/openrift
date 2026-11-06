import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { LanguageSelect } from "./language-select";

vi.mock("@/hooks/use-enums", () => ({
  useLanguageList: () => [
    { code: "EN", name: "English", color: null },
    { code: "FR", name: "French", color: null },
    { code: "ZH", name: "Chinese", color: null },
  ],
}));

describe("LanguageSelect", () => {
  it("shows the selected language by name", () => {
    render(<LanguageSelect label="Language" value="FR" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("French");
  });

  it("shows the placeholder for an empty value", () => {
    render(<LanguageSelect label="Language" placeholder="Pick one" value="" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Language" })).toHaveTextContent("Pick one");
  });

  it("leaves out excluded codes and reports the pick", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<LanguageSelect label="Language" value="" exclude={["EN"]} onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Language" }));
    const chinese = await screen.findByRole("option", { name: "Chinese" });
    expect(screen.queryByRole("option", { name: "English" })).not.toBeInTheDocument();
    await user.click(chinese);

    expect(onChange).toHaveBeenCalledWith("ZH");
  });

  it("lists only the given languages", async () => {
    const user = userEvent.setup();
    render(
      <LanguageSelect
        label="Language"
        value="FR"
        languages={[{ code: "FR", name: "French" }]}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox", { name: "Language" }));

    expect(await screen.findAllByRole("option")).toHaveLength(1);
  });
});
