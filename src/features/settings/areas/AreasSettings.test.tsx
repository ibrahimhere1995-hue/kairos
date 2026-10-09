import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockBackend, testAreas, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { Area } from "@/types/Area";
import type { AreaInput } from "@/types/AreaInput";

let areas: Area[] = [];
let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => {
  areas = testAreas.map((a) => ({ ...a }));
  calls = mockBackend({
    list_areas: () => areas,
    create_area: ({ input }) => {
      const { name, color } = input as AreaInput;
      if (areas.some((a) => a.name.toLowerCase() === name.trim().toLowerCase())) {
        throw { code: "validation", message: "errors.validation.duplicateName", field: "name" };
      }
      const area = {
        ...(testAreas[0] as Area),
        id: `new-${name}`,
        name: name.trim(),
        color,
        sortOrder: 99,
      };
      areas = [...areas, area];
      return area;
    },
    update_area: ({ id, input }) => {
      const { name, color } = input as AreaInput;
      areas = areas.map((a) => (a.id === id ? { ...a, name, color } : a));
      return areas.find((a) => a.id === id);
    },
    archive_area: ({ id, archived }) => {
      areas = areas.map((a) => (a.id === id ? { ...a, isArchived: archived as boolean } : a));
      return areas.find((a) => a.id === id);
    },
    reorder_areas: ({ ids }) => {
      areas = (ids as string[]).flatMap((id) => areas.filter((a) => a.id === id));
      return areas;
    },
  });
});
afterEach(() => clearMocks());

async function section() {
  return screen.findByRole("region", { name: "Life areas" });
}

describe("Life areas (P2-T10)", () => {
  it("adds an area, and explains a duplicate name kindly", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    const areasSection = await section();
    const nameField = within(areasSection).getByRole("textbox", { name: "New area name" });

    await user.type(nameField, "Family");
    await user.click(within(areasSection).getByRole("button", { name: "Add area" }));
    await waitFor(() =>
      expect(callsTo("create_area")[0]?.args).toEqual({
        input: { name: "Family", color: "area.work" },
      }),
    );
    expect(
      await within(areasSection).findByRole("textbox", { name: "Name of Family" }),
    ).toBeInTheDocument();

    await user.type(nameField, "work");
    await user.click(within(areasSection).getByRole("button", { name: "Add area" }));
    expect(
      await within(areasSection).findByText("Another area already has this name."),
    ).toBeInTheDocument();
  });

  it("renames when leaving the field and recolours", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    const areasSection = await section();
    const work = await within(areasSection).findByRole("textbox", { name: "Name of Work" });
    await user.clear(work);
    await user.type(work, "Job{Enter}");
    await waitFor(() =>
      expect(callsTo("update_area")[0]?.args).toEqual({
        id: "a1",
        input: { name: "Job", color: "area.work" },
      }),
    );

    await user.click(await within(areasSection).findByRole("button", { name: /^Colour for Job/ }));
    await user.click(await screen.findByRole("button", { name: "Purple" }));
    await waitFor(() =>
      expect(callsTo("update_area").at(-1)?.args).toMatchObject({
        input: { color: "area.learning" },
      }),
    );
  });

  it("moves an area down and archives one", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    const areasSection = await section();
    expect(
      await within(areasSection).findByRole("button", { name: "Move Work up" }),
    ).toBeDisabled();
    await user.click(within(areasSection).getByRole("button", { name: "Move Work down" }));
    await waitFor(() =>
      expect((callsTo("reorder_areas")[0]?.args.ids as string[]).slice(0, 2)).toEqual(["a2", "a1"]),
    );

    await user.click(within(areasSection).getByRole("button", { name: "Archive Health" }));
    await waitFor(() => expect(callsTo("archive_area")[0]?.args).toMatchObject({ archived: true }));
    expect(
      await within(areasSection).findByRole("button", { name: "Bring back Health" }),
    ).toBeInTheDocument();
  });
});
