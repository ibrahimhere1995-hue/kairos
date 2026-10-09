import path from "node:path";
import { mkdirSync } from "node:fs";
import { $, browser } from "@wdio/globals";
import { byName, click, goTo, quickAdd, skipOnboarding } from "../helpers";

// P1-T17 UI checklist evidence: every screen in light/dark, at default and extra-large text,
// at the 960 px minimum width. Screenshots are of the app's own web view only (WebDriver),
// saved to .devdata/e2e/screens for review.

const outDir = path.resolve(import.meta.dirname, "../../../.devdata/e2e/screens");
const SCREENS = ["My Day", "Calendar", "Trash", "Settings"] as const;

async function setAppearance(theme: "Light" | "Dark", size: "Default" | "Extra large") {
  await goTo("Settings");
  await click(theme);
  await click(size);
}

async function shoot(name: string) {
  await browser.pause(400); // let entrance animations settle
  await browser.saveScreenshot(path.join(outDir, `${name}.png`));
}

describe("UI checklist screenshots", () => {
  before(async () => {
    mkdirSync(outDir, { recursive: true });
    await $(`//button[normalize-space(.)="Skip setup"]`).waitForDisplayed({ timeout: 60_000 });
    await shoot("Onboarding");
    await skipOnboarding();
    await byName("Main").waitForDisplayed({ timeout: 60_000 });
    await browser.setWindowSize(960, 760).catch(() => {
      // Some drivers can't resize; the app's own minimum width is 960 px anyway.
    });
    // A little content so screens aren't all empty states.
    await quickAdd("Team sync tomorrow 10-11am #work");
    await quickAdd("Buy groceries #home");
    await quickAdd("Read chapter 4 yesterday #learning");
  });

  for (const theme of ["Light", "Dark"] as const) {
    for (const size of ["Default", "Extra large"] as const) {
      it(`${theme} theme, ${size} text`, async () => {
        await setAppearance(theme, size);
        for (const screen of SCREENS) {
          await goTo(screen);
          await shoot(`${theme}-${size.replace(" ", "")}-${screen.replace(" ", "")}`);
        }
        // The Quick Capture bar and the item editor, too.
        await goTo("My Day");
        await click("Add task");
        await (await byName("What needs a moment?")).setValue("Call bank tomorrow 3pm #home !high");
        await shoot(`${theme}-${size.replace(" ", "")}-QuickCapture`);
        await click("More details");
        await shoot(`${theme}-${size.replace(" ", "")}-Editor`);
        await browser.keys("Escape");
        await $(`//button[normalize-space(.)="Discard"]`)
          .click()
          .catch(() => undefined);
        await $(
          `//button[normalize-space(.)="Save changes" or normalize-space(.)="Add task" and ancestor::form]`,
        )
          .waitForDisplayed({ reverse: true })
          .catch(() => undefined);

        // The search and command palette.
        await browser.keys(["Control", "k"]);
        const palette = $(`//*[@role="combobox"]`);
        await palette.waitForDisplayed();
        await palette.setValue("team");
        await shoot(`${theme}-${size.replace(" ", "")}-Palette`);
        await browser.keys("Escape");
        await palette.waitForDisplayed({ reverse: true });
      });
    }
  }

  after(async () => {
    await setAppearance("Light", "Default");
  });
});
