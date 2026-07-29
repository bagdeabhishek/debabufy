import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const CDP_URL = "http://127.0.0.1:9222";
const PORTAL_URL = "https://www.incometax.gov.in/iec/foportal/";

export function chromeCandidates({
  platform = process.platform,
  env = process.env
} = {}) {
  if (platform === "win32") {
    const join = path.win32.join;
    return [
      env.PROGRAMFILES &&
        join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
      env["PROGRAMFILES(X86)"] &&
        join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
      env.LOCALAPPDATA &&
        join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe")
    ].filter(Boolean);
  }
  if (platform === "darwin") {
    return [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      path.join(
        env.HOME || "",
        "Applications",
        "Google Chrome.app",
        "Contents",
        "MacOS",
        "Google Chrome"
      )
    ];
  }
  return [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/opt/google/chrome/google-chrome"
  ];
}

export function findChrome(options) {
  return chromeCandidates(options).find((candidate) => fs.existsSync(candidate)) ?? null;
}

export async function cdpIsReady(cdp = CDP_URL) {
  try {
    const response = await fetch(`${cdp}/json/version`, {
      signal: AbortSignal.timeout(1_500)
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function launchOrdinaryChrome({
  userDataDirectory,
  cdp = CDP_URL
}) {
  if (await cdpIsReady(cdp)) {
    return { cdp, reused: true };
  }

  const executable = findChrome();
  if (!executable) {
    throw new Error(
      "Google Chrome was not found. Install Chrome, then restart DeBabufy."
    );
  }

  fs.mkdirSync(userDataDirectory, { recursive: true });
  const parsed = new URL(cdp);
  const port = parsed.port || "9222";
  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${userDataDirectory}`,
    "--no-first-run",
    "--no-default-browser-check",
    PORTAL_URL
  ], {
    detached: true,
    stdio: "ignore",
    windowsHide: false
  });
  child.unref();

  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (await cdpIsReady(cdp)) {
      return { cdp, reused: false };
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(
    "Chrome opened, but DeBabufy could not connect to it. Close that Chrome " +
    "window, restart DeBabufy, and try again."
  );
}

export const chromeDefaults = {
  cdp: CDP_URL,
  portal: PORTAL_URL
};
