const workflowSelect = document.querySelector("#workflow");
const workflowDescription = document.querySelector("#workflow-description");
const chooseFileButton = document.querySelector("#choose-file");
const fileName = document.querySelector("#file-name");
const amountInput = document.querySelector("#amount");
const paymentDateInput = document.querySelector("#payment-date");
const filingBuyerSelect = document.querySelector("#filing-buyer");
const certificateField = document.querySelector("#certificate-field");
const chooseCertificateButton = document.querySelector("#choose-certificate");
const certificateName = document.querySelector("#certificate-name");
const prepareButton = document.querySelector("#prepare");
const proposalCard = document.querySelector("#proposal-card");
const proposalList = document.querySelector("#proposal");
const warnings = document.querySelector("#warnings");
const runCard = document.querySelector("#run-card");
const launchChromeButton = document.querySelector("#launch-chrome");
const chromeStatus = document.querySelector("#chrome-status");
const reviewedInput = document.querySelector("#reviewed");
const runButton = document.querySelector("#run");
const activityCard = document.querySelector("#activity-card");
const activity = document.querySelector("#activity");
const diagnosticsButton = document.querySelector("#open-diagnostics");

let workflows = [];
let selectedFile = null;
let selectedCertificate = null;
let statementInfo = null;
let proposalToken = null;
let chromeReady = false;
let busy = false;

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
});

function setBusy(value) {
  busy = value;
  prepareButton.disabled = value;
  chooseFileButton.disabled = value;
  amountInput.disabled = value;
  paymentDateInput.disabled = value;
  filingBuyerSelect.disabled = value || !statementInfo;
  chooseCertificateButton.disabled = value;
  workflowSelect.disabled = value;
  launchChromeButton.disabled = value;
  updateRunButton();
}

function updateRunButton() {
  runButton.disabled =
    busy || !proposalToken || !chromeReady || !reviewedInput.checked;
}

function showActivity(message, tone = "") {
  activityCard.classList.remove("hidden");
  activity.textContent = message;
  activity.classList.remove("error", "success", "warning");
  if (tone) activity.classList.add(tone);
}

function errorMessage(error) {
  return error?.message || String(error);
}

function summaryValue(key, value) {
  if ([
    "previousInstallments",
    "currentPayment",
    "tdsAmount",
    "interest",
    "fee",
    "total"
  ].includes(key)) {
    return value == null ? "—" : currency.format(Number(value));
  }
  if (key === "ratePercent") return value == null ? "—" : `${value}%`;
  return value ?? "—";
}

function renderProposal(summary) {
  const labels = {
    taxYear: "Tax year",
    filingBuyer: "Filing buyer",
    previousAcknowledgement: "Previous acknowledgement",
    buyers: "Buyers",
    sellers: "Sellers",
    previousInstallments: "Previous instalments",
    currentPayment: "Current payment",
    paymentDate: "Payment / deduction date",
    ratePercent: "Proposed rate",
    tdsAmount: "Proposed TDS",
    interest: "Interest",
    fee: "Fee",
    total: "Total"
  };
  proposalList.replaceChildren();
  for (const [key, label] of Object.entries(labels)) {
    const wrapper = document.createElement("div");
    wrapper.className = "proposal-item";
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = summaryValue(key, summary[key]);
    wrapper.append(term, description);
    proposalList.append(wrapper);
  }

  const proposalWarnings = summary.warnings ?? [];
  warnings.replaceChildren();
  warnings.classList.toggle("hidden", proposalWarnings.length === 0);
  if (proposalWarnings.length) {
    const title = document.createElement("strong");
    title.textContent = "Please confirm:";
    const list = document.createElement("ul");
    for (const warning of proposalWarnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    }
    warnings.append(title, list);
  }
  proposalCard.classList.remove("hidden");
  runCard.classList.remove("hidden");
  reviewedInput.checked = false;
  updateRunButton();
}

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function resetProposal() {
  proposalToken = null;
  proposalCard.classList.add("hidden");
  runCard.classList.add("hidden");
}

function maskPan(pan) {
  const value = String(pan ?? "");
  if (value.length < 4) return value;
  return `${value.slice(0, 3)}••••${value.slice(-3)}`;
}

function selectedBuyerNeedsCertificate() {
  return Boolean(
    statementInfo?.statementBuyerPan &&
    filingBuyerSelect.value &&
    filingBuyerSelect.value !== statementInfo.statementBuyerPan
  );
}

function updateCertificateField() {
  certificateField.classList.toggle("hidden", !selectedBuyerNeedsCertificate());
}

function populateBuyers(info) {
  statementInfo = info;
  filingBuyerSelect.replaceChildren();
  for (const buyer of info.buyers ?? []) {
    const option = document.createElement("option");
    option.value = buyer.pan;
    option.textContent = `${buyer.name} (${maskPan(buyer.pan)})`;
    filingBuyerSelect.append(option);
  }
  filingBuyerSelect.value = info.statementBuyerPan || info.buyers?.[0]?.pan || "";
  filingBuyerSelect.disabled = false;
  updateCertificateField();
}

async function loadWorkflows() {
  workflows = await window.debabufy.listWorkflows();
  workflowSelect.replaceChildren();
  for (const workflow of workflows) {
    const option = document.createElement("option");
    option.value = workflow.id;
    option.textContent = workflow.name;
    workflowSelect.append(option);
  }
  updateWorkflowDescription();
}

function updateWorkflowDescription() {
  const selected = workflows.find(({ id }) => id === workflowSelect.value);
  workflowDescription.textContent = selected?.description ?? "";
}

