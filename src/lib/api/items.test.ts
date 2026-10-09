import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { afterEach, describe, expect, it } from "vitest";
import { toErrorPayload } from "@/lib/api/errors";
import { itemsApi } from "@/lib/api/items";
import type { ItemInput } from "@/types/ItemInput";

// Guards the contract with src-tauri/src/commands/items.rs: command names and argument keys
// must match exactly, or calls fail at runtime only.
const calls: { cmd: string; args: unknown }[] = [];

function record(result: unknown = null) {
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    return result;
  });
}

afterEach(() => {
  clearMocks();
  calls.length = 0;
});

const input: ItemInput = {
  kind: "task",
  title: "Call bank",
  notes: null,
  areaId: null,
  priority: 3,
  startAt: null,
  endAt: null,
  dueDate: "2026-10-08",
  location: null,
  source: "quick",
  rrule: null,
};

describe("itemsApi", () => {
  it("calls each Rust command with the expected arguments", async () => {
    record();
    const range = {
      start: "2026-10-07T00:00:00Z",
      end: "2026-10-08T00:00:00Z",
      startDate: "2026-10-07",
      endDate: "2026-10-08",
    };
    const query = {
      now: "2026-10-07T10:00:00Z",
      dayStart: "2026-10-07T00:00:00Z",
      dayEnd: "2026-10-08T00:00:00Z",
      today: "2026-10-07",
      weekEnd: "2026-10-12T00:00:00Z",
      weekEndDate: "2026-10-12",
    };
    const schedule = { startAt: null, endAt: null, dueDate: "2026-10-09" };

    await itemsApi.create(input);
    await itemsApi.update("id1", input);
    await itemsApi.delete("id1");
    await itemsApi.restore("id1");
    await itemsApi.complete("id1");
    await itemsApi.uncomplete("id1");
    await itemsApi.reschedule("id1", schedule);
    await itemsApi.list(range);
    await itemsApi.dashboard(query);

    expect(calls).toEqual([
      { cmd: "create_item", args: { input } },
      { cmd: "update_item", args: { id: "id1", input, scope: null } },
      { cmd: "delete_item", args: { id: "id1", scope: null } },
      { cmd: "restore_item", args: { id: "id1" } },
      { cmd: "complete_item", args: { id: "id1" } },
      { cmd: "uncomplete_item", args: { id: "id1" } },
      { cmd: "reschedule_item", args: { id: "id1", schedule } },
      { cmd: "list_items", args: { range, filters: null } },
      { cmd: "get_dashboard", args: { query } },
    ]);
  });

  it("surfaces backend errors as ErrorPayloads", async () => {
    mockIPC(() => {
      throw { code: "validation", message: "errors.validation.required", field: "title" };
    });
    const error: unknown = await itemsApi.create({ ...input, title: "" }).catch((e: unknown) => e);
    expect(toErrorPayload(error)).toEqual({
      code: "validation",
      message: "errors.validation.required",
      field: "title",
    });
  });

  it("maps unexpected failures to a generic error", () => {
    expect(toErrorPayload(new Error("boom"))).toEqual({
      code: "unknown",
      message: "errors.unknown",
      field: null,
    });
  });
});
