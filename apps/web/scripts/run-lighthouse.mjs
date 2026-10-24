import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import puppeteer from "puppeteer-core";

const require = createRequire(import.meta.url);
const cli = require.resolve("@lhci/cli/src/cli.js");
const profileParent = resolve(tmpdir());
const profile = await mkdtemp(join(profileParent, "mpreply-lighthouse-"));
let browser;

try {
  browser = await puppeteer.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" }),
    headless: true,
    userDataDir: profile,
  });
  const port = new URL(browser.wsEndpoint()).port;
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(process.execPath, [cli, "autorun", ...process.argv.slice(2), `--collect.settings.port=${port}`], {
      stdio: "inherit",
      windowsHide: true,
    });
    const interrupt = () => child.kill("SIGINT");
    process.once("SIGINT", interrupt);
    child.once("error", reject);
    child.once("close", (code) => {
      process.removeListener("SIGINT", interrupt);
      resolveExit(code ?? 1);
    });
  });
  process.exitCode = exitCode;
} finally {
  try {
    await browser?.close();
  } finally {
    if (dirname(profile) !== profileParent || !basename(profile).startsWith("mpreply-lighthouse-")) {
      throw new Error("Refusing to remove a profile outside the owned temporary directory");
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
  }
}
