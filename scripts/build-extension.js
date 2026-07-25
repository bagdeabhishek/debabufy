#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const source = path.join(root, "extension");
const target = path.join(root, "dist", "extension");
const libTarget = path.join(target, "lib");
const vendorTarget = path.join(target, "vendor");

await fs.rm(target, { recursive: true, force: true });
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.cp(source, target, { recursive: true });
await fs.mkdir(libTarget, { recursive: true });
await fs.mkdir(vendorTarget, { recursive: true });

for (const file of ["statement.js", "infer.js", "pdf.js"]) {
  await fs.copyFile(path.join(root, "src", "lib", file), path.join(libTarget, file));
}
for (const file of ["pdf.mjs", "pdf.worker.mjs"]) {
  await fs.copyFile(
    path.join(root, "node_modules", "pdfjs-dist", "build", file),
    path.join(vendorTarget, file)
  );
}

const manifest = JSON.parse(await fs.readFile(path.join(target, "manifest.json"), "utf8"));
console.log(`Built ${manifest.name} v${manifest.version} at ${target}`);
