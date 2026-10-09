import axe from "axe-core";
import { $, browser, expect } from "@wdio/globals";
import { byName, click, quickAdd, skipOnboarding } from "../helpers";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

/** A sidebar link (page titles and commands share these names). */
const nav = (name: string) => $(`//nav//a[normalize-space(.)="${name}"]`).click();

// P2-T13: automated accessibility scan (axe-core, WCAG 2.2 A/AA) of every screen and dialog,
// in both themes, on the real app. Screen-reader listening is done by hand (docs/qa).

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

interface Finding {
  where: string;
  rule: string;
  impact: string | null | undefined;
  nodes: string[];
}

const findings: Finding[] = [];

async function scan(where: string) {
  await browser.pause(400); // let entrance animations finish (they change opacity)
  // Inject axe-core into the app's web view once, then run it there.
  await browser.execute(axe.source);
  const result = (await browser.execute(
    (tags: string[]) => window.axe.run(document, { runOnly: { type: "tag", values: tags } }),
    TAGS,
  )) as axe.AxeResults;
  for (const v of result.violations) {
    findings.push({
      where,
      rule: v.id,
      impact: v.impact,
      nodes: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
    });
  }
}

describe("Accessibility (axe-core)", () => {
  before(async () => {
    await $(`//button[normalize-space(.)="Skip setup"]`).waitForDisplayed({ timeout: 60_000 });
    await scan("Welcome screens");
    await skipOnboarding();
    await byName("Main").waitForDisplayed({ timeout: 60_000 });
    await quickAdd("Team sync tomorrow 10-11am #work");
    await quickAdd("Read chapter 4 yesterday #learning");
    await quickAdd("Water plants every day");
  });

  for (const theme of ["Light", "Dark"] as const) {
    it(`${theme} theme: every screen and dialog`, async () => {
      await nav("Settings");
      await click(theme);
      for (const screen of ["My Day", "Calendar", "Inbox", "Trash", "Settings"]) {
        await nav(screen);
        await scan(`${theme} · ${screen}`);
      }
      await nav("Calendar");
      for (const view of ["Day", "Month", "Agenda", "Week"]) {
        await $(`//label[normalize-space(.)="${view}"]`).click();
        await scan(`${theme} · Calendar ${view}`);
      }

      await nav("My Day");
      await click("Add task");
      await (await byName("What needs a moment?")).setValue("Call bank tomorrow 3pm");
      await scan(`${theme} · Quick Capture`);
      await click("More details");
      await scan(`${theme} · Item editor`);
      await browser.keys("Escape");
      await $(`//button[normalize-space(.)="Discard"]`)
        .click()
        .catch(() => undefined);

      await browser.keys(["Control", "k"]);
      const palette = $(`//*[@role="combobox"]`);
      await palette.waitForDisplayed();
      await palette.setValue("team");
      await scan(`${theme} · Search palette`);
      await browser.keys("Escape");
      await palette.waitForDisplayed({ reverse: true });
    });
  }

  after(async () => {
    if (findings.length > 0) {
      console.log("ACCESSIBILITY FINDINGS\n" + JSON.stringify(findings, null, 2));
    }
    await expect(findings).toEqual([]);
  });
});
