#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, "extension");
const sourceManifest = JSON.parse(
  await fs.readFile(path.join(source, "manifest.json"), "utf8")
);
const targets = [
  {
    browser: "chrome",
    transformManifest(manifest) {
      delete manifest.browser_specific_settings;
      return manifest;
    }
  },
  {
    browser: "firefox",
    transformManifest(manifest) {
      delete manifest.minimum_chrome_version;
      return manifest;
    }
  }
];

await fs.rm(path.join(root, "dist", "extension"), {
  recursive: true,
  force: true
});

for (const targetConfig of targets) {
  const target = path.join(root, "dist", targetConfig.browser);
  const libTarget = path.join(target, "lib");
  const vendorTarget = path.join(target, "vendor");

  await fs.rm(target, { recursive: true, force: true });
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.cp(source, target, { recursive: true });
  await fs.mkdir(libTarget, { recursive: true });
  await fs.mkdir(vendorTarget, { recursive: true });

  for (const file of ["statement.js", "infer.js", "pdf.js"]) {
    await fs.copyFile(
      path.join(root, "src", "lib", file),
      path.join(libTarget, file)
    );
  }
  for (const file of ["pdf.mjs", "pdf.worker.mjs"]) {
    await fs.copyFile(
      path.join(root, "node_modules", "pdfjs-dist", "build", file),
      path.join(vendorTarget, file)
    );
  }
  await fs.copyFile(
    path.join(root, "node_modules", "pdfjs-dist", "LICENSE"),
    path.join(vendorTarget, "PDFJS_LICENSE")
  );
  for (const file of ["LICENSE", "PRIVACY.md", "THIRD_PARTY_NOTICES.md"]) {
    await fs.copyFile(path.join(root, file), path.join(target, file));
  }

  const manifest = targetConfig.transformManifest(
    structuredClone(sourceManifest)
  );
  await fs.writeFile(
    path.join(target, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  console.log(
    `Built ${manifest.name} v${manifest.version} for ${targetConfig.browser} at ${target}`
  );
}
