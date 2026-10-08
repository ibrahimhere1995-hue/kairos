import { $, browser } from "@wdio/globals";

/** Element by accessible name (role-agnostic), the same way users and screen readers find it. */
export const byName = (name: string) => $(`aria/${name}`);

/** Element whose visible text is exactly `text`. */
export const byText = (text: string) => $(`//*[normalize-space(text())="${text}"]`);

export async function click(name: string) {
  const el = await byName(name);
  await el.waitForClickable();
  await el.click();
}

export async function waitForText(text: string) {
  await byText(text).waitForDisplayed();
}

export async function goTo(page: "My Day" | "Calendar" | "Trash" | "Settings") {
  await click(page);
}

/** Uses Quick Capture ("+ Add task"): type the line and press Enter. */
export async function quickAdd(line: string) {
  await click("Add task");
  const input = await byName("What needs a moment?");
  await input.waitForDisplayed();
  await input.setValue(line);
  await browser.keys("Enter");
  await input.waitForDisplayed({ reverse: true });
}

/** The heading region of a My Day section, e.g. "Today" or "Slipped by". */
export function section(title: string) {
  // Exact title span: "This week" must not match "This week's balance".
  return $(`//section[h2//span[normalize-space(text())="${title}"]]`);
}
