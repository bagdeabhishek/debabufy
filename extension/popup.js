import * as pdfjs from "./vendor/pdf.mjs";
import { extractPdfText } from "./lib/pdf.js";
import { normalizeStatementJson, parseStatementText } from "./lib/statement.js";
import { inferNextFiling, validateReviewedFiling } from "./lib/infer.js";

const api = globalThis.browser ?? globalThis.chrome;
pdfjs.GlobalWorkerOptions.workerSrc = api.runtime.getURL("vendor/pdf.worker.mjs");

const elements = Object.fromEntries(
  [
    "statement", "file-label", "amount", "payment-date", "analyze", "review-card",
    "portal-card", "warnings", "summary", "party-count", "candidate-json",
    "approved", "overwrite", "preview", "fill", "download", "clear",
    "page-map", "portal-result", "status"
  ].map((id) => [id, document.getElementById(id)])
);

let candidate = null;
const storageArea = api.storage.session;
const STORAGE_KEY = "form141ScheduleBEphemeralCandidate";

if (!storageArea) {
  throw new Error("This browser does not support in-memory extension session storage.");
}

const localNow = new Date();
elements["payment-date"].value = new Date(
  localNow.getTime() - localNow.getTimezoneOffset() * 60_000
).toISOString().slice(0, 10);

elements.statement.addEventListener("change", () => {
  elements["file-label"].textContent = elements.statement.files?.[0]?.name ?? "Choose statement";
});

elements.analyze.addEventListener("click", analyze);
elements.approved.addEventListener("change", updateApproval);
elements.preview.addEventListener("click", () => runPortalAction("FORM141_PREVIEW"));
elements.fill.addEventListener("click", () => runPortalAction("FORM141_FILL"));
elements["page-map"].addEventListener("click", downloadPageMap);
elements.download.addEventListener("click", downloadCandidate);
elements.clear.addEventListener("click", clearState);

await restoreState();

async function analyze() {
  const file = elements.statement.files?.[0];
  const amount = elements.amount.value;
  const paymentDate = elements["payment-date"].value;
  if (!file) return setStatus("Choose the previous statement.", true);

  setBusy(true);
  try {
    const previous = await readStatement(file);
    candidate = inferNextFiling(previous, { amount, paymentDate });
    await storageArea.set({ [STORAGE_KEY]: { candidate, savedAt: Date.now() } });
    renderCandidate();
    setStatus("Proposal ready.");
  } catch (error) {
    setStatus(error.message || String(error), true);
  } finally {
    setBusy(false);
  }
}

async function readStatement(file) {
  if (/pdf/i.test(file.type) || file.name.toLowerCase().endsWith(".pdf")) {
    const text = await extractPdfText(pdfjs, await file.arrayBuffer());
    return parseStatementText(text);
  }
  const text = await file.text();
  if (/json/i.test(file.type) || file.name.toLowerCase().endsWith(".json")) {
    return normalizeStatementJson(JSON.parse(text));
  }
  return parseStatementText(text);
}

function parseEditor() {
  const parsed = JSON.parse(elements["candidate-json"].value);
  parsed.review ??= { warnings: [], decisions: [] };
  parsed.review.approved = elements.approved.checked;
  parsed.review.approved_at = elements.approved.checked ? new Date().toISOString() : null;
  return parsed;
}

function updateApproval() {
  try {
    candidate = parseEditor();
    const errors = validateReviewedFiling(candidate);
    const substantiveErrors = errors.filter((error) => error !== "Review must be explicitly approved.");
    elements.preview.disabled = !candidate.review.approved;
    elements.fill.disabled = !candidate.review.approved || substantiveErrors.length > 0;
    if (substantiveErrors.length) {
      showPortalResult(substantiveErrors.join(" "), true);
    } else {
      hidePortalResult();
      storageArea.set({ [STORAGE_KEY]: { candidate, savedAt: Date.now() } });
    }
  } catch (error) {
    elements.preview.disabled = true;
    elements.fill.disabled = true;
    showPortalResult(`Invalid JSON: ${error.message}`, true);
  }
}

function renderCandidate() {
  if (!candidate) return;
  elements["review-card"].classList.remove("hidden");
  elements["portal-card"].classList.remove("hidden");
  elements["candidate-json"].value = JSON.stringify(candidate, null, 2);
  elements.approved.checked = Boolean(candidate.review?.approved);
  elements["party-count"].textContent =
    `${candidate.buyers?.length ?? 0} buyer(s) · ${candidate.sellers?.length ?? 0} seller(s)`;

  const warnings = candidate.review?.warnings ?? [];
  elements.warnings.replaceChildren();
  for (const warning of warnings) {
    const message = document.createElement("div");
    message.className = "warning";
    message.textContent = warning;
    elements.warnings.append(message);
  }

  const rows = [
    ["Prior acknowledgement", candidate.meta?.previous_acknowledgement_number],
    ["Tax year", candidate.meta?.tax_year],
    ["Property", candidate.property?.property_type ?? "—"],
    ["Prior present instalment", money(candidate.review?.decisions?.find((d) => d.path === "transaction.current_payment_amount")?.previous)],
    ["Previous instalments total", money(candidate.transaction?.cumulative_previous_installments)],
    ["This payment", money(candidate.transaction?.current_payment_amount)],
    ["Payment/deduction date", candidate.transaction?.payment_date],
    ["Proposed rate", percent(candidate.tax_deposit?.rate_percent)],
    ["Proposed TDS", money(candidate.tax_deposit?.tds_amount)],
    ["Interest + fee", `${money(candidate.tax_deposit?.interest)} + ${money(candidate.tax_deposit?.other_fee)}`],
    ["Proposed total", money(candidate.tax_deposit?.total_amount)]
  ];
  elements.summary.replaceChildren();
  for (const [label, value] of rows) {
    const term = document.createElement("dt");
    const description = document.createElement("dd");
    term.textContent = label;
    description.textContent = value ?? "—";
    description.title = value ?? "—";
    elements.summary.append(term, description);
  }
  updateApproval();
}

