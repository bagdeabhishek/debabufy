#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { chromium } from "playwright-core";
import { parseCliArgs } from "./cli/args.js";
import {
  inferNextFiling,
  monthOfDeduction,
  validateReviewedFiling
} from "./src/infer.js";
import { extractPdfText } from "./src/pdf.js";
import {
  detailSectionIndex,
  expectedBuyerShare,
  filingWithPortalBuyerShare
} from "./src/portal.js";
import { normalizeStatementJson, parseStatementText } from "./src/statement.js";

const PORTAL_URL = "https://www.incometax.gov.in/iec/foportal/";
const isMain = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
let cli = null;

if (isMain) {
  cli = readline.createInterface({ input: process.stdin, output: process.stdout });
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
        "\nOn Schedule B: [Enter] fill · a add all detail rows · p preview · d diagnose · q quit: "
      )).trim().toLowerCase();
      if (command === "q" || command === "quit") break;
      if (command === "d" || command === "diagnose") {
        const diagnosticPath = await saveLivePageDiagnostics(activePage);
        console.log(`Saved live rendered-page diagnostics: ${diagnosticPath}`);
        continue;
      }
      if (command === "a" || command === "add" || command === "auto") {
        const summary = await automateDetailRows(activePage, filing);
        console.log(
          `\nDetail-row automation complete: ${summary.added} added; ` +
          `${summary.updated} updated; ${summary.existing} already present.`
        );
        console.log(
          "Review the saved rows and totals. Continue, submission, and payment were not clicked."
        );
        continue;
      }

      const type = command === "p" ? "FORM141_PREVIEW" : "FORM141_FILL";
      let result = await invokeHelper(activePage, {
        type,
        filing,
        overwrite: false
      });
      if (type === "FORM141_FILL") {
        result = await fillConditionalControls(activePage, filing, result);
      }
      printPortalResult(result);
      console.log(
        "Use the portal controls yourself, or return to the main Schedule B page and press a to add all detail rows."
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

export async function prepareForm141Proposal({
  statementPath,
  amount,
  paymentDate = localDate()
}) {
  const filing = await prepareFromStatement({
    statement: path.resolve(statementPath),
    amount,
    date: paymentDate
  });
  return {
    filing,
    summary: proposalSummary(filing)
  };
}

export async function runForm141Automation({
  filing,
  cdp = "http://127.0.0.1:9222",
  diagnosticsDirectory = process.cwd(),
  onProgress = () => {}
}) {
  filing.review ??= { warnings: [], decisions: [] };
  filing.review.approved = true;
  filing.review.approved_at = new Date().toISOString();
  const errors = validateReviewedFiling(filing);
  if (errors.length) throw new Error(errors.join(" "));

  onProgress({
    stage: "connecting",
    message: "Connecting to the ordinary Chrome session…"
  });
  let browser;
  try {
    browser = await chromium.connectOverCDP(cdp);
  } catch (error) {
    throw new Error(
      `Could not attach to Chrome at ${cdp}. Start Chrome from DeBabufy, ` +
      `log in, and try again. Underlying error: ${error.message || String(error)}`
    );
  }

  try {
    const context = browser.contexts()[0];
    if (!context) {
      throw new Error("The attached Chrome session did not expose a browser context.");
    }
    const page = await activePortalPage(context.pages());
    if (!page) {
      throw new Error(
        `No Income Tax portal tab is open. Open ${PORTAL_URL}, log in, ` +
        "and navigate to the Form 141 Schedule B page."
      );
    }
    if (await page.evaluate(() => navigator.webdriver)) {
      throw new Error(
        "Chrome reports an automation launch marker. Close it and use the " +
        "ordinary Chrome session launched by DeBabufy."
      );
    }

    onProgress({
      stage: "attached",
      message: `Connected to ${await page.title() || "the Income Tax portal"}.`
    });
    await installPageHelper(context);
    const diagnostics = await portalDiagnostics(page);
    if (diagnostics.page !== "Form 141 Schedule B transaction page") {
      throw new Error(
        "Log in and open the main Form 141 Schedule B transaction page " +
        "with no Add Details editor open, then run the workflow again."
      );
    }

    const summary = await automateDetailRows(page, filing, {
      diagnosticsDirectory,
      onProgress
    });
    onProgress({
      stage: "complete",
      message:
        `Finished: ${summary.added} row(s) added, ${summary.updated} updated, ` +
        `${summary.existing} already present. Review the portal before continuing.`
    });
    return summary;
  } finally {
    await browser.close();
  }
}

function proposalSummary(filing) {
  return {
    form: "Form 141 Schedule B",
    taxYear: filing.meta?.tax_year ?? null,
    buyers: filing.buyers?.length ?? 0,
    sellers: filing.sellers?.length ?? 0,
    previousInstallments:
      filing.transaction?.cumulative_previous_installments ?? null,
    currentPayment: filing.transaction?.current_payment_amount ?? null,
    paymentDate: filing.transaction?.payment_date ?? null,
    ratePercent: filing.tax_deposit?.rate_percent ?? null,
    tdsAmount: filing.tax_deposit?.tds_amount ?? null,
    interest: filing.tax_deposit?.interest ?? null,
    fee: filing.tax_deposit?.other_fee ?? null,
    total: filing.tax_deposit?.total_amount ?? null,
    warnings: [...(filing.review?.warnings ?? [])]
  };
}

function localDate(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
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
    [
      "matched",
      "filled",
      "filled-native",
      "filled-calendar",
      "already-populated",
      "unsupported"
    ]
      .includes(detail.outcome)
  );
  if (mapped.length) {
    console.log("Control mappings:");
    for (const detail of mapped) {
      const keys = detail.controlKeys?.length
        ? detail.controlKeys.join(", ")
        : `${detail.controlTag ?? "control"}${detail.controlType ? `:${detail.controlType}` : ""}`;
      console.log(
        `  ${detail.path} -> ${keys} [${detail.outcome}]` +
        `${detail.controlLabel ? ` · ${detail.controlLabel}` : ""}` +
        `${detail.nativeError ? ` · ${detail.nativeError}` : ""}`
      );
    }
  }
}

