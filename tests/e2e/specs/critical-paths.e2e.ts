import { $, expect } from "@wdio/globals";
import { byName, byText, click, goTo, quickAdd, section, waitForText } from "../helpers";

// PROJECT_RULES: critical paths have E2E tests — create task, complete + undo,
// reschedule missed, backup + restore. One app session, fresh data folder.

describe("Kairos critical paths", () => {
  before(async () => {
    await byName("Main").waitForDisplayed({ timeout: 60_000 }); // the sidebar
  });

  it("creates a task with Quick Capture", async () => {
    await quickAdd("Write the E2E report tomorrow #work !high");
    const thisWeek = await section("This week");
    await expect(
      thisWeek.$(`.//*[normalize-space(text())="Write the E2E report"]`),
    ).toBeDisplayed();
  });

  it("completes a task with one click and undoes it", async () => {
    await quickAdd("Water the plants");
    const box = await byName("Mark “Water the plants” as done");
    await box.click();
    await click("Undo");
    // After Undo the task is open again: its checkbox offers "as done" and is unchecked.
    const again = await byName("Mark “Water the plants” as done");
    await again.waitForDisplayed();
    await expect(again).toHaveAttribute("aria-checked", "false");
    await expect(
      section("Today").$(`.//*[normalize-space(text())="Water the plants"]`),
    ).toBeDisplayed();
  });

  it("gives a slipped task a new moment", async () => {
    await quickAdd("Pay the electricity bill yesterday");
    const slipped = await section("Slipped by");
    await expect(
      slipped.$(`.//*[normalize-space(text())="Pay the electricity bill"]`),
    ).toBeDisplayed();

    await $(`//button[.//*[normalize-space(text())="Pay the electricity bill"]]`).click();
    // The date pill's label depends on the real date, so find it by its "Date:" prefix.
    await $(`//button[.//span[normalize-space(.)="Date:"]]`).click();
    // "Today" also names a My Day section and the calendar button: pick it inside the date picker.
    await $(
      `//*[@role="dialog" and @aria-label="Date"]//button[normalize-space(.)="Today"]`,
    ).click();
    await click("Save changes");
    // The editor (panel and its title both named "Edit item") has closed once Save is gone.
    await $(`//button[normalize-space(.)="Save changes"]`).waitForDisplayed({ reverse: true });

    await expect(
      section("Today").$(`.//*[normalize-space(text())="Pay the electricity bill"]`),
    ).toBeDisplayed();
  });

  it("backs up, and a restore brings a trashed item back", async () => {
    await quickAdd("Keep me safe");
    await goTo("Settings");
    await click("Back up now");
    await waitForText("Backup saved.");

    await goTo("My Day");
    await $(`//button[.//*[normalize-space(text())="Keep me safe"]]`).click();
    await click("Move to Trash");
    await byText("Keep me safe").waitForDisplayed({ reverse: true });

    await goTo("Settings");
    const restore = await $(`//button[starts-with(@aria-label, "Restore the backup from")]`);
    await restore.waitForClickable();
    await restore.click();
    const confirm = await $(`//*[@role="alertdialog"]`);
    await confirm.$(`.//button[normalize-space(.)="Restore"]`).click();
    await byText("Restore this backup?").waitForDisplayed({ reverse: true });

    await goTo("My Day");
    await waitForText("Keep me safe");
  });
});
