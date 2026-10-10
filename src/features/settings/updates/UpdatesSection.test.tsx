import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => clearMocks());

describe("Settings › Updates (P4-T05)", () => {
  it("checks on request and installs only when asked", async () => {
    const calls = mockBackend({
      "plugin:app|version": () => "0.2.0",
      check_for_update: () => ({ version: "0.3.0", notes: null }),
      install_update: () => null,
    });
    const user = userEvent.setup();
    renderApp("/settings");
    expect(await screen.findByText("You have Kairos 0.2.0.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Check for updates" })).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Check now" }));
    expect(await screen.findByText("Kairos 0.3.0 is available.")).toBeInTheDocument();
    expect(calls.some((c) => c.cmd === "install_update")).toBe(false);

    await user.click(screen.getByRole("button", { name: "Install and restart" }));
    await waitFor(() => expect(calls.some((c) => c.cmd === "install_update")).toBe(true));
  });

  it("says when Kairos is up to date, and explains a failed check", async () => {
    let fail = false;
    mockBackend({
      check_for_update: () => {
        if (fail) throw { code: "update", message: "errors.update.offline" };
        return null;
      },
    });
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "Check now" }));
    expect(await screen.findByText("Kairos is up to date.")).toBeInTheDocument();
    fail = true;
    await user.click(screen.getByRole("button", { name: "Check now" }));
    expect(await screen.findByText(/couldn’t reach the update server/)).toBeInTheDocument();
  });
});
