#!/usr/bin/env node

import fs from "node:fs/promises";
import process from "node:process";
import readline from "node:readline/promises";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright-core";
import { parseCliArgs } from "../src/cli/args.js";
import {
  inferNextFiling,
  monthOfDeduction,
  validateReviewedFiling
} from "../src/lib/infer.js";
import { extractPdfText } from "../src/lib/pdf.js";
import { normalizeStatementJson, parseStatementText } from "../src/lib/statement.js";

const PORTAL_URL = "https://www.incometax.gov.in/iec/foportal/";
const cli = readline.createInterface({ input: process.stdin, output: process.stdout });

try {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    process.exitCode = 0;
  } else {
    await run(options);
  }
} catch (error) {
  console.error(`\nError: ${error.message || String(error)}`);
  process.exitCode = 1;
} finally {
  cli.close();
}

async function run(options) {
  const filing = options.probe
    ? null
    : options.candidate
      ? await readCandidate(options.candidate)
      : await prepareFromStatement(options);

  if (filing) printReview(filing);
  if (options.dryRun) {
    console.log("\nDry run complete. No browser was opened and no portal field was changed.");
    return;
  }

  if (filing) {
    const confirmation = await cli.question(
      "\nType REVIEWED after checking the parties, property, dates, rate, TDS, interest, fee, and total: "
    );
    if (confirmation.trim() !== "REVIEWED") {
      throw new Error("Review was not confirmed; nothing was filled.");
    }
    filing.review ??= { warnings: [], decisions: [] };
    filing.review.approved = true;
    filing.review.approved_at = new Date().toISOString();
    const errors = validateReviewedFiling(filing);
    if (errors.length) throw new Error(errors.join(" "));
  }

  console.log("\nAttaching to the ordinary Chrome session you started and logged into.");
  console.log(`DevTools endpoint: ${options.cdp}`);
  let browser;
  try {
    browser = await chromium.connectOverCDP(options.cdp);
  } catch (error) {
    throw new Error(
      `Could not attach to Chrome at ${options.cdp}. Start Chrome with the ` +
      "documented local remote-debugging command, log in, and retry. " +
      `Underlying error: ${error.message || String(error)}`
    );
  }
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error("The attached Chrome session did not expose a browser context.");
  }

  const pages = context.pages();
  const page = await activePortalPage(pages);
  if (!page) {
    throw new Error(
      `No Income Tax portal tab is open in the attached Chrome session. Open ${PORTAL_URL}, ` +
      "log in, navigate to Form 141 Schedule B, and run the command again."
    );
  }

  try {
    const automationMarker = await page.evaluate(() => navigator.webdriver);
    if (automationMarker) {
      throw new Error(
        "Chrome reports navigator.webdriver=true. This is still an automation-launched " +
        "browser, so the Income Tax portal may reject it. Close it and use the manual " +
        "Chrome startup command from docs/ATTACH_EXISTING_CHROME.md."
      );
    }
    console.log(`Attached to accepted Chrome: ${await page.title()} (${page.url()})`);
    console.log("Browser automation launch marker: absent.");
    if (options.probe) {
      console.log("Attach probe passed. No page field, navigation, or network request was changed.");
      return;
    }
    await installPageHelper(context);
    console.log("The CLI will never enter credentials, solve CAPTCHA/OTP, submit, or pay.");

    while (true) {
      const activePage = await activePortalPage(context.pages()) ?? page;
      const command = (await cli.question(
        "\nWhen the relevant page/dialog is visible: [Enter] fill · p preview · d diagnose · q quit: "
      )).trim().toLowerCase();
      if (command === "q" || command === "quit") break;
      if (command === "d" || command === "diagnose") {
        const diagnosticPath = await saveLivePageDiagnostics(activePage);
        console.log(`Saved live rendered-page diagnostics: ${diagnosticPath}`);
        continue;
      }

      const type = command === "p" ? "FORM141_PREVIEW" : "FORM141_FILL";
      const result = await invokeHelper(activePage, {
        type,
        filing,
        overwrite: false
      });
      printPortalResult(result);
      console.log(
        "Use the portal's Add/Save/Continue control yourself, then open the next section and press Enter again."
      );
    }
  } finally {
    // For connectOverCDP, Browser.close() closes Playwright's transport. The
    // manually started Chrome process and its tabs remain open.
    await browser.close();
  }

  console.log("\nStopped before submission and payment.");
}

