import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => clearMocks());

describe("Startup repair notice (P1-T15)", () => {
  it("says calmly which backup was restored and where the damaged file is", async () => {
    mockBackend({
      take_startup_notice: () => ({
        kind: "restored",
        backupCreatedAt: new Date().toISOString(),
        keptAt: "I:\\Kairos\\damaged\\kairos-damaged-20261008.db",
      }),
    });
    const user = userEvent.setup();
    renderApp();

    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent(/put back your backup from Today/);
    expect(notice).toHaveTextContent("kairos-damaged-20261008.db");

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByText(/put back your backup/)).not.toBeInTheDocument());
  });

  it("explains a fresh start when no good backup existed", async () => {
    mockBackend({
      take_startup_notice: () => ({ kind: "unrecoverable", keptAt: "I:\\damaged.db" }),
    });
    renderApp();
    expect(
      await screen.findByText(/couldn't find a good backup, so it started fresh/),
    ).toBeInTheDocument();
  });

  it("shows nothing on a normal start", async () => {
    mockBackend();
    renderApp();
    await screen.findByRole("main");
    expect(screen.queryByText(/found a problem with its data file/)).not.toBeInTheDocument();
  });
});
