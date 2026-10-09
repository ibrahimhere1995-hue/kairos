import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

vi.mock("@/lib/api/files", () => ({
  pickFiles: vi.fn(async () => []),
  pickFile: vi.fn(async () => "C:\\Users\\me\\Downloads\\work.ics"),
  pickSavePath: vi.fn(async (_title: string, name: string) => `C:\\Users\\me\\Documents\\${name}`),
}));

let calls: Call[] = [];
const callsTo = (cmd: string) => calls.filter((c) => c.cmd === cmd);

beforeEach(() => {
  calls = mockBackend({
    export_json: () => null,
    export_ics: () => 12,
    import_ics: () => ({ imported: 5, duplicates: 2, skipped: 1, simplified: 0 }),
  });
});
afterEach(() => clearMocks());

describe("Settings › Your data (P2-T12)", () => {
  it("exports everything as JSON to the chosen file", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "Export everything (JSON)" }));
    await waitFor(() => expect(callsTo("export_json")).toHaveLength(1));
    expect(String(callsTo("export_json")[0]?.args.path)).toMatch(/kairos-\d{4}-\d{2}-\d{2}\.json$/);
    expect(
      await screen.findByText(/^Saved to C:\\Users\\me\\Documents\\kairos-/),
    ).toBeInTheDocument();
  });

  it("exports the calendar and says how many items", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "Export calendar (.ics)" }));
    expect(await screen.findByText(/^Saved 12 items to /)).toBeInTheDocument();
  });

  it("imports a calendar and explains what happened", async () => {
    const user = userEvent.setup();
    renderApp("/settings");
    await user.click(await screen.findByRole("button", { name: "Import a calendar (.ics)…" }));
    await waitFor(() =>
      expect(callsTo("import_ics")[0]?.args).toEqual({
        path: "C:\\Users\\me\\Downloads\\work.ics",
      }),
    );
    expect(
      await screen.findByText(
        "Imported 5 items. 2 already here, 1 skipped, 0 without their repeat.",
      ),
    ).toBeInTheDocument();
  });
});
