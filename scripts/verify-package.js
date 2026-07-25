#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.join(process.cwd(), "dist");
const archive = path.join(dist, "tds-26qb-assistant.zip");
const checksum = `${archive}.sha256`;

const expectedLine = (await fs.readFile(checksum, "utf8")).trim();
const match = expectedLine.match(/^([a-f0-9]{64})\s+tds-26qb-assistant\.zip$/);
if (!match) throw new Error("Malformed extension checksum file.");

const actual = createHash("sha256")
  .update(await fs.readFile(archive))
  .digest("hex");
if (actual !== match[1]) throw new Error("Extension package checksum mismatch.");

console.log(`Verified SHA-256 ${actual}`);
