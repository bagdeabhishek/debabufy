#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const packages = ["chrome", "firefox"].map((browser) => ({
  browser,
  archive: path.join(dist, `tds-26qb-assistant-${browser}.zip`)
}));
const requiredEntries = [
  "LICENSE",
  "PRIVACY.md",
  "THIRD_PARTY_NOTICES.md",
  "manifest.json",
  "popup.html",
  "popup.js",
  "background.js",
  "content.js",
  "diagnostic-bridge.js",
  "icons/icon-16.png",
  "icons/icon-32.png",
  "icons/icon-48.png",
  "icons/icon-128.png",
  "vendor/PDFJS_LICENSE"
];

for (const packageConfig of packages) {
  const archiveName = path.basename(packageConfig.archive);
  const checksum = `${packageConfig.archive}.sha256`;
  const expectedLine = (await fs.readFile(checksum, "utf8")).trim();
  const expectedPattern = new RegExp(
    `^([a-f0-9]{64})\\s+${escapeRegExp(archiveName)}$`
  );
  const match = expectedLine.match(expectedPattern);
  if (!match) {
    throw new Error(`Malformed ${packageConfig.browser} checksum file.`);
  }

  const actual = createHash("sha256")
    .update(await fs.readFile(packageConfig.archive))
    .digest("hex");
  if (actual !== match[1]) {
    throw new Error(`${packageConfig.browser} package checksum mismatch.`);
  }

  const integrity = spawnSync("unzip", ["-tqq", packageConfig.archive], {
    encoding: "utf8"
  });
  if (integrity.status !== 0) {
    throw new Error(
      `${packageConfig.browser} ZIP integrity check failed: ${integrity.stderr}`
    );
  }

  const listing = runUnzip(["-Z1", packageConfig.archive])
    .split("\n")
    .filter(Boolean);
  for (const entry of requiredEntries) {
    if (!listing.includes(entry)) {
      throw new Error(
        `${packageConfig.browser} package is missing required entry: ${entry}`
      );
    }
  }
  for (const entry of listing) {
    if (
      entry.startsWith("/") ||
      entry.split("/").includes("..") ||
      entry.startsWith("node_modules/") ||
      entry.startsWith(".git/")
    ) {
      throw new Error(
        `${packageConfig.browser} package contains unsafe entry: ${entry}`
      );
    }
  }

  const manifest = JSON.parse(
    runUnzip(["-p", packageConfig.archive, "manifest.json"])
  );
  if (packageConfig.browser === "chrome") {
    if (!manifest.minimum_chrome_version) {
      throw new Error("Chrome package is missing minimum_chrome_version.");
    }
    if (manifest.browser_specific_settings) {
      throw new Error("Chrome package contains Firefox-only manifest settings.");
    }
    if (
      manifest.background?.service_worker !== "background.js" ||
      !manifest.content_scripts?.some(
        (entry) =>
          entry.world === "MAIN" &&
          entry.js?.includes("diagnostic-bridge.js") &&
          entry.matches?.length === 1 &&
          entry.matches[0] === "https://eportal.incometax.gov.in/*"
      )
    ) {
      throw new Error("Chrome package is missing its diagnostic recorder wiring.");
    }
  } else {
    if (manifest.minimum_chrome_version) {
      throw new Error("Firefox package contains a Chrome-only manifest setting.");
    }
    if (
      manifest.browser_specific_settings?.gecko
        ?.data_collection_permissions?.required?.[0] !== "none"
    ) {
      throw new Error(
        "Firefox package must explicitly declare that it collects no data."
      );
    }
    if (
      manifest.background?.scripts?.[0] !== "background.js" ||
      manifest.content_scripts?.some((entry) => entry.world === "MAIN")
    ) {
      throw new Error("Firefox package contains incompatible Chrome wiring.");
    }
  }

  console.log(
    `Verified ${packageConfig.browser} SHA-256 ${actual} and package contents`
  );
}

function runUnzip(argumentsList) {
  const result = spawnSync("unzip", argumentsList, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || `unzip ${argumentsList.join(" ")} failed.`);
  }
  return result.stdout;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
