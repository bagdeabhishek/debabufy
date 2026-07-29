const workflowSelect = document.querySelector("#workflow");
const workflowDescription = document.querySelector("#workflow-description");
const chooseFileButton = document.querySelector("#choose-file");
const fileName = document.querySelector("#file-name");
const amountInput = document.querySelector("#amount");
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
  activity.classList.remove("error", "success");
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
  proposalToken = null;
  proposalCard.classList.add("hidden");
  runCard.classList.add("hidden");
});

chooseFileButton.addEventListener("click", async () => {
  try {
    const chosen = await window.debabufy.chooseStatement();
    if (!chosen) return;
    selectedFile = chosen;
    fileName.textContent = chosen.name;
    proposalToken = null;
    proposalCard.classList.add("hidden");
    runCard.classList.add("hidden");
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

  setBusy(true);
  showActivity("Reading the previous statement and preparing the next instalment…");
  try {
    const result = await window.debabufy.prepareWorkflow({
      workflowId: workflowSelect.value,
      previousChallan: selectedFile.path,
      currentAmount
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
    showActivity(
      `Done: ${summary.added} added, ${summary.updated} updated, ` +
      `${summary.existing} already present. Review the portal before continuing.`,
      "success"
    );
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

loadWorkflows().catch((error) => {
  showActivity(`Could not load workflows: ${errorMessage(error)}`, "error");
});
