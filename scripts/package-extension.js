#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const extension = path.join(dist, "extension");
const archive = path.join(dist, "tds-26qb-assistant.zip");

await fs.rm(archive, { force: true });
const result = spawnSync("zip", ["-qr", archive, "."], {
  cwd: extension,
  encoding: "utf8"
});
if (result.status !== 0) {
  process.stderr.write(result.stderr || "Unable to create extension archive.\n");
  process.exit(result.status ?? 1);
}
console.log(`Packaged extension at ${archive}`);