async function runPortalAction(type) {
  try {
    candidate = parseEditor();
    const errors = validateReviewedFiling(candidate);
    if (errors.length) throw new Error(errors.join(" "));

    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(tab.url ?? "")) {
      throw new Error("Open the Income Tax portal Form 141 Schedule B page in the active tab first.");
    }

    let result;
    try {
      result = await api.tabs.sendMessage(tab.id, {
        type,
        filing: candidate,
        overwrite: elements.overwrite.checked
      });
    } catch {
      throw new Error("The portal helper is not loaded. Reload the Income Tax portal tab and try again.");
    }
    showPortalResult(formatResult(result), !result?.ok);
  } catch (error) {
    showPortalResult(error.message || String(error), true);
  }
}

function formatResult(result) {
  if (!result) return "No response from the portal page.";
  if (!result.ok) return result.error ?? "The portal page could not be analyzed.";
  const isPreview = result.mode === "preview";
  const action = isPreview
    ? `Found ${result.matched ?? 0} of ${result.relevant ?? 0} relevant field(s)`
    : `Filled ${result.filled ?? 0} field(s)`;
  const unresolved = (result.details ?? [])
    .filter((detail) => ["missing", "unsupported"].includes(detail.outcome))
    .map((detail) => detail.path);
  const unresolvedText = unresolved.length
    ? ` Unresolved: ${unresolved.slice(0, 6).join(", ")}${unresolved.length > 6 ? "…" : ""}.`
    : "";
  const fillText = isPreview
    ? ""
    : ` ${result.skipped ?? 0} already populated; ${result.unsupported ?? 0} need manual control selection;`;
  const deferredText = result.deferred
    ? ` ${result.deferred} filing field(s) belong to other sections or dialogs.`
    : "";
  const noteText = result.note ? ` ${result.note}` : "";
  return `${action} on ${result.page ?? "the current portal page"}.` +
    `${fillText} ${result.missing ?? 0} relevant field(s) not found.` +
    deferredText +
    ` No Continue, Add, Save, submission, or payment action was taken.` +
    noteText +
    unresolvedText;
}

function downloadCandidate() {
  try {
    candidate = parseEditor();
    const blob = new Blob([`${JSON.stringify(candidate, null, 2)}\n`], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `26qb-next-instalment-${candidate.transaction?.payment_date ?? "review"}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    setStatus(`Invalid JSON: ${error.message}`, true);
  }
}

async function downloadPageMap() {
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https:\/\/(?:www|eportal)\.incometax\.gov\.in\//.test(tab.url ?? "")) {
      throw new Error("Open the Income Tax portal Form 141 page in the active tab first.");
    }
    const diagnostics = await api.tabs.sendMessage(tab.id, {
      type: "FORM141_DIAGNOSTICS"
    });
    if (!diagnostics?.ok) throw new Error("Could not inspect the current portal page.");
    const blob = new Blob(
      [`${JSON.stringify(diagnostics, null, 2)}\n`],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `form-141-page-map-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showPortalResult(
      "Downloaded a value-free page map containing control labels and identifiers, never entered values. Review it before sharing."
    );
  } catch (error) {
    showPortalResult(
      error.message === "Could not establish connection. Receiving end does not exist."
        ? "Reload the Income Tax portal tab, then try the page map again."
        : error.message || String(error),
      true
    );
  }
}

async function restoreState() {
  const stored = (await storageArea.get(STORAGE_KEY))?.[STORAGE_KEY];
  if (!stored?.candidate) return;
  if (Date.now() - stored.savedAt > 2 * 60 * 60 * 1000) {
    await storageArea.remove(STORAGE_KEY);
    return;
  }
  candidate = stored.candidate;
  renderCandidate();
  setStatus("Restored reviewed session.");
}

async function clearState() {
  candidate = null;
  await storageArea.remove(STORAGE_KEY);
  elements.statement.value = "";
  elements.amount.value = "";
  elements.approved.checked = false;
  elements["review-card"].classList.add("hidden");
  elements["portal-card"].classList.add("hidden");
  elements["file-label"].textContent = "Choose PDF, JSON, or text statement";
  hidePortalResult();
  setStatus("Cleared.");
}

function showPortalResult(message, isError = false) {
  elements["portal-result"].textContent = message;
  elements["portal-result"].classList.remove("hidden");
  elements["portal-result"].classList.toggle("error", isError);
}

function hidePortalResult() {
  elements["portal-result"].classList.add("hidden");
}

function setBusy(busy) {
  elements.analyze.disabled = busy;
  elements.analyze.textContent = busy ? "Reading statement…" : "Analyze locally";
}

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.style.color = isError ? "#a33232" : "";
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(number)
    : "—";
}

function percent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number}%` : "—";
}
