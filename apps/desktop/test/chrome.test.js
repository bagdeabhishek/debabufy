import test from "node:test";
import assert from "node:assert/strict";
import { chromeCandidates } from "../chrome.js";

test("Windows Chrome detection checks machine and user installs", () => {
  const candidates = chromeCandidates({
    platform: "win32",
    env: {
      PROGRAMFILES: "C:\\Program Files",
      "PROGRAMFILES(X86)": "C:\\Program Files (x86)",
      LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local"
    }
  });

  assert.deepEqual(candidates, [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Users\\Test\\AppData\\Local\\Google\\Chrome\\Application\\chrome.exe"
  ]);
});

test("Linux Chrome detection uses known executable locations", () => {
  assert.deepEqual(
    chromeCandidates({ platform: "linux", env: {} }),
    [
      "/usr/bin/google-chrome",
      "/usr/bin/google-chrome-stable",
      "/opt/google/chrome/google-chrome"
    ]
  );
});
