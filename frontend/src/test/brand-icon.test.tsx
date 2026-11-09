import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ThemeProvider } from "../app/ThemeProvider";
import { BrandIcon } from "../components/ui/BrandIcon";
import { ThemeToggle } from "../components/ui/ThemeToggle";

it("switches supplied brand images and tab icon with app theme while retaining white artwork", () => {
  localStorage.setItem("routecast-theme", "day");
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  document.head.appendChild(favicon);
  try {
    const ui = render(
      <ThemeProvider>
        <BrandIcon />
        <BrandIcon white />
        <ThemeToggle />
      </ThemeProvider>,
    );
    const icons = ui.container.querySelectorAll("img");
    expect(icons[0]).toHaveAttribute("src", "/favicon-light.png");
    expect(icons[1]).toHaveAttribute("src", "/favicon-white.png");
    expect(favicon.getAttribute("href")).toBe("/favicon-light.png");
    fireEvent.click(
      screen.getByRole("button", { name: "Switch to dark mode" }),
    );
    expect(icons[0]).toHaveAttribute("src", "/favicon-dark.png");
    expect(icons[1]).toHaveAttribute("src", "/favicon-white.png");
    expect(favicon.getAttribute("href")).toBe("/favicon-dark.png");
    ui.unmount();
  } finally {
    favicon.remove();
    localStorage.clear();
  }
});
