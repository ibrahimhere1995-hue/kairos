/**
 * End-to-end tests (PROJECT_RULES "Testing": critical paths) against the real Kairos app,
 * driven through tauri-driver + msedgedriver (WebView2). Windows only for now.
 * Run: `pnpm test:e2e` (builds a debug app into src-tauri/target-e2e first).
 * Each run uses a fresh data folder under .devdata/e2e, never your real data.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { browser } from "@wdio/globals";

const root = path.resolve(import.meta.dirname, "../..");
const targetDir = path.join(root, "src-tauri", "target-e2e");
const application = path.join(targetDir, "debug", "kairos.exe");
const edgeDriver = process.env.KAIROS_EDGEDRIVER ?? "I:\\DevTools\\edgedriver\\msedgedriver.exe";
const tauriDriver = process.env.KAIROS_TAURI_DRIVER ?? "tauri-driver";

let driver: ChildProcess | undefined;

export const config: WebdriverIO.Config = {
  runner: "local",
  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,
  hostname: "127.0.0.1",
  port: 4444,
  capabilities: [
    {
      // tauri-driver launches this app and connects msedgedriver to its WebView2.
      "tauri:options": { application },
    } as WebdriverIO.Capabilities,
  ],
  logLevel: "warn",
  waitforTimeout: 15_000,
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: { ui: "bdd", timeout: 180_000 },

  onPrepare() {
    if (process.env.E2E_SKIP_BUILD) return;
    const build = spawnSync("pnpm", ["tauri", "build", "--debug", "--no-bundle"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, CARGO_TARGET_DIR: targetDir },
    });
    if (build.status !== 0) throw new Error("E2E build failed");
  },

  async beforeSession() {
    const runDir = path.join(root, ".devdata", "e2e", `run-${Date.now()}`);
    const tempDir = path.join(runDir, "tmp");
    mkdirSync(tempDir, { recursive: true });
    driver = spawn(tauriDriver, ["--native-driver", edgeDriver], {
      stdio: ["ignore", "inherit", "inherit"],
      env: {
        ...process.env,
        KAIROS_DATA_DIR: path.join(runDir, "data"),
        // msedgedriver puts its temporary WebView2 profile in TEMP: keep it off C:.
        TEMP: tempDir,
        TMP: tempDir,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 1500)); // let the driver start listening
  },

  /** A failing test leaves a screenshot of the app window in .devdata/e2e/failures. */
  async afterTest(test, _context, { passed }) {
    if (passed) return;
    const dir = path.join(root, ".devdata", "e2e", "failures");
    mkdirSync(dir, { recursive: true });
    const name = test.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 60);
    await browser.saveScreenshot(path.join(dir, `${name}.png`));
  },

  afterSession() {
    driver?.kill();
  },
};