async function installPageHelper(context) {
  const source = await fs.readFile(
    new URL("./browser/portal-helper.js", import.meta.url),
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

async function saveLivePageDiagnostics(page, outputDirectory = process.cwd()) {
  const diagnostics = await invokeHelper(page, {
    type: "FORM141_DIAGNOSTICS"
  });
  if (!diagnostics?.ok) {
    throw new Error("Could not inspect the current rendered portal page.");
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  await fs.mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(
    outputDirectory,
    `form141-live-page-${timestamp}.json`
  );
  await fs.writeFile(outputPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  return outputPath;
}

async function automateDetailRows(
  page,
  filing,
  {
    diagnosticsDirectory = process.cwd(),
    onProgress = () => {}
  } = {}
) {
  let added = 0;
  let existing = 0;
  let updated = 0;
  try {
    const initial = await portalDiagnostics(page);
    if (initial.page !== "Form 141 Schedule B transaction page") {
      throw new Error(
        "Open the main Form 141 Schedule B page with no Add Details editor open, then press a."
      );
    }

    onProgress({
      stage: "main-form",
      message: "Filling and validating the main Schedule B fields…"
    });
    console.log("\nFilling and validating the main Schedule B fields...");
    const mainResult = await fillConditionalControls(
      page,
      filing,
      await invokeHelper(page, {
        type: "FORM141_FILL",
        filing,
        overwrite: false
      })
    );
    printPortalResult(mainResult);

    const missingBuyerIndexes = [];
    for (let index = 0; index < (filing.buyers ?? []).length; index += 1) {
      const party = filing.buyers[index];
      const row = await partyTableRow(page, party);
      if (!row) {
        missingBuyerIndexes.push(index);
        continue;
      }
      if (await rowContainsPercentage(row, expectedBuyerShare(filing, index))) {
        existing += 1;
        console.log(`Buyer row ${index + 1} is already complete; skipping it.`);
        continue;
      }
      await editExistingBuyerRow(page, filing, index, row);
      updated += 1;
      onProgress({
        stage: "buyers",
        message: `Updated buyer ${index + 1} of ${filing.buyers.length}.`
      });
      console.log(`Buyer row ${index + 1} was updated with its ownership share.`);
    }

    for (const index of missingBuyerIndexes) {
      await addDetailRow(page, filing, "buyer", index);
      added += 1;
      onProgress({
        stage: "buyers",
        message: `Added buyer ${index + 1} of ${filing.buyers.length}.`
      });
      console.log(`Buyer row ${index + 1} added and accepted.`);
    }

    for (let index = 0; index < (filing.sellers ?? []).length; index += 1) {
      const party = filing.sellers[index];
      if (await partyTableRow(page, party)) {
        existing += 1;
        console.log(`Seller row ${index + 1} is already present; skipping it.`);
        continue;
      }
      await addDetailRow(page, filing, "seller", index);
      added += 1;
      onProgress({
        stage: "sellers",
        message: `Added seller ${index + 1} of ${filing.sellers.length}.`
      });
      console.log(`Seller row ${index + 1} added and accepted.`);
    }

    if (await hasSavedTransactionRow(page, filing)) {
      existing += 1;
      console.log("Transaction row is already present; skipping it.");
    } else {
      await addDetailRow(page, filing, "transaction");
      added += 1;
      onProgress({
        stage: "transaction",
        message: "Added the current transaction."
      });
      console.log("Transaction row added and accepted.");
    }

    return { added, existing, updated };
  } catch (error) {
    let diagnosticNote = "";
    try {
      const diagnosticPath = await saveLivePageDiagnostics(
        page,
        diagnosticsDirectory
      );
      diagnosticNote = ` Live diagnostics were saved to ${diagnosticPath}.`;
    } catch {
      diagnosticNote = " Live diagnostics could not be saved.";
    }
    throw new Error(`${error.message || String(error)}${diagnosticNote}`);
  }
}

async function editExistingBuyerRow(page, filing, partyIndex, row) {
  const checkbox = row.locator("input[type='checkbox']").first();
  if (!(await checkbox.isVisible().catch(() => false))) {
    throw new Error(
      `Buyer ${partyIndex + 1}: the existing row's selection checkbox was not found.`
    );
  }
  if (!(await checkbox.isChecked().catch(() => false))) {
    await checkbox.check().catch(async () => {
      await checkbox.click({ force: true });
    });
  }

  const edit = await waitForEnabledActionButton(page, "edit", 5_000);
  if (!edit) {
    throw new Error(
      `Buyer ${partyIndex + 1}: selecting the existing row did not enable Edit.`
    );
  }
  await edit.click();
  await waitForPortalContext(
    page,
    (diagnostics) => detailEditorPages("buyer").includes(diagnostics.page),
    `Buyer ${partyIndex + 1}: the Edit Details editor did not open.`
  );

  const helperOptions = { partyIndex };
  const portalFiling = filingWithPortalBuyerShare(filing);
  let result = await invokeHelper(page, {
    type: "FORM141_FILL",
    filing: portalFiling,
    overwrite: false,
    ...helperOptions
  });
  result = await fillConditionalControls(
    page,
    portalFiling,
    result,
    helperOptions
  );
  printPortalResult(result);

  const commit = await waitForEditorCommitButton(page, 10_000);
  if (!commit) {
    throw new Error(
      `Buyer ${partyIndex + 1}: the editor Update/Save button remained disabled.`
    );
  }
  await commit.click();
  await waitForPortalContext(
    page,
    (diagnostics) =>
      diagnostics.page === "Form 141 Schedule B transaction page",
    `Buyer ${partyIndex + 1}: the portal did not close the editor after Update.`,
    12_000
  );

  const updatedRow = await partyTableRow(page, filing.buyers[partyIndex]);
  if (
    !updatedRow ||
    !await rowContainsPercentage(
      updatedRow,
      expectedBuyerShare(filing, partyIndex)
    )
  ) {
    throw new Error(
      `Buyer ${partyIndex + 1}: the saved row does not show the expected ownership share.`
    );
  }
}

async function addDetailRow(page, filing, section, partyIndex = null) {
  const sectionLabel = section === "transaction"
    ? "Transaction"
    : `${section[0].toUpperCase()}${section.slice(1)} ${partyIndex + 1}`;
  const addDetails = await sectionAddDetailsButton(page, section);
  if (!addDetails) {
    throw new Error(`${sectionLabel}: the Add Details button was not found.`);
  }
  if (await addDetails.isDisabled().catch(() => true)) {
    throw new Error(`${sectionLabel}: the Add Details button is disabled.`);
  }

  await addDetails.scrollIntoViewIfNeeded();
  await addDetails.click();
  const opened = await waitForPortalContext(
    page,
    (diagnostics) => isAnyDetailEditor(diagnostics.page),
    `${sectionLabel}: no Add Details editor opened.`
  );
  if (!detailEditorPages(section).includes(opened.page)) {
    await cancelOpenDetailEditor(page);
    throw new Error(
      `${sectionLabel}: the portal opened ${opened.page} instead of the requested editor; it was cancelled.`
    );
  }

  const helperOptions = Number.isInteger(partyIndex) ? { partyIndex } : {};
  const portalFiling = section === "buyer"
    ? filingWithPortalBuyerShare(filing)
    : filing;
  let result = await invokeHelper(page, {
    type: "FORM141_FILL",
    filing: portalFiling,
    overwrite: false,
    ...helperOptions
  });
  result = await fillConditionalControls(
    page,
    portalFiling,
    result,
    helperOptions
  );
  printPortalResult(result);

  const unresolved = (result.details ?? []).filter((detail) =>
    ["missing", "unsupported"].includes(detail.outcome)
  );

  const add = await waitForEditorAddButton(page, 10_000);
  if (!add) {
    const diagnostics = await portalDiagnostics(page);
    const invalid = diagnostics.visibleControls.filter((control) =>
      control.ariaInvalid === "true" ||
      /\bng-invalid\b/.test(control.classes ?? "")
    );
    const reason = invalid.length
      ? `${invalid.length} visible control(s) remain invalid`
      : unresolved.length
        ? `${unresolved.length} filing field(s) were not accepted: ` +
          unresolved.map((detail) => detail.path).join(", ")
        : "the editor Add button remained disabled";
    throw new Error(`${sectionLabel}: ${reason}.`);
  }

  await add.click();
  await waitForPortalContext(
    page,
    (diagnostics) =>
      diagnostics.page === "Form 141 Schedule B transaction page",
    `${sectionLabel}: the portal did not close the editor after Add.`,
    12_000
  );
}

async function portalDiagnostics(page) {
  const diagnostics = await invokeHelper(page, {
    type: "FORM141_DIAGNOSTICS"
  });
  if (!diagnostics?.ok) {
    throw new Error("Could not inspect the rendered Form 141 page.");
  }
  return diagnostics;
}

async function waitForPortalContext(
  page,
  predicate,
  errorMessage,
  timeout = 6_000
) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const diagnostics = await portalDiagnostics(page).catch(() => null);
    if (diagnostics && predicate(diagnostics)) return diagnostics;
    await page.waitForTimeout(150);
  }
  throw new Error(errorMessage);
}

function detailEditorPages(section) {
  const label = section === "transaction"
    ? "Transaction"
    : `${section[0].toUpperCase()}${section.slice(1)}`;
  return [
    `${label} Add Details inline editor`,
    `${label} Add Details dialog`
  ];
}

function isAnyDetailEditor(pageName) {
  return ["buyer", "seller", "transaction"].some((section) =>
    detailEditorPages(section).includes(pageName)
  );
}

async function cancelOpenDetailEditor(page) {
  const buttons = page.locator("button").filter({ hasText: /^\s*Cancel\s*$/i });
  for (let index = 0; index < await buttons.count(); index += 1) {
    const candidate = buttons.nth(index);
    if (
      await candidate.isVisible().catch(() => false) &&
      !await candidate.isDisabled().catch(() => true)
    ) {
      await candidate.click();
      await waitForPortalContext(
        page,
        (diagnostics) =>
          diagnostics.page === "Form 141 Schedule B transaction page",
        "The mismatched Add Details editor could not be cancelled."
      );
      return;
    }
  }
  throw new Error("The mismatched Add Details editor has no usable Cancel button.");
}

async function waitForEditorAddButton(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const buttons = page.locator("button").filter({ hasText: /^\s*Add\s*$/i });
    for (let index = 0; index < await buttons.count(); index += 1) {
      const candidate = buttons.nth(index);
      if (
        await candidate.isVisible().catch(() => false) &&
        !await candidate.isDisabled().catch(() => true)
      ) {
        return candidate;
      }
    }
    await page.waitForTimeout(150);
  }
  return null;
}

async function waitForEditorCommitButton(page, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const buttons = page.locator("button");
    for (let index = 0; index < await buttons.count(); index += 1) {
      const candidate = buttons.nth(index);
      if (!(await candidate.isVisible().catch(() => false))) continue;
      const text = String(await candidate.innerText().catch(() => ""))
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      const words = text.split(" ").filter(Boolean);
      if (
        words.length <= 2 &&
        words.some((word) => ["update", "save", "add"].includes(word)) &&
        !await candidate.isDisabled().catch(() => true)
      ) {
        return candidate;
      }
    }
    await page.waitForTimeout(150);
  }
  return null;
}

