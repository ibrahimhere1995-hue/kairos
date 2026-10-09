import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaptureStore } from "@/features/capture/captureStore";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

beforeEach(() => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0)");
});
afterEach(() => {
  clearMocks();
  vi.restoreAllMocks();
  useCaptureStore.setState({ open: false });
});

async function openCapture() {
  const user = userEvent.setup();
  renderApp();
  await user.click(await screen.findByRole("button", { name: "Add task" }));
  const dialog = await screen.findByRole("dialog", { name: "Quick capture" });
  return { user, dialog };
}

describe("Voice capture (P3-T14)", () => {
  it("holding Space on the mic records, and releasing puts the words in the box", async () => {
    const calls = mockBackend({
      voice_start: () => null,
      voice_stop: () => "Call bank tomorrow 3pm",
    });
    const { user, dialog } = await openCapture();
    within(dialog).getByRole("button", { name: "Hold to speak" }).focus();

    await user.keyboard("[Space>]");
    expect(
      within(dialog).getByRole("button", { name: /Listening/, pressed: true }),
    ).toBeInTheDocument();
    await user.keyboard("[/Space]");

    const input = within(dialog).getByRole("textbox", { name: "What needs a moment?" });
    await waitFor(() => expect(input).toHaveValue("Call bank tomorrow 3pm"));
    expect(within(dialog).getByText("Tomorrow")).toBeInTheDocument();
    expect(calls.filter((c) => c.cmd === "voice_start")).toHaveLength(1);
  });

  it("explains a Windows privacy block and links to the right settings page", async () => {
    const calls = mockBackend({
      voice_start: () => {
        throw { code: "voice", message: "errors.voice.privacy" };
      },
    });
    const { user, dialog } = await openCapture();
    within(dialog).getByRole("button", { name: "Hold to speak" }).focus();
    await user.keyboard("[Space>][/Space]");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(/Online speech recognition/);
    await user.click(within(dialog).getByRole("button", { name: "Open Windows settings" }));
    expect(calls).toContainEqual({ cmd: "voice_open_settings", args: { reason: "privacy" } });
  });

  it("is hidden where Windows speech isn't available", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Macintosh)");
    mockBackend();
    const { dialog } = await openCapture();
    expect(within(dialog).queryByRole("button", { name: "Hold to speak" })).not.toBeInTheDocument();
  });
});
