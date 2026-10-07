import { addDays } from "date-fns";
import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useCaptureStore } from "@/features/capture/captureStore";
import { useEditorStore } from "@/features/items/editorStore";
import { toLocalDateString } from "@/lib/dates/dayContext";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

let calls: Call[] = [];
const created = () => calls.filter((c) => c.cmd === "create_item").map((c) => c.args.input);

beforeEach(() => {
  useCaptureStore.setState({ open: false });
  useEditorStore.setState({ open: false, itemId: null, prefill: null });
  calls = mockBackend({ create_item: ({ input }) => ({ ...(input as object), id: "new" }) });
});
afterEach(() => clearMocks());

async function openCapture() {
  const user = userEvent.setup();
  renderApp();
  await user.click(await screen.findByRole("button", { name: "Add task" }));
  const dialog = await screen.findByRole("dialog", { name: "Quick capture" });
  const input = within(dialog).getByRole("textbox", { name: "What needs a moment?" });
  return { user, dialog, input };
}

describe("Quick Capture", () => {
  it("+ Add task opens the bar with the input focused", async () => {
    const { input } = await openCapture();
    expect(input).toHaveFocus();
  });

  it("shows recognised parts as chips and saves on Enter", async () => {
    const { user, dialog, input } = await openCapture();
    await user.type(input, "Call bank tomorrow 3pm #work !high");

    const chips = within(dialog).getByRole("list", { name: "Recognised details" });
    expect(within(chips).getByText("Tomorrow")).toBeInTheDocument();
    expect(within(chips).getByText("Work")).toBeInTheDocument();
    expect(within(chips).getByText("High")).toBeInTheDocument();
    expect(within(dialog).getByText("Enter adds “Call bank” · Esc closes")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Quick capture" })).not.toBeInTheDocument(),
    );

    const input0 = created()[0] as Record<string, unknown>;
    expect(input0).toMatchObject({
      kind: "task",
      title: "Call bank",
      areaId: "a1",
      priority: 3,
      source: "nlp",
      dueDate: null,
    });
    const start = new Date(input0.startAt as string);
    expect(toLocalDateString(start)).toBe(toLocalDateString(addDays(new Date(), 1)));
    expect(start.getHours()).toBe(15);
  });

  it("a plain title lands on Today", async () => {
    const { user, input } = await openCapture();
    await user.type(input, "Buy milk{Enter}");
    await waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0]).toMatchObject({
      title: "Buy milk",
      dueDate: toLocalDateString(new Date()),
      source: "quick",
    });
  });

  it("removing a chip keeps those words in the title", async () => {
    const { user, dialog, input } = await openCapture();
    await user.type(input, "Fix tap #work");
    await user.click(within(dialog).getByRole("button", { name: "Remove Life area Work" }));
    expect(
      within(dialog).queryByRole("list", { name: "Recognised details" }),
    ).not.toBeInTheDocument();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(created()).toHaveLength(1));
    expect(created()[0]).toMatchObject({ title: "Fix tap #work", areaId: null });
  });

  it("Esc closes without saving; an empty Enter does nothing", async () => {
    const { user } = await openCapture();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Quick capture" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Quick capture" })).not.toBeInTheDocument(),
    );
    expect(created()).toHaveLength(0);
  });

  it("More details carries what was typed into the full editor", async () => {
    const { user, dialog, input } = await openCapture();
    await user.type(input, "Dentist tomorrow #work");
    await user.click(within(dialog).getByRole("button", { name: "More details" }));

    const editor = await screen.findByRole("dialog", { name: "New item" });
    expect(within(editor).getByRole("textbox", { name: "Title" })).toHaveValue("Dentist");
    expect(within(editor).getByRole("button", { name: /Date: Tomorrow/ })).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: /Life area: Work/ })).toBeInTheDocument();
  });
});
