import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Item } from "@/types/Item";
import type { Template } from "@/types/Template";

const item = { id: "i1", title: "Plan the week", kind: "task", dueDate: "2030-01-07" } as Item;
const template: Template = {
  id: "t1",
  name: "Monday kickoff",
  createdAt: "x",
  entries: [
    {
      kind: "task",
      title: "Plan the week",
      notes: null,
      areaId: null,
      priority: 0,
      dayOffset: 0,
      time: null,
      durationMinutes: null,
      steps: [],
    },
  ],
};

afterEach(() => clearMocks());

describe("Templates (P3-T04)", () => {
  it("saves the items of a day as a template", async () => {
    const calls = mockBackend({ list_items: () => [item], create_template: () => template });
    const user = userEvent.setup();
    renderApp("/templates");
    expect(await screen.findByRole("checkbox", { name: "Plan the week" })).toBeChecked();
    await user.type(screen.getByRole("textbox", { name: "Template name" }), "Monday kickoff");
    await user.click(screen.getByRole("button", { name: "Save 1 item as a template" }));
    await waitFor(() =>
      expect(calls.find((c) => c.cmd === "create_template")?.args).toEqual({
        name: "Monday kickoff",
        itemIds: ["i1"],
      }),
    );
  });

  it("inserts a template on a day, with Undo", async () => {
    const calls = mockBackend({
      list_templates: () => [template],
      apply_template: () => [item],
      delete_items: () => null,
    });
    const user = userEvent.setup();
    renderApp("/templates");
    const list = await screen.findByRole("list", { name: "Templates" });
    await user.click(within(list).getByRole("button", { name: "Insert" }));
    expect(await screen.findByText("Inserted 1 item.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(calls.find((c) => c.cmd === "delete_items")?.args).toEqual({ ids: ["i1"] }),
    );
  });
});
