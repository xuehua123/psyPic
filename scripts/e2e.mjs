#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const playwrightCli = path.join(rootDir, "node_modules", "@playwright", "test", "cli.js");

const env = { ...process.env };
env.PLAYWRIGHT_BROWSERS_PATH ??= path.join(rootDir, ".playwright-browsers");

const forwardedArgs = [];
const args = process.argv.slice(2);

for (let index = 0; index < args.length; index += 1) {
  const arg = args[index];
  const inlineChannel = arg.match(/^--(?:browser-)?channel=(.+)$/);

  if (inlineChannel) {
    env.PSYPIC_E2E_BROWSER_CHANNEL = inlineChannel[1];
    continue;
  }

  if (arg === "--channel" || arg === "--browser-channel") {
    const channel = args[index + 1];
    if (!channel) {
      console.error(`${arg} requires a browser channel value, for example chrome.`);
      process.exit(1);
    }
    env.PSYPIC_E2E_BROWSER_CHANNEL = channel;
    index += 1;
    continue;
  }

  forwardedArgs.push(arg);
}

const child = spawn(process.execPath, [playwrightCli, ...forwardedArgs], {
  cwd: rootDir,
  env,
  stdio: "inherit"
});

child.on("error", error => {
  console.error(error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Playwright exited with signal ${signal}.`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});