async function waitForEnabledActionButton(page, action, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const buttons = page.locator("button").filter({
      hasText: new RegExp(action, "i")
    });
    for (let index = 0; index < await buttons.count(); index += 1) {
      const candidate = buttons.nth(index);
      if (
        await candidate.isVisible().catch(() => false) &&
        !await candidate.isDisabled().catch(() => true)
      ) {
        return candidate;
      }
    }
    await page.waitForTimeout(150);
  }
  return null;
}

async function sectionAddDetailsButton(page, section) {
  const buttons = page.locator("button").filter({ hasText: /Add Details/i });
  const candidates = [];
  for (let index = 0; index < await buttons.count(); index += 1) {
    const candidate = buttons.nth(index);
    if (!(await candidate.isVisible().catch(() => false))) continue;
    candidates.push(candidate);
  }
  const index = detailSectionIndex(section);
  return index == null ? null : candidates[index] ?? null;
}

async function partyTableRow(page, party) {
  const pan = String(party?.pan ?? "").trim().toUpperCase();
  const name = String(party?.name ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
  if (!pan && !name) return null;

  const rows = page.locator(
    "tbody tr, [role='row'], .mat-mdc-row, .mat-row"
  );
  for (let index = 0; index < await rows.count(); index += 1) {
    const row = rows.nth(index);
    if (!(await row.isVisible().catch(() => false))) continue;
    const text = String(await row.innerText().catch(() => ""))
      .trim()
      .toUpperCase()
      .replace(/\s+/g, " ");
    if (
      (pan && text.includes(pan)) ||
      (name && text.includes(name))
    ) {
      return row;
    }
  }
  return null;
}

async function rowContainsPercentage(row, percentage) {
  const expected = Number(percentage);
  if (!Number.isFinite(expected)) return false;
  const text = String(await row.innerText().catch(() => ""));
  const tokens = text.match(/\d+(?:\.\d+)?\s*%?/g) ?? [];
  return tokens.some((token) => {
    const numeric = Number(token.replace("%", "").trim());
    return Number.isFinite(numeric) && Math.abs(numeric - expected) < 0.001;
  });
}

async function hasSavedTransactionRow(page, filing) {
  const amount = Number(filing.transaction?.current_payment_amount);
  const isoDate = String(filing.transaction?.payment_date ?? "");
  if (!Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return false;
  }
  return page.evaluate(({ expectedAmount, expectedDate }) => {
    const [year, month, day] = expectedDate.split("-");
    const datePatterns = [
      `${day}/${month}/${year}`,
      `${day}-${month}-${year}`,
      `${day}.${month}.${year}`
    ];
    const rows = [...document.querySelectorAll(
      "tbody tr, [role='row'], .mat-mdc-row, .mat-row"
    )];
    return rows.some((row) => {
      const text = String(row.innerText ?? "").replace(/\s+/g, " ").trim();
      if (!datePatterns.some((date) => text.includes(date))) return false;
      const numericTokens = text.match(/(?:₹\s*)?\d[\d,\s]*(?:\.\d{1,2})?/g) ?? [];
      return numericTokens.some((token) => {
        const numeric = Number(token.replace(/[₹,\s]/g, ""));
        return Number.isFinite(numeric) && Math.abs(numeric - expectedAmount) < 0.01;
      });
    });
  }, { expectedAmount: amount, expectedDate: isoDate });
}

async function fillConditionalControls(
  page,
  filing,
  firstResult,
  helperOptions = {}
) {
  let combined = await repairMaterialDateInputs(
    page,
    filing,
    await applyNativeInputFallback(page, filing, firstResult)
  );
  for (let pass = 1; pass < 3; pass += 1) {
    if ((combined.filled ?? 0) === 0) break;
    await page.waitForTimeout(500);
    const next = await repairMaterialDateInputs(
      page,
      filing,
      await applyNativeInputFallback(
        page,
        filing,
        await invokeHelper(page, {
          type: "FORM141_FILL",
          filing,
          overwrite: false,
          ...helperOptions
        })
      )
    );
    combined = mergeFillResults(combined, next);
    if ((next.filled ?? 0) === 0) break;
  }
  return verifyNativeInputFallback(page, combined);
}

async function applyNativeInputFallback(page, filing, result) {
  for (const detail of result.details ?? []) {
    if (detail.controlTag !== "input") continue;
    const value = filingValue(filing, detail.path);
    if (value == null || value === "") continue;
    const locator = await visibleControlLocator(page, detail.controlKeys ?? []);
    if (!locator) continue;
    const wasInvalid = await controlIsInvalid(locator);
    if (detail.outcome !== "unsupported" && !wasInvalid) continue;
    if (!(await locator.isEditable().catch(() => false))) continue;

    const formatted = nativeInputValue(detail.path, value);
    const wasUnsupported = detail.outcome === "unsupported";
    try {
      await locator.scrollIntoViewIfNeeded();
      await locator.click();
      await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await locator.press("Backspace");
      await locator.pressSequentially(formatted, { delay: 45 });
      await locator.press("Tab");
      await page.waitForTimeout(350);
      let actual = await locator.inputValue();
      let invalid = await controlIsInvalid(locator);
      if (
        (!String(actual).trim() || invalid) &&
        detail.path.endsWith("_date")
      ) {
        await locator.click();
        await locator.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
        await locator.press("Backspace");
        await locator.pressSequentially(formatted.replace(/\D/g, ""), {
          delay: 35
        });
        await locator.press("Tab");
        await page.waitForTimeout(350);
        actual = await locator.inputValue();
        invalid = await controlIsInvalid(locator);
      }
      if (!String(actual).trim() || invalid) {
        detail.nativeError = invalid
          ? "Portal marked the typed value invalid."
          : "Portal cleared the typed value.";
        continue;
      }
      detail.outcome = "filled-native";
      detail.nativeObserved = "non-empty-valid";
      if (wasUnsupported) {
        result.filled = (result.filled ?? 0) + 1;
        result.unsupported = Math.max(0, (result.unsupported ?? 0) - 1);
      }
    } catch (error) {
      detail.nativeError = error.message || String(error);
    }
  }
  return result;
}

async function repairMaterialDateInputs(page, filing, result) {
  for (const detail of result.details ?? []) {
    if (
      detail.controlTag !== "input" ||
      !detail.path.endsWith("_date")
    ) {
      continue;
    }
    const value = filingValue(filing, detail.path);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) continue;
    const locator = await visibleControlLocator(page, detail.controlKeys ?? []);
    if (!locator) continue;
    const retained = String(await locator.inputValue().catch(() => "")).trim();
    const invalid = await controlIsInvalid(locator);
    if (retained && !invalid && detail.outcome !== "unsupported") continue;

    try {
      const selected = await selectMaterialDate(page, locator, String(value));
      if (!selected) {
        detail.nativeError =
          "Could not select the requested date in the portal calendar.";
        continue;
      }
      await page.waitForTimeout(350);
      if (await controlIsInvalid(locator)) {
        detail.nativeError =
          "Portal marked the calendar-selected date invalid.";
        continue;
      }
      detail.outcome = "filled-calendar";
      detail.nativeObserved = "calendar-selected-valid";
      delete detail.nativeError;
    } catch (error) {
      detail.nativeError = error.message || String(error);
    }
  }
  return result;
}

