import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useFocusStore } from "@/features/focus/focusStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => {
  clearMocks();
  useFocusStore.getState().close();
});

describe("Focus mode (P3-T05)", () => {
  it("starts a logged 25-minute stretch, pauses it, and ends focus", async () => {
    const calls = mockBackend({
      start_focus: () => ({
        id: "f1",
        itemId: null,
        startedAt: new Date().toISOString(),
        endedAt: null,
        plannedMinutes: 25,
      }),
    });
    const user = userEvent.setup();
    renderApp("/");
    await user.click(await screen.findByRole("button", { name: "Focus mode" }));
    await user.click(await screen.findByRole("button", { name: "Start focusing" }));

    expect(await screen.findByRole("timer", { name: /left/ })).toBeInTheDocument();
    expect(calls).toContainEqual({ cmd: "set_focus_mode", args: { active: true } });
    expect(calls).toContainEqual({
      cmd: "start_focus",
      args: { itemId: null, plannedMinutes: 25 },
    });

    await user.click(screen.getByRole("button", { name: "Pause" }));
    await waitFor(() => expect(calls).toContainEqual({ cmd: "stop_focus", args: { id: "f1" } }));
    expect(screen.getByRole("button", { name: "Resume" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("timer")).not.toBeInTheDocument());
    await waitFor(() =>
      expect(calls.filter((c) => c.cmd === "set_focus_mode").at(-1)?.args).toEqual({
        active: false,
      }),
    );
  });
});