async function prepareFromStatement(options) {
  const bytes = await fs.readFile(options.statement);
  const lower = options.statement.toLowerCase();
  let previous;
  if (lower.endsWith(".pdf")) {
    previous = parseStatementText(await extractPdfText(pdfjs, bytes));
  } else if (lower.endsWith(".json")) {
    previous = normalizeStatementJson(JSON.parse(bytes.toString("utf8")));
  } else {
    previous = parseStatementText(bytes.toString("utf8"));
  }
  return inferNextFiling(previous, {
    amount: options.amount,
    paymentDate: options.date
  });
}

async function readCandidate(candidatePath) {
  const filing = JSON.parse(await fs.readFile(candidatePath, "utf8"));
  if (!filing?.meta || !filing?.property || !filing?.transaction || !filing?.tax_deposit) {
    throw new Error("--candidate must be a reviewed filing JSON generated by this project.");
  }
  filing.review ??= { approved: false, warnings: [], decisions: [] };
  if (/^2026(?:-27)?$/.test(String(filing.meta?.tax_year ?? ""))) {
    filing.meta.form = "141-SCHEDULE-B";
    filing.portal ??= {};
    filing.portal.form_flow ??= "FORM_141_SCHEDULE_B";
    filing.portal.month_of_deduction ??=
      monthOfDeduction(filing.transaction?.payment_date);
    filing.portal.nature_transaction ??= "Schedule B";
    filing.portal.deductee_type ??=
      filing.portal.property_type_label ?? null;
  }
  return filing;
}

function printReview(filing) {
  console.log("\nForm 141 Schedule B proposal");
  console.log(`  Tax year: ${filing.meta?.tax_year ?? "—"}`);
  console.log(`  Parties: ${filing.buyers?.length ?? 0} buyer(s), ${filing.sellers?.length ?? 0} seller(s)`);
  console.log(`  Previous instalments: ${money(filing.transaction?.cumulative_previous_installments)}`);
  console.log(`  Current payment: ${money(filing.transaction?.current_payment_amount)}`);
  console.log(`  Payment/deduction date: ${filing.transaction?.payment_date ?? "—"}`);
  console.log(`  Proposed rate: ${number(filing.tax_deposit?.rate_percent)}%`);
  console.log(`  Proposed TDS: ${money(filing.tax_deposit?.tds_amount)}`);
  console.log(`  Interest: ${money(filing.tax_deposit?.interest)}`);
  console.log(`  Fee: ${money(filing.tax_deposit?.other_fee)}`);
  console.log(`  Total: ${money(filing.tax_deposit?.total_amount)}`);
  for (const warning of filing.review?.warnings ?? []) {
    console.log(`  WARNING: ${warning}`);
  }
  console.log("  PANs, names, contacts, and addresses are intentionally not printed.");
}

function printPortalResult(result) {
  if (!result?.ok) throw new Error(result?.error ?? "Portal helper failed.");
  const verb = result.mode === "preview" ? "Matched" : "Filled";
  const count = result.mode === "preview" ? result.matched : result.filled;
  console.log(`\n${verb} ${count ?? 0} field(s) on ${result.page}.`);
  console.log(
    `${result.skipped ?? 0} already populated; ${result.unsupported ?? 0} manual controls; ` +
    `${result.missing ?? 0} relevant fields not found; ${result.deferred ?? 0} deferred to other sections.`
  );
  if (result.note) console.log(result.note);
  const unresolved = (result.details ?? [])
    .filter((detail) => ["missing", "unsupported"].includes(detail.outcome))
    .map((detail) => detail.path);
  if (unresolved.length) console.log(`Unresolved: ${unresolved.join(", ")}`);
  const mapped = (result.details ?? []).filter((detail) =>
    ["matched", "filled", "already-populated", "unsupported"].includes(detail.outcome)
  );
  if (mapped.length) {
    console.log("Control mappings:");
    for (const detail of mapped) {
      const keys = detail.controlKeys?.length
        ? detail.controlKeys.join(", ")
        : `${detail.controlTag ?? "control"}${detail.controlType ? `:${detail.controlType}` : ""}`;
      console.log(
        `  ${detail.path} -> ${keys} [${detail.outcome}]` +
        `${detail.controlLabel ? ` · ${detail.controlLabel}` : ""}`
      );
    }
  }
}

