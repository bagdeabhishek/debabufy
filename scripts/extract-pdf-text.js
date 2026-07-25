#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractPdfText } from "../src/lib/pdf.js";

const path = process.argv[2];
if (!path) {
  console.error("Usage: npm run inspect:pdf -- /path/to/statement.pdf");
  process.exit(2);
}

const bytes = await fs.readFile(path);
const text = await extractPdfText(pdfjs, bytes);
process.stdout.write(text);
