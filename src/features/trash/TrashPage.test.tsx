import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

afterEach(() => clearMocks());

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function deleted(id: string, title: string, days: number): Item {
  return {
    id,
    kind: "task",
    title,
    notes: null,
    areaId: null,
    priority: 0,
    allDay: true,
    startAt: null,
    endAt: null,
    dueDate: "2026-10-01",
    completedAt: null,
    skippedAt: null,
    location: null,
    rrule: null,
    recurrenceParentId: null,
    originalStartAt: null,
    milestoneId: null,
    rescheduleCount: 0,
    source: "manual",
    createdAt: daysAgo(40),
    updatedAt: daysAgo(days),
    deletedAt: daysAgo(days),
  };
}

const callsTo = (calls: Call[], cmd: string) => calls.filter((c) => c.cmd === cmd);

describe("Trash", () => {
  it("lists deleted items with how long they stay, and restores one", async () => {
    const calls = mockBackend({
      list_trash: () => [deleted("i1", "Old report", 2), deleted("i2", "Bills", 29)],
      restore_item: ({ id }) => ({ id }),
    });
    const user = userEvent.setup();
    renderApp("/trash");

    const list = await screen.findByRole("list", { name: "Trash" });
    expect(within(list).getByText("Old report")).toBeInTheDocument();
    expect(within(list).getByText(/removed for good in 28 days/)).toBeInTheDocument();
    expect(within(list).getByText(/removed for good in 1 day/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Restore “Old report”" }));
    await waitFor(() => expect(callsTo(calls, "restore_item")[0]?.args).toEqual({ id: "i1" }));
    expect(await screen.findByText("Restored: Old report")).toBeInTheDocument();
  });

  it("empties the Trash only after confirming; Cancel is the safe default", async () => {
    const calls = mockBackend({
      list_trash: () => [deleted("i1", "Old report", 2), deleted("i2", "Bills", 3)],
      empty_trash: () => 2,
    });
    const user = userEvent.setup();
    renderApp("/trash");

    await user.click(await screen.findByRole("button", { name: "Empty Trash" }));
    const confirm = await screen.findByRole("alertdialog", { name: "Empty the Trash?" });
    expect(within(confirm).getByText(/2 items will be removed for good/)).toBeInTheDocument();
    expect(within(confirm).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(callsTo(calls, "empty_trash")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Empty Trash" }));
    const again = await screen.findByRole("alertdialog");
    await user.click(within(again).getByRole("button", { name: "Empty Trash" }));
    await waitFor(() => expect(callsTo(calls, "empty_trash")).toHaveLength(1));
  });

  it("shows a calm empty state", async () => {
    mockBackend({ list_trash: () => [] });
    renderApp("/trash");
    expect(await screen.findByText("The Trash is empty.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Empty Trash" })).not.toBeInTheDocument();
  });

  it("is in the sidebar", async () => {
    mockBackend();
    renderApp("/");
    expect(await screen.findByRole("link", { name: "Trash" })).toBeInTheDocument();
  });
});