async function selectMaterialDate(page, input, isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const field = input.locator("xpath=ancestor::mat-form-field[1]");
  const toggle = field.getByRole("button", { name: /open calendar/i }).first();
  if (!(await toggle.isVisible().catch(() => false))) return false;
  await toggle.click();

  const calendar = page.locator(
    ".mat-datepicker-content:visible, mat-datepicker-content:visible"
  ).last();
  await calendar.waitFor({ state: "visible", timeout: 3000 });

  for (let attempt = 0; attempt < 36; attempt += 1) {
    const matchingCell = await matchingMaterialDateCell(
      calendar,
      year,
      month,
      day
    );
    if (matchingCell) {
      await matchingCell.click();
      return true;
    }

    const periodText = String(
      await calendar.locator(".mat-calendar-period-button").first()
        .innerText()
        .catch(() => "")
    ).trim();
    const current = parseMaterialCalendarPeriod(periodText);
    if (!current) break;
    const targetIndex = year * 12 + month - 1;
    const currentIndex = current.year * 12 + current.month - 1;
    const direction = targetIndex < currentIndex ? "previous" : "next";
    const navigation = calendar.locator(
      `.mat-calendar-${direction}-button`
    ).first();
    if (!(await navigation.isVisible().catch(() => false))) break;
    await navigation.click();
    await page.waitForTimeout(75);
  }

  await page.keyboard.press("Escape").catch(() => {});
  return false;
}

