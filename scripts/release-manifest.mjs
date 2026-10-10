// Writes latest.json for the auto-updater (P4-T05) next to the signed Windows installer.
// Upload the installer, its .sig and latest.json to the GitHub release tagged v<version>.
// Usage: pnpm release:manifest ["What's new in this version"]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const conf = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));
const version = conf.version;
const dir = "src-tauri/target/release/bundle/nsis";
const installer = `Kairos_${version}_x64-setup.exe`;
const signature = readFileSync(join(dir, `${installer}.sig`), "utf8").trim();
const repo = "https://github.com/ibrahimhere1995-hue/kairos";

const manifest = {
  version,
  notes: process.argv[2] ?? "",
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `${repo}/releases/download/v${version}/${installer}`,
    },
  },
};
writeFileSync(join(dir, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `Wrote ${dir}/latest.json for v${version}. Upload: ${installer}, ${installer}.sig, latest.json`,
);
