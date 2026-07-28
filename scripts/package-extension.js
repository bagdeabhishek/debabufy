#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dist = path.join(root, "dist");
const packages = ["chrome", "firefox"].map((browser) => ({
  browser,
  source: path.join(dist, browser),
  archive: path.join(dist, `tds-26qb-assistant-${browser}.zip`)
}));

for (const legacyFile of [
  "tds-26qb-assistant.zip",
  "tds-26qb-assistant.zip.sha256"
]) {
  await fs.rm(path.join(dist, legacyFile), { force: true });
}

for (const packageConfig of packages) {
  const checksum = `${packageConfig.archive}.sha256`;
  await fs.rm(packageConfig.archive, { force: true });
  await fs.rm(checksum, { force: true });

  const result = spawnSync("zip", ["-Xqr", packageConfig.archive, "."], {
    cwd: packageConfig.source,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    process.stderr.write(
      result.stderr || `Unable to create ${packageConfig.browser} archive.\n`
    );
    process.exit(result.status ?? 1);
  }

  const digest = createHash("sha256")
    .update(await fs.readFile(packageConfig.archive))
    .digest("hex");
  await fs.writeFile(
    checksum,
    `${digest}  ${path.basename(packageConfig.archive)}\n`,
    "utf8"
  );
  console.log(
    `Packaged ${packageConfig.browser} extension at ${packageConfig.archive}`
  );
  console.log(`Wrote SHA-256 checksum at ${checksum}`);
}