workflowSelect.addEventListener("change", () => {
  updateWorkflowDescription();
  resetProposal();
});

chooseFileButton.addEventListener("click", async () => {
  try {
    const chosen = await window.debabufy.chooseStatement();
    if (!chosen) return;
    selectedFile = chosen;
    fileName.textContent = chosen.name;
    selectedCertificate = null;
    certificateName.textContent = "Choose Form 132 PDF";
    statementInfo = null;
    updateCertificateField();
    filingBuyerSelect.disabled = true;
    filingBuyerSelect.replaceChildren();
    const loading = document.createElement("option");
    loading.value = "";
    loading.textContent = "Reading buyers…";
    filingBuyerSelect.append(loading);
    resetProposal();
    showActivity("Reading the previous statement and finding its buyers…");
    const info = await window.debabufy.inspectWorkflow({
      workflowId: workflowSelect.value,
      previousChallan: chosen.path
    });
    populateBuyers(info);
    showActivity("Statement ready. Choose the filing buyer and enter this payment.", "success");
  } catch (error) {
    selectedFile = null;
    fileName.textContent = "Choose PDF, JSON, or text file";
    showActivity(errorMessage(error), "error");
  }
});

filingBuyerSelect.addEventListener("change", () => {
  selectedCertificate = null;
  certificateName.textContent = "Choose Form 132 PDF";
  updateCertificateField();
  resetProposal();
});

amountInput.addEventListener("input", resetProposal);
paymentDateInput.addEventListener("change", resetProposal);

chooseCertificateButton.addEventListener("click", async () => {
  try {
    const chosen = await window.debabufy.chooseCertificate();
    if (!chosen) return;
    selectedCertificate = chosen;
    certificateName.textContent = chosen.name;
    resetProposal();
  } catch (error) {
    showActivity(errorMessage(error), "error");
  }
});

prepareButton.addEventListener("click", async () => {
  if (!selectedFile) {
    showActivity("Choose the previous challan statement first.", "error");
    return;
  }
  const currentAmount = Number(amountInput.value);
  if (!Number.isFinite(currentAmount) || currentAmount <= 0) {
    showActivity("Enter a positive current payment amount.", "error");
    return;
  }
  const paymentDate = paymentDateInput.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    showActivity("Choose the payment and deduction date.", "error");
    return;
  }
  const filingBuyerPan = filingBuyerSelect.value;
  if (!filingBuyerPan) {
    showActivity("Choose the buyer filing this Form 141.", "error");
    return;
  }
  if (selectedBuyerNeedsCertificate() && !selectedCertificate) {
    showActivity("Choose the selected buyer's previous Form 132 certificate.", "error");
    return;
  }

  setBusy(true);
  showActivity("Reading the previous statement and preparing the next instalment…");
  try {
    const result = await window.debabufy.prepareWorkflow({
      workflowId: workflowSelect.value,
      previousChallan: selectedFile.path,
      currentAmount,
      paymentDate,
      filingBuyerPan,
      supportingCertificate: selectedBuyerNeedsCertificate()
        ? selectedCertificate.path
        : null
    });
    proposalToken = result.token;
    renderProposal(result.summary);
    showActivity("Proposal ready. Review every value before running it.", "success");
  } catch (error) {
    showActivity(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
});

launchChromeButton.addEventListener("click", async () => {
  setBusy(true);
  showActivity("Opening an ordinary Chrome window…");
  try {
    const result = await window.debabufy.launchChrome();
    chromeReady = true;
    chromeStatus.textContent = result.reused
      ? "Connected to the existing DeBabufy Chrome session."
      : "Chrome opened. Log in and open Form 141 Schedule B.";
    chromeStatus.classList.add("success");
    showActivity(chromeStatus.textContent, "success");
  } catch (error) {
    chromeReady = false;
    chromeStatus.textContent = "Chrome connection failed.";
    chromeStatus.classList.remove("success");
    showActivity(errorMessage(error), "error");
  } finally {
    setBusy(false);
  }
});

reviewedInput.addEventListener("change", updateRunButton);

runButton.addEventListener("click", async () => {
  setBusy(true);
  diagnosticsButton.classList.add("hidden");
  showActivity("Starting the Form 141 workflow…");
  try {
    const summary = await window.debabufy.runWorkflow({
      token: proposalToken,
      reviewed: reviewedInput.checked
    });
    const dateAdjustments = summary.dateAdjustments ?? [];
    if (dateAdjustments.length) {
      const substitutions = dateAdjustments.map((adjustment) => {
        const label = adjustment.field?.includes("deduction")
          ? "deduction date"
          : "payment date";
        return `${label} ${adjustment.requested} → ${adjustment.selected}`;
      }).join("; ");
      showActivity(
        `Done with portal date substitution: ${substitutions}. ` +
        "Review that date before continuing.",
        "warning"
      );
    } else {
      showActivity(
        `Done: ${summary.added} added, ${summary.updated} updated, ` +
        `${summary.existing} already present. Review the portal before continuing.`,
        "success"
      );
    }
  } catch (error) {
    showActivity(errorMessage(error), "error");
    diagnosticsButton.classList.remove("hidden");
  } finally {
    setBusy(false);
  }
});

diagnosticsButton.addEventListener("click", () => {
  window.debabufy.openDiagnostics();
});

window.debabufy.onProgress(({ message }) => {
  showActivity(message);
});

paymentDateInput.value = localDate();

loadWorkflows().catch((error) => {
  showActivity(`Could not load workflows: ${errorMessage(error)}`, "error");
});