async function matchingMaterialDateCell(calendar, year, month, day) {
  const monthNames = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december"
  ];
  const monthName = monthNames[month - 1];
  const cells = calendar.locator(
    ".mat-calendar-body-cell:not(.mat-calendar-body-disabled)"
  );
  for (let index = 0; index < await cells.count(); index += 1) {
    const cell = cells.nth(index);
    const label = String(await cell.getAttribute("aria-label") ?? "")
      .trim()
      .toLowerCase();
    if (
      label.includes(String(year)) &&
      (label.includes(monthName) || label.includes(monthName.slice(0, 3))) &&
      new RegExp(`(?:^|\\D)${day}(?:\\D|$)`).test(label)
    ) {
      return cell;
    }
  }
  return null;
}

function parseMaterialCalendarPeriod(value) {
  const match = String(value).trim().match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (!match) return null;
  const month = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec"
  ].findIndex((candidate) => match[1].toLowerCase().startsWith(candidate));
  if (month < 0) return null;
  return { month: month + 1, year: Number(match[2]) };
}

async function controlIsInvalid(locator) {
  const ariaInvalid = await locator.getAttribute("aria-invalid").catch(() => null);
  const classes = await locator.getAttribute("class").catch(() => "");
  return ariaInvalid === "true" || /\bng-invalid\b/.test(classes ?? "");
}

