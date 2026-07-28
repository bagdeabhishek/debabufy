#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const archive = path.join(dist, "form141-assistant-cli.tgz");
const checksum = `${archive}.sha256`;
if (!fs.existsSync(archive) || !fs.existsSync(checksum)) {
  throw new Error("CLI archive or checksum is missing.");
}

const expected = fs.readFileSync(checksum, "utf8").trim().split(/\s+/)[0];
const actual = createHash("sha256")
  .update(fs.readFileSync(archive))
  .digest("hex");
if (expected !== actual) throw new Error("CLI package checksum does not match.");

const listing = spawnSync("tar", ["-tzf", archive], { encoding: "utf8" });
if (listing.status !== 0) {
  throw new Error(listing.stderr || "Unable to inspect CLI archive.");
}
const files = listing.stdout.trim().split("\n");
for (const required of [
  "package/bin/form141-assistant.js",
  "package/extension/content.js",
  "package/src/cli/args.js",
  "package/src/lib/infer.js",
  "package/src/lib/pdf.js",
  "package/src/lib/statement.js",
  "package/package.json",
  "package/LICENSE",
  "package/README.md"
]) {
  if (!files.includes(required)) throw new Error(`CLI package is missing ${required}.`);
}

const forbidden = /(?:^|\/)(?:raw|private|sanitized|node_modules|browser-profile|receipts|screenshots)(?:\/|$)|\.(?:har|pdf)$/i;
const unsafe = files.find((file) => forbidden.test(file));
if (unsafe) throw new Error(`CLI package contains forbidden path: ${unsafe}`);

console.log(`Verified CLI SHA-256 ${actual} and package contents`);
