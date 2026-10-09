import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

// jsdom has no image decoding; the shrinking itself is covered by fitWithin's tests.
vi.mock("@/lib/image/shrink", () => ({
  shrinkImage: () => Promise.resolve({ bytes: new Uint8Array([1, 2, 3]), type: "jpeg" }),
}));

afterEach(() => {
  clearMocks();
  useEditorStore.setState({ open: false, itemId: null, prefill: null });
});

describe("Picture → task (P3-T09)", () => {
  it("reads an Inbox picture and opens the editor pre-filled, without saving", async () => {
    const calls = mockBackend({
      ai_status: () => ({ consented: true, hasKey: true }),
      list_inbox: () => [
        { id: "p1", text: null, hasImage: true, createdAt: "2026-10-09T10:00:00.000Z" },
      ],
      inbox_image: () => "data:image/png;base64,AAAA",
      ai_extract_from_image: () => ({
        title: "Dentist",
        date: "2030-10-20",
        time: "09:30",
        durationMinutes: 45,
        location: "12 High St",
        notes: null,
      }),
    });
    const user = userEvent.setup();
    renderApp("/inbox");
    await user.click(await screen.findByRole("button", { name: "Read with AI" }));

    expect(await screen.findByDisplayValue("Dentist")).toBeInTheDocument();
    await waitFor(() => expect(useEditorStore.getState().prefill?.location).toBe("12 High St"));
    expect(calls.some((c) => c.cmd === "create_item")).toBe(false);
  });
});