async function verifyNativeInputFallback(page, result) {
  for (const detail of result.details ?? []) {
    if (!["filled-native", "filled-calendar"].includes(detail.outcome)) continue;
    const locator = await visibleControlLocator(page, detail.controlKeys ?? []);
    const retained = locator
      ? String(await locator.inputValue().catch(() => "")).trim()
      : "";
    const invalid = locator ? await controlIsInvalid(locator) : false;
    if (!retained || invalid) {
      detail.outcome = "unsupported";
      detail.nativeObserved = "cleared-or-invalid-after-angular-update";
      detail.nativeError = invalid
        ? "Portal marked the value invalid after Angular validation."
        : "Portal cleared the value after Angular validation.";
    }
  }
  result.filled = (result.details ?? []).filter((detail) =>
    ["filled", "filled-native", "filled-calendar"].includes(detail.outcome)
  ).length;
  result.unsupported = (result.details ?? []).filter(
    (detail) => detail.outcome === "unsupported"
  ).length;
  return result;
}

async function visibleControlLocator(page, keys) {
  const selectors = [...new Set(keys)].flatMap((key) => {
    const quoted = JSON.stringify(String(key));
    return [
      `[formcontrolname=${quoted}]`,
      `[name=${quoted}]`,
      `[id=${quoted}]`,
      `[data-field=${quoted}]`
    ];
  });
  if (!selectors.length) return null;
  const matches = page.locator(selectors.join(", "));
  for (let index = 0; index < await matches.count(); index += 1) {
    const candidate = matches.nth(index);
    if (await candidate.isVisible().catch(() => false)) return candidate;
  }
  return null;
}

