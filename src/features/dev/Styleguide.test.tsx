import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { ThemeProvider } from "@/app/theme/ThemeProvider";
import { THEME_STORAGE_KEY } from "@/app/theme/theme";
import { useThemeStore } from "@/app/theme/themeStore";
import { Styleguide } from "@/features/dev/Styleguide";

function renderStyleguide() {
  return render(
    <ThemeProvider>
      <Styleguide />
    </ThemeProvider>,
  );
}

describe("Styleguide", () => {
  beforeEach(() => {
    useThemeStore.setState({ preference: "system" });
  });

  it("shows the tokens in both a light and a dark panel", () => {
    renderStyleguide();
    expect(screen.getByRole("region", { name: "Light theme" })).toHaveAttribute(
      "data-theme",
      "light",
    );
    expect(screen.getByRole("region", { name: "Dark theme" })).toHaveAttribute(
      "data-theme",
      "dark",
    );
  });

  it("switches the app theme from the keyboard and remembers the choice", async () => {
    const user = userEvent.setup();
    renderStyleguide();
    expect(document.documentElement.dataset.theme).toBe("light"); // system = light in tests

    await user.click(screen.getByRole("radio", { name: "Match system" }));
    await user.keyboard("{ArrowLeft}"); // native radio group: moves to "Dark"

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });
});
