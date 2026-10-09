import { clearMocks } from "@tauri-apps/api/mocks";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { mockBackend } from "@/test/mockBackend";
import { renderApp } from "@/test/renderWithProviders";

afterEach(() => clearMocks());

describe("Settings › Smart features (P3-T08)", () => {
  it("asks for consent first, then checks and saves the key", async () => {
    let status = { consented: false, hasKey: false };
    const calls = mockBackend({
      ai_status: () => status,
      ai_consent: () => {
        status = { ...status, consented: true };
        return null;
      },
      ai_set_key: () => {
        status = { ...status, hasKey: true };
        return null;
      },
    });
    const user = userEvent.setup();
    renderApp("/settings");

    expect(await screen.findByRole("heading", { name: /Smart features.*Off/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Gemini API key")).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "I understand, turn them on" }));

    await user.type(await screen.findByLabelText("Gemini API key"), "  test-key-123 ");
    await user.click(screen.getByRole("button", { name: "Check and save key" }));
    await waitFor(() =>
      expect(calls).toContainEqual({ cmd: "ai_set_key", args: { key: "  test-key-123 " } }),
    );
    expect(await screen.findByRole("heading", { name: /Smart features.*On/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove key" })).toBeInTheDocument();
  });

  it("shows why a key was refused", async () => {
    mockBackend({
      ai_status: () => ({ consented: true, hasKey: false }),
      ai_set_key: () => {
        throw { code: "ai", message: "errors.ai.badKey" };
      },
    });
    const user = userEvent.setup();
    renderApp("/settings");
    await user.type(await screen.findByLabelText("Gemini API key"), "wrong");
    await user.click(screen.getByRole("button", { name: "Check and save key" }));
    expect(await screen.findByText(/That key didn’t work/)).toBeInTheDocument();
  });
});
