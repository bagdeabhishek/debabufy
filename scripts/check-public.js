#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const syntaxFiles = [
  "extension/content.js",
  "extension/popup.js",
  "scripts/build-extension.js",
  "scripts/check-public.js",
  "scripts/extract-pdf-text.js",
  "scripts/package-extension.js",
  "scripts/verify-package.js",
  "src/lib/infer.js",
  "src/lib/pdf.js",
  "src/lib/statement.js",
  "test/statement.test.js"
];

const errors = [];
for (const file of syntaxFiles) {
  const result = spawnSync(process.execPath, ["--check", file], {
    cwd: root,
    encoding: "utf8"
  });
  if (result.status !== 0) errors.push(`${file}: ${result.stderr.trim()}`);
}

const manifest = readJson("extension/manifest.json");
readJson("package.json");
readJson("package-lock.json");
if (!fs.existsSync(path.join(root, "node_modules/pdfjs-dist/LICENSE"))) {
  errors.push("The bundled PDF.js dependency license is missing.");
}
for (const file of ["LICENSE", "PRIVACY.md", "THIRD_PARTY_NOTICES.md"]) {
  if (!fs.existsSync(path.join(root, file))) {
    errors.push(`Required release document is missing: ${file}`);
  }
}

const forbiddenPermissions = new Set([
  "cookies",
  "downloads",
  "history",
  "tabs",
  "webRequest",
  "webRequestBlocking",
  "<all_urls>"
]);
for (const permission of [
  ...(manifest.permissions ?? []),
  ...(manifest.host_permissions ?? [])
]) {
  if (forbiddenPermissions.has(permission)) {
    errors.push(`Forbidden public extension permission: ${permission}`);
  }
}
if ((manifest.permissions ?? []).includes("scripting")) {
  errors.push("Runtime scripting permission is not allowed.");
}

const matches = (manifest.content_scripts ?? []).flatMap((entry) => entry.matches ?? []);
const allowedMatches = new Set([
  "https://www.incometax.gov.in/*",
  "https://eportal.incometax.gov.in/*"
]);
for (const match of matches) {
  if (!allowedMatches.has(match)) errors.push(`Unexpected content-script host: ${match}`);
}

const popupSource = fs.readFileSync(path.join(root, "extension/popup.js"), "utf8");
if (/storage\.(?:local|sync)\b/.test(popupSource)) {
  errors.push("Disk-backed or synchronized extension storage is not allowed.");
}
if (!/storage\.session\b/.test(popupSource)) {
  errors.push("Popup must use in-memory storage.session.");
}

const scanRoots = [
  ".github",
  "docs",
  "extension",
  "scripts",
  "src",
  "test",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "EXTENSION.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "package.json"
];
const forbiddenPatterns = [
  ["PAN-shaped literal", /\b[A-Z]{5}\d{4}[A-Z]\b/g],
  ["GitHub token", /\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{20,}\b/g],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["email outside reserved example domain", /\b[A-Z0-9._%+-]+@(?!example\.invalid\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/gi]
];
for (const file of collectFiles(scanRoots)) {
  if (file.includes(`${path.sep}vendor${path.sep}`)) continue;
  const contents = fs.readFileSync(file, "utf8");
  for (const [label, pattern] of forbiddenPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) {
      errors.push(`${path.relative(root, file)} contains a ${label}.`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Public-source checks passed.");

function readJson(relativePath) {
  const file = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(`${relativePath}: ${error.message}`);
    return {};
  }
}

function collectFiles(entries) {
  const files = [];
  for (const entry of entries) {
    const target = path.join(root, entry);
    if (!fs.existsSync(target)) continue;
    const stats = fs.statSync(target);
    if (stats.isFile()) {
      files.push(target);
      continue;
    }
    for (const child of fs.readdirSync(target, { withFileTypes: true })) {
      const relative = path.join(entry, child.name);
      if (child.isDirectory()) files.push(...collectFiles([relative]));
      else if (child.isFile()) files.push(path.join(root, relative));
    }
  }
  return files;
}