async function installPageHelper(context) {
  const source = await fs.readFile(
    new URL("../extension/content.js", import.meta.url),
    "utf8"
  );
  const mock = `
    globalThis.__form141ScheduleBAssistantLoaded = false;
    globalThis.__form141CliListener = null;
    globalThis.__form141CliApi = {
      runtime: {
        onMessage: {
          addListener(listener) {
            globalThis.__form141CliListener = listener;
          }
        }
      }
    };
  `;
  await context.addInitScript({ content: `${mock}\n${source}` });
  for (const page of context.pages()) {
    if (!/^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(page.url())) {
      continue;
    }
    await injectCurrentDocument(page, mock, source);
  }
}

async function injectCurrentDocument(page, mock, source) {
  try {
    await page.evaluate(`${mock}\n${source}`);
    const installed = await page.evaluate(
      () => typeof globalThis.__form141CliListener === "function"
    );
    if (!installed) {
      throw new Error("the helper listener was not registered");
    }
  } catch (error) {
    throw new Error(
      `Could not install the portal helper in the current Form 141 page: ` +
      `${error.message || String(error)}`
    );
  }
}

async function invokeHelper(page, message) {
  await page.waitForLoadState("domcontentloaded");
  const hasListener = await page.evaluate(() => Boolean(globalThis.__form141CliListener));
  if (!hasListener) {
    throw new Error("The portal helper is not loaded on this page. Reload it and try again.");
  }
  return page.evaluate((payload) => new Promise((resolve) => {
    const returned = globalThis.__form141CliListener(payload, null, resolve);
    if (returned !== true) resolve({ ok: false, error: "Portal helper did not accept the request." });
  }), message);
}

async function saveLivePageDiagnostics(page) {
  const diagnostics = await invokeHelper(page, {
    type: "FORM141_DIAGNOSTICS"
  });
  if (!diagnostics?.ok) {
    throw new Error("Could not inspect the current rendered portal page.");
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = `form141-live-page-${timestamp}.json`;
  await fs.writeFile(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  return outputPath;
}

async function activePortalPage(pages) {
  const candidates = [...pages].reverse().filter((page) =>
    /^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(page.url())
  );
  for (const page of candidates) {
    try {
      if (await page.evaluate(() => document.visibilityState === "visible")) {
        return page;
      }
    } catch {
      // Ignore a portal tab while it is navigating and try the next one.
    }
  }
  return candidates[0] ?? null;
}

function money(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(parsed)
    : "—";
}

function number(value) {
  return Number.isFinite(Number(value)) ? String(value) : "—";
}

function printHelp() {
  console.log(`
Form 141 Schedule B Assistant CLI

Prepare from the previous challan statement:
  form141-assistant --statement previous.pdf --amount 500000 --date 2026-07-28

Use an already generated candidate:
  form141-assistant --candidate form141-next-instalment.json

Options:
  --statement <path>   Previous Form 141 Schedule B challan statement (PDF/JSON/text)
  --candidate <path>   Existing filing candidate JSON (instead of --statement)
  --amount <rupees>    Current payment amount; required with --statement
  --date <YYYY-MM-DD>  Payment/deduction date; defaults to today
  --cdp <url>          Local Chrome DevTools URL; defaults to http://127.0.0.1:9222
  --probe              Verify an accepted portal tab can be attached; change nothing
  --dry-run            Parse and summarize without opening a browser
  --help               Show this help

Start ordinary Chrome yourself with a non-default user-data directory and local
remote debugging, then log in before running this command. The CLI attaches to
that accepted browser; it never launches a Playwright automation profile.

The CLI never enters credentials, solves CAPTCHA/OTP, submits the form, creates a
payment, or authorizes payment.
`.trim());
}
