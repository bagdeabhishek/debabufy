import workflow from "./workflow.json" with { type: "json" };
import {
  prepareForm141Proposal,
  runForm141Automation
} from "./cli.js";

export const manifest = Object.freeze(workflow);

export async function prepare({ previousChallan, currentAmount }) {
  return prepareForm141Proposal({
    statementPath: previousChallan,
    amount: currentAmount
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
