import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockBackend, type Call } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";
import type { BackupInfo } from "@/types/BackupInfo";
import type { BackupSettings } from "@/types/BackupSettings";

// The folder picker is a native window; tests pretend the user chose this folder.
vi.mock("@/lib/api/backups", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/backups")>();
  return { ...actual, pickFolder: vi.fn(async () => "D:\\OneDrive\\Kairos") };
});

afterEach(() => clearMocks());

const backup = (fileName: string, fields: Partial<BackupInfo> = {}): BackupInfo => ({
  fileName,
  location: "app",
  kind: "automatic",
  createdAt: new Date(Date.now() - 3_600_000).toISOString(),
  sizeBytes: 3 * 1024 * 1024,
  itemCount: 42,
  ...fields,
});

const settings = (fields: Partial<BackupSettings> = {}): BackupSettings => ({
  folder: null,
  lastBackupAt: new Date(Date.now() - 3_600_000).toISOString(),
  lastFailureAt: null,
  ...fields,
});

const callsTo = (calls: Call[], cmd: string) => calls.filter((c) => c.cmd === cmd);

describe("Settings › Backups", () => {
  it("lists backups with kind, place, size and item count", async () => {
    mockBackend({
      list_backups: () => [
        backup("kairos-auto-a.db"),
        backup("kairos-manual-b.db", { kind: "manual", itemCount: null }),
      ],
      get_backup_settings: () => settings(),
    });
    renderApp("/settings");

    const list = await screen.findByRole("list", { name: "Saved backups" });
    expect(
      within(list).getByText(/Automatic · On this computer · 3.0 MB · 42 items/),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Made by you .* Can't be read/)).toBeInTheDocument();
    // An unreadable backup can't be restored.
    const restoreButtons = within(list).getAllByRole("button", {
      name: /^Restore the backup from/,
    });
    expect(restoreButtons[1]).toBeDisabled();
  });

  it("Back up now makes a backup and says so", async () => {
    const calls = mockBackend({
      list_backups: () => [],
      get_backup_settings: () => settings({ lastBackupAt: null }),
      backup_now: () => backup("kairos-manual-new.db", { kind: "manual" }),
    });
    const user = userEvent.setup();
    renderApp("/settings");

    expect(
      await screen.findByText(/No backups yet. Kairos makes one every day/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back up now" }));
    await waitFor(() => expect(callsTo(calls, "backup_now")).toHaveLength(1));
    expect(await screen.findByText("Backup saved.")).toBeInTheDocument();
  });

  it("restores only after confirming, from the right place", async () => {
    const calls = mockBackend({
      list_backups: () => [backup("kairos-auto-20261007-090000.000.db", { location: "folder" })],
      get_backup_settings: () => settings(),
      restore_backup: () => null,
    });
    const user = userEvent.setup();
    renderApp("/settings");

    await user.click(await screen.findByRole("button", { name: /^Restore the backup from/ }));
    const confirm = await screen.findByRole("alertdialog", { name: "Restore this backup?" });
    expect(
      within(confirm).getByText(/saves your current data first as a safety copy/),
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Restore" }));

    await waitFor(() =>
      expect(callsTo(calls, "restore_backup")[0]?.args).toEqual({
        location: "folder",
        fileName: "kairos-auto-20261007-090000.000.db",
      }),
    );
    expect(await screen.findByText(/Restored the backup from/)).toBeInTheDocument();
  });

  it("explains a failed backup calmly", async () => {
    mockBackend({
      list_backups: () => [],
      get_backup_settings: () => settings({ lastFailureAt: new Date().toISOString() }),
    });
    renderApp("/settings");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Check there's free space on your disk/,
    );
  });

  it("chooses and clears the extra folder", async () => {
    let folder: string | null = null;
    const calls = mockBackend({
      list_backups: () => [],
      get_backup_settings: () => settings({ folder }),
      set_backup_folder: ({ folder: next }) => {
        folder = next as string | null;
        return settings({ folder });
      },
    });
    const user = userEvent.setup();
    renderApp("/settings");

    await user.click(await screen.findByRole("button", { name: "Choose folder…" }));
    await waitFor(() =>
      expect(callsTo(calls, "set_backup_folder")[0]?.args).toEqual({
        folder: "D:\\OneDrive\\Kairos",
      }),
    );
    expect(await screen.findByText("D:\\OneDrive\\Kairos")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Stop copying" }));
    await waitFor(() =>
      expect(callsTo(calls, "set_backup_folder")[1]?.args).toEqual({ folder: null }),
    );
  });
});
