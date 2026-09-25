import workflow from "./workflow.json" with { type: "json" };
import {
  inspectForm141Statement,
  prepareForm141Proposal,
  runForm141Automation
} from "./cli.js";

export const manifest = Object.freeze(workflow);

export async function inspect({ previousChallan }) {
  return inspectForm141Statement(previousChallan);
}

export async function prepare({
  previousChallan,
  currentAmount,
  paymentDate,
  filingBuyerPan,
  supportingCertificate
}) {
  return prepareForm141Proposal({
    statementPath: previousChallan,
    amount: currentAmount,
    paymentDate,
    filingBuyerPan,
    supportingCertificatePath: supportingCertificate
  });
}

export async function run({ filing, cdp, diagnosticsDirectory, onProgress }) {
  return runForm141Automation({
    filing,
    cdp,
    diagnosticsDirectory,
    onProgress
  });
}
