import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Feedback } from "@/types/Feedback";

afterEach(() => clearMocks());

const entry = (fields: Partial<Feedback>): Feedback => ({
  id: "f1",
  kind: "idea",
  text: "Week numbers in the calendar",
  context: "Wishlist",
  status: "open",
  createdAt: "2026-10-09T10:00:00.000Z",
  ...fields,
});

describe("Wishlist (P3-T07)", () => {
  it("adds a suggestion, moves it to Planned, and emails the list", async () => {
    let entries: Feedback[] = [];
    const calls = mockBackend({
      list_feedback: () => entries,
      create_feedback: () => {
        entries = [entry({})];
        return entries[0];
      },
      set_feedback_status: () => {
        entries = [entry({ status: "planned" })];
        return entries[0];
      },
    });
    const user = userEvent.setup();
    renderApp("/wishlist");
    expect(await screen.findByText(/Nothing here yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Suggest a feature" }));
    const dialog = await screen.findByRole("dialog", { name: "Suggest a feature" });
    await user.type(
      within(dialog).getByRole("textbox", { name: "What would make Kairos better?" }),
      "Week numbers in the calendar",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add to wishlist" }));
    await waitFor(() =>
      expect(calls).toContainEqual({
        cmd: "create_feedback",
        args: {
          input: { kind: "idea", text: "Week numbers in the calendar", context: null },
        },
      }),
    );

    const open = await screen.findByRole("region", { name: /Open/ });
    expect(within(open).getByText("Week numbers in the calendar")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: /Status of/ }), "planned");
    const planned = await screen.findByRole("region", { name: /Planned/ });
    expect(await within(planned).findByText("Week numbers in the calendar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Email to the developer" }));
    expect(calls.some((c) => c.cmd === "email_feedback")).toBe(true);
  });
});
