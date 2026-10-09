import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "@/app/theme/themeStore";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

let needed = true;
let samplesLeft = 0;
let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => {
  needed = true;
  samplesLeft = 0;
  useThemeStore.setState({ preference: "light", textSize: "default" });
  calls = mockBackend({
    get_onboarding: () => ({ needed, samplesLeft }),
    finish_onboarding: () => {
      needed = false;
      samplesLeft = 3;
      return { needed, samplesLeft };
    },
    skip_onboarding: () => {
      needed = false;
      samplesLeft = 3;
      return { needed, samplesLeft };
    },
    remove_sample_tasks: () => {
      samplesLeft = 0;
      return 3;
    },
  });
});
afterEach(() => clearMocks());

describe("Onboarding (PRD R7)", () => {
  it("walks through name, theme and areas, then saves the answers", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await screen.findByRole("dialog", { name: "Welcome to Kairos" });
    expect(within(dialog).getByText("Step 1 of 3")).toBeInTheDocument();
    await user.type(
      within(dialog).getByRole("textbox", { name: "What should Kairos call you?" }),
      "Zack",
    );
    await user.click(within(dialog).getByRole("button", { name: "Next" }));

    await user.click(within(dialog).getByRole("radio", { name: "Dark" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    await user.click(within(dialog).getByRole("button", { name: "Next" }));

    // Health stays ticked; Work is unticked.
    await user.click(within(dialog).getByRole("checkbox", { name: "Work" }));
    await user.click(within(dialog).getByRole("button", { name: "Start planning" }));
    await waitFor(() =>
      expect(callsTo("finish_onboarding")[0]?.args).toEqual({
        input: { name: "Zack", theme: "dark", keepAreaIds: ["a2"] },
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("can be skipped, and the sample tasks removed in one click", async () => {
    const user = userEvent.setup();
    renderApp();
    const dialog = await screen.findByRole("dialog", { name: "Welcome to Kairos" });
    await user.click(within(dialog).getByRole("button", { name: "Skip setup" }));
    await waitFor(() => expect(callsTo("skip_onboarding")).toHaveLength(1));

    await user.click(await screen.findByRole("button", { name: "Remove sample tasks" }));
    await waitFor(() => expect(callsTo("remove_sample_tasks")).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Remove sample tasks" })).not.toBeInTheDocument(),
    );
  });

  it("isn't shown once done", async () => {
    needed = false;
    renderApp();
    await screen.findByRole("main");
    expect(screen.queryByRole("dialog", { name: "Welcome to Kairos" })).not.toBeInTheDocument();
  });
});
