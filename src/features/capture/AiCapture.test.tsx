import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useCaptureStore } from "@/features/capture/captureStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => {
  clearMocks();
  useCaptureStore.setState({ open: false });
});

const SENTENCE = "remind me two days before mum's birthday on the 14th";

describe("Smart natural language (P3-T10)", () => {
  it("reads an unsure sentence with AI, then saves the checked draft", async () => {
    const calls = mockBackend({
      ai_status: () => ({ consented: true, hasKey: true }),
      ai_parse_text: () => ({
        title: "Mum's birthday",
        date: "2030-10-14",
        time: null,
        durationMinutes: null,
        reminderMinutes: 2880,
      }),
      create_item: ({ input }) => ({ ...(input as object), id: "new" }),
    });
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: "Add task" }));
    const dialog = await screen.findByRole("dialog", { name: "Quick capture" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "What needs a moment?" }),
      SENTENCE,
    );

    await user.click(await within(dialog).findByRole("button", { name: "Read with AI" }));
    expect(await within(dialog).findByText(/Read by AI/)).toHaveTextContent("2 days before");
    expect(
      within(dialog).getByText("Enter adds “Mum's birthday” · Esc closes"),
    ).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(calls.find((c) => c.cmd === "create_item")?.args.input).toMatchObject({
        title: "Mum's birthday",
        dueDate: "2030-10-14",
        reminders: [2880],
      }),
    );
  });

  it("is not offered while smart features are off", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderApp();
    await user.click(await screen.findByRole("button", { name: "Add task" }));
    const dialog = await screen.findByRole("dialog", { name: "Quick capture" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "What needs a moment?" }),
      SENTENCE,
    );
    expect(within(dialog).queryByRole("button", { name: "Read with AI" })).not.toBeInTheDocument();
  });
});
