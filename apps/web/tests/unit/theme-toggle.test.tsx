import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ThemeToggle } from "../../components/public-site/ThemeToggle";

describe("ThemeToggle", () => {
  it("switches the document theme, persists the choice and updates accessible state", () => {
    document.documentElement.dataset.theme = "light";
    render(<ThemeToggle />);

    const button = screen.getByRole("button", { name: "Включить тёмную тему" });
    expect(button).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(button);

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem("respio-theme")).toBe("dark");
    expect(screen.getByRole("button", { name: "Включить светлую тему" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