function nativeInputValue(fieldPath, value) {
  if (fieldPath.endsWith("_date") && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split("-");
    return `${day}/${month}/${year}`;
  }
  if (
    /amount|value|rate|share|proportion|interest|fee|total/i.test(fieldPath)
  ) {
    return String(value).replace(/[₹,%\s]/g, "");
  }
  return String(value);
}

function filingValue(filing, fieldPath) {
  return fieldPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .reduce((value, key) => value?.[key], filing);
}

function mergeFillResults(first, second) {
  const details = new Map(
    (first.details ?? []).map((detail) => [detail.path, { ...detail }])
  );
  for (const detail of second.details ?? []) {
    const existing = details.get(detail.path);
    if (
      !existing ||
      ["filled", "filled-native", "filled-calendar"].includes(detail.outcome) ||
      !["filled", "filled-native", "filled-calendar"].includes(existing.outcome)
    ) {
      details.set(detail.path, { ...detail });
    }
  }
  const mergedDetails = [...details.values()];
  return {
    ...first,
    page: second.page ?? first.page,
    note: second.note ?? first.note,
    details: mergedDetails,
    filled: mergedDetails.filter((detail) =>
      ["filled", "filled-native", "filled-calendar"].includes(detail.outcome)
    ).length,
    skipped: mergedDetails.filter(
      (detail) => detail.outcome === "already-populated"
    ).length,
    missing: mergedDetails.filter((detail) => detail.outcome === "missing").length,
    unsupported: mergedDetails.filter(
      (detail) => detail.outcome === "unsupported"
    ).length
  };
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
  npm run cli:form141 -- --statement previous.pdf --amount 500000

Use an already generated candidate:
  npm run cli:form141 -- --candidate form141-next-instalment.json

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

From the main Schedule B page, press a to fill and add the Buyer, Seller, and
Transaction rows sequentially. Each editor is validated before its Add button
is clicked. A pre-created logged-in buyer row is updated first; a sole buyer is
assigned 100%, while multiple buyers use the reviewed shares.

The CLI never enters credentials, solves CAPTCHA/OTP, submits the form, creates a
payment, clicks Continue, or authorizes payment.
`.trim());
}
