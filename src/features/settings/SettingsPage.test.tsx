import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/app/theme/themeStore";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { AppSettings } from "@/types/AppSettings";

let saved: AppSettings;
let calls: Call[] = [];
const updates = () => calls.filter((c) => c.cmd === "update_settings").map((c) => c.args.settings);

beforeEach(() => {
  useThemeStore.setState({ preference: "light", textSize: "default" });
  saved = {
    theme: "light",
    textSize: "default",
    weekStartsOn: "monday",
    defaultReminderTime: "09:00",
  };
  calls = mockBackend({
    get_settings: () => saved,
    update_settings: ({ settings }) => {
      saved = settings as AppSettings;
      return saved;
    },
  });
});
afterEach(() => {
  clearMocks();
  delete document.documentElement.dataset.textSize;
});

describe("Settings (P1-T16)", () => {
  it("switches theme instantly and remembers it", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await waitFor(() => expect(updates().at(-1)).toMatchObject({ theme: "dark" }));
  });

  it("scales all text with the text-size setting", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("radio", { name: "Extra large" }));
    expect(document.documentElement.dataset.textSize).toBe("xl");
    await waitFor(() => expect(updates().at(-1)).toMatchObject({ textSize: "xl" }));

    await user.click(screen.getByRole("radio", { name: "Default" }));
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it("changes the first day of the week", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("radio", { name: "Sunday" }));
    await waitFor(() => expect(updates().at(-1)).toMatchObject({ weekStartsOn: "sunday" }));
    expect(screen.getByRole("radio", { name: "Sunday" })).toBeChecked();
  });

  it("saves the default reminder time when leaving the field", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    const input = await screen.findByLabelText("Remind me about all-day tasks at");
    await user.clear(input);
    await user.type(input, "07:30");
    expect(updates()).toHaveLength(0);
    await user.tab();
    await waitFor(() => expect(updates().at(-1)).toMatchObject({ defaultReminderTime: "07:30" }));
  });
});
