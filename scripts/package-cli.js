#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const archive = path.join(dist, "form141-assistant-cli.tgz");
const checksum = `${archive}.sha256`;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "form141-cli-pack-"));

try {
  await fs.mkdir(dist, { recursive: true });
  await fs.rm(archive, { force: true });
  await fs.rm(checksum, { force: true });

  const result = spawnSync(
    "npm",
    ["pack", "--pack-destination", temp],
    { cwd: root, encoding: "utf8" }
  );
  if (result.status !== 0) {
    process.stderr.write(result.stderr || "Unable to create CLI package.\n");
    process.exit(result.status ?? 1);
  }

  const filename = (await fs.readdir(temp))
    .find((candidate) => candidate.endsWith(".tgz"));
  if (!filename) throw new Error("npm pack did not create an archive.");
  await fs.copyFile(path.join(temp, filename), archive);

  const digest = createHash("sha256")
    .update(await fs.readFile(archive))
    .digest("hex");
  await fs.writeFile(
    checksum,
    `${digest}  ${path.basename(archive)}\n`,
    "utf8"
  );
  console.log(`Packaged CLI at ${archive}`);
  console.log(`Wrote SHA-256 checksum at ${checksum}`);
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
