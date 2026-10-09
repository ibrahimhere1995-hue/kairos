import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

const idea: Item = {
  id: "u1",
  kind: "task",
  title: "Plan the garden",
  notes: null,
  areaId: "a1",
  priority: 0,
  allDay: false,
  startAt: null,
  endAt: null,
  dueDate: null,
  completedAt: null,
  skippedAt: null,
  location: null,
  rrule: null,
  recurrenceParentId: null,
  originalStartAt: null,
  milestoneId: null,
  rescheduleCount: 0,
  source: "manual",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  deletedAt: null,
};

beforeEach(() => useEditorStore.setState({ open: false, itemId: null, prefill: null }));
afterEach(() => clearMocks());

describe("Inbox", () => {
  it("lists tasks without a date and opens one", async () => {
    mockBackend({ list_unscheduled: () => [idea] });
    const user = userEvent.setup();
    renderApp("/inbox");
    const list = await screen.findByRole("list", { name: "Tasks without a date" });
    expect(within(list).getByText("Plan the garden")).toBeInTheDocument();
    expect(within(list).getByText("Work")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: /^Plan the garden/ }));
    expect(useEditorStore.getState()).toMatchObject({ open: true, itemId: "u1" });
  });

  it("is kindly empty, and adds a task without a date", async () => {
    mockBackend();
    const user = userEvent.setup();
    renderApp("/inbox");
    expect(
      await screen.findByText("Nothing waiting here. Tasks without a date show up in the Inbox."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add a task without a date" }));
    const editor = await screen.findByRole("dialog", { name: "New item" });
    expect(within(editor).getByRole("button", { name: /Date:/ })).toHaveTextContent("No date");
  });
});

describe("Inbox notes (P3-T01)", () => {
  it("adds a note with Enter and turns it into a task in one click", async () => {
    const note = {
      id: "n1",
      text: "Call the plumber",
      hasImage: false,
      createdAt: "2026-10-09T08:00:00.000Z",
    };
    let notes: (typeof note)[] = [];
    const calls = mockBackend({
      list_inbox: () => notes,
      add_inbox_text: ({ text }) => {
        notes = [{ ...note, text: String(text) }];
        return notes[0];
      },
      process_inbox_entry: () => {
        notes = [];
        return { ...idea, title: "Call the plumber" };
      },
    });
    const user = userEvent.setup();
    renderApp("/inbox");
    await user.type(
      await screen.findByRole("textbox", { name: "Jot something down" }),
      "Call the plumber{Enter}",
    );
    const list = await screen.findByRole("list", { name: "Notes and pictures" });
    expect(within(list).getByText("Call the plumber")).toBeInTheDocument();
    await user.click(within(list).getByRole("button", { name: "Make it a task" }));
    expect(await screen.findByText("“Call the plumber” is now a task.")).toBeInTheDocument();
    expect(calls.filter((c) => c.cmd === "process_inbox_entry")[0]?.args).toEqual({ id: "n1" });
  });
});
