import { addDays } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/features/items/editorStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";

const savedItem: Item = {
  id: "i1",
  kind: "task",
  title: "Call bank",
  notes: null,
  areaId: null,
  priority: 0,
  allDay: true,
  startAt: null,
  endAt: null,
  dueDate: "2026-10-07",
  completedAt: null,
  skippedAt: null,
  location: "High Street branch",
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

let calls: Call[] = [];
let failCreateWith: unknown = null;

beforeEach(() => {
  failCreateWith = null;
  useEditorStore.setState({ open: false, itemId: null });
  calls = mockBackend({
    create_item: () => {
      if (failCreateWith) throw failCreateWith;
      return savedItem;
    },
    update_item: () => savedItem,
    get_item_detail: () => ({ item: savedItem, checklist: [], reminders: [0] }),
  });
});
afterEach(() => clearMocks());

const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

/** "+ Add task" opens Quick Capture; "More details" moves on to the full editor. */
async function openNewEditor() {
  const user = userEvent.setup();
  renderApp();
  await user.click(await screen.findByRole("button", { name: "Add task" }));
  const capture = await screen.findByRole("dialog", { name: "Quick capture" });
  await user.click(within(capture).getByRole("button", { name: "More details" }));
  const dialog = await screen.findByRole("dialog", { name: "New item" });
  return { user, dialog };
}

describe("Item editor", () => {
  it("opens from Quick Capture's More details with the title focused", async () => {
    const { dialog } = await openNewEditor();
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveFocus();
  });

  it("asks for a title instead of saving an empty item", async () => {
    const { user, dialog } = await openNewEditor();
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    expect(await within(dialog).findByText("Please add a title.")).toBeInTheDocument();
    expect(callsTo("create_item")).toHaveLength(0);
  });

  it("creates a task with the chosen date, priority and steps", async () => {
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Call bank");

    await user.click(within(dialog).getByRole("button", { name: /Date:/ }));
    await user.click(await screen.findByRole("button", { name: "Tomorrow" }));
    await user.click(within(dialog).getByRole("button", { name: /Priority:/ }));
    await user.click(await screen.findByRole("button", { name: "High" }));

    await user.click(within(dialog).getByRole("button", { name: "Add a step" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Step 1" }), "Find account number");

    await user.click(within(dialog).getByRole("button", { name: "Add task" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const tomorrow = toLocalDateString(addDays(new Date(), 1));
    expect(callsTo("create_item")[0]?.args.input).toMatchObject({
      kind: "task",
      title: "Call bank",
      dueDate: tomorrow,
      startAt: null,
      priority: 3,
      source: "manual",
    });
    expect(callsTo("set_checklist")[0]?.args).toEqual({
      itemId: "i1",
      entries: [{ id: null, text: "Find account number", done: false }],
    });
  });

  it("chooses reminders with the Remind me pill", async () => {
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Pay rent");

    // New items start with the default reminder: on the day, at the default reminder time.
    const pill = within(dialog).getByRole("button", { name: /Remind me:/ });
    expect(pill).toHaveTextContent("On the day at 9:00 AM");
    await user.click(pill);
    await user.click(await screen.findByRole("button", { name: "1 day before" }));
    expect(pill).toHaveTextContent("2 reminders");
    await user.keyboard("{Escape}");

    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(callsTo("create_item")).toHaveLength(1));
    expect(callsTo("create_item")[0]?.args.input).toMatchObject({ reminders: [0, 1440] });
  });

  it("can turn reminders off", async () => {
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Quiet task");
    await user.click(within(dialog).getByRole("button", { name: /Remind me:/ }));
    await user.click(await screen.findByRole("button", { name: "No reminder" }));
    expect(within(dialog).getByRole("button", { name: /Remind me:/ })).toHaveTextContent(
      "No reminder",
    );
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(callsTo("create_item")).toHaveLength(1));
    expect(callsTo("create_item")[0]?.args.input).toMatchObject({ reminders: [] });
  });

  it("Esc closes a clean editor straight away", async () => {
    const { user } = await openNewEditor();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("guards unsaved changes on Esc", async () => {
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Half-typed");
    await user.keyboard("{Escape}");

    const prompt = await within(dialog).findByRole("alertdialog");
    await user.click(within(prompt).getByRole("button", { name: "Keep editing" }));
    expect(within(dialog).getByRole("textbox", { name: "Title" })).toHaveValue("Half-typed");

    await user.keyboard("{Escape}");
    await user.click(await within(dialog).findByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(callsTo("create_item")).toHaveLength(0);
  });

  it("edits an existing item and keeps fields it doesn't show", async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("main");
    act(() => useEditorStore.getState().openItem("i1"));

    // The loading panel is replaced by the form once the item loads, so query the screen.
    const title = await screen.findByRole("textbox", { name: "Title" });
    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    expect(title).toHaveValue("Call bank");
    await user.clear(title);
    await user.type(title, "Call the bank");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(callsTo("update_item")).toHaveLength(1));
    expect(callsTo("update_item")[0]?.args).toMatchObject({
      id: "i1",
      input: { title: "Call the bank", location: "High Street branch", dueDate: "2026-10-07" },
    });
    expect(callsTo("set_checklist")).toHaveLength(0);
  });

  it("shows a friendly message when saving fails", async () => {
    failCreateWith = { code: "database", message: "errors.database", field: null };
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Call bank");
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    expect(
      await within(dialog).findByText(
        "Something went wrong while saving or loading your data. Please try again.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("sets a repeat in plain language", async () => {
    const { user, dialog } = await openNewEditor();
    await user.type(within(dialog).getByRole("textbox", { name: "Title" }), "Water plants");
    const pill = within(dialog).getByRole("button", { name: /Repeat:/ });
    expect(pill).toHaveTextContent("Does not repeat");
    await user.click(pill);
    await user.click(await screen.findByRole("button", { name: "Every day" }));
    await user.click(await screen.findByRole("button", { name: "After a number of times" }));
    expect(pill).toHaveTextContent("Every day, 10 times");
    await user.keyboard("{Escape}");

    await user.click(within(dialog).getByRole("button", { name: "Add task" }));
    await waitFor(() => expect(callsTo("create_item")).toHaveLength(1));
    expect(callsTo("create_item")[0]?.args.input).toMatchObject({ rrule: "FREQ=DAILY;COUNT=10" });
  });

  it("asks whether to change only this occurrence or the following ones too", async () => {
    const occurrence = {
      ...savedItem,
      id: "s1@2026-10-07",
      rrule: "FREQ=WEEKLY",
      recurrenceParentId: "s1",
      originalStartAt: "2026-10-07",
    };
    calls = mockBackend({
      update_item: () => occurrence,
      delete_item: () => null,
      get_item_detail: () => ({ item: occurrence, checklist: [], reminders: [] }),
    });
    const user = userEvent.setup();
    renderApp();
    act(() => useEditorStore.getState().openItem(occurrence.id));
    await screen.findByRole("textbox", { name: "Title" }); // the loaded form replaces the loading panel
    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    expect(within(dialog).getByRole("button", { name: /Repeat:/ })).toHaveTextContent(
      "Every week on Wednesday",
    );

    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));
    const prompt = await within(dialog).findByRole("alertdialog");
    expect(prompt).toHaveTextContent("This repeats. Which ones should change?");
    expect(within(prompt).getByRole("button", { name: "Only this one" })).toHaveFocus();
    await user.click(within(prompt).getByRole("button", { name: "This and following" }));
    await waitFor(() =>
      expect(callsTo("update_item")[0]?.args).toMatchObject({
        id: occurrence.id,
        scope: "following",
      }),
    );
  });

  it("asks the same before moving a repeating item to the Trash", async () => {
    const occurrence = { ...savedItem, id: "s1@2026-10-07", rrule: "FREQ=DAILY" };
    calls = mockBackend({
      delete_item: () => null,
      get_item_detail: () => ({ item: occurrence, checklist: [], reminders: [] }),
    });
    const user = userEvent.setup();
    renderApp();
    act(() => useEditorStore.getState().openItem(occurrence.id));
    await screen.findByRole("textbox", { name: "Title" }); // the loaded form replaces the loading panel
    const dialog = screen.getByRole("dialog", { name: "Edit item" });
    await user.click(within(dialog).getByRole("button", { name: "Move to Trash" }));
    const prompt = await within(dialog).findByRole("alertdialog");
    await user.click(within(prompt).getByRole("button", { name: "Only this one" }));
    await waitFor(() =>
      expect(callsTo("delete_item")[0]?.args).toEqual({ id: occurrence.id, scope: "this" }),
    );
  });

  it("saves a location, and lists and opens attachments", async () => {
    const file = {
      id: "f1",
      itemId: "i1",
      fileName: "Statement.pdf",
      mime: "application/pdf",
      sizeBytes: 250_000,
      createdAt: "2026-10-01T00:00:00.000Z",
    };
    calls = mockBackend({
      update_item: () => savedItem,
      get_item_detail: () => ({ item: savedItem, checklist: [], reminders: [] }),
      list_attachments: () => [file],
      open_attachment: () => null,
      remove_attachment: () => null,
    });
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole("main");
    act(() => useEditorStore.getState().openItem("i1"));
    // "High Street branch" is already set, so More details starts open.
    const location = await screen.findByRole("textbox", { name: "Location" });
    expect(location).toHaveValue("High Street branch");
    await user.clear(location);
    await user.type(location, "Main Street branch");

    expect(await screen.findByText("244 KB")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open Statement.pdf" }));
    await waitFor(() => expect(callsTo("open_attachment")[0]?.args).toEqual({ id: "f1" }));
    await user.click(screen.getByRole("button", { name: "Remove Statement.pdf" }));
    await waitFor(() => expect(callsTo("remove_attachment")[0]?.args).toEqual({ id: "f1" }));

    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(callsTo("update_item")[0]?.args.input).toMatchObject({
        location: "Main Street branch",
      }),
    );
  });

  it("explains that files can be attached after saving a new item", async () => {
    const { user, dialog } = await openNewEditor();
    await user.click(within(dialog).getByText("More details"));
    expect(
      within(dialog).getByText("Save the item first, then you can attach files."),
    ).toBeInTheDocument();
  });
});
