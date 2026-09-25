import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflow, listWorkflows } from "./registry.js";

test("the bundled Form 141 workflow is discoverable", () => {
  const workflows = listWorkflows();
  assert.equal(workflows.length, 1);
  assert.equal(workflows[0].id, "form-141-schedule-b");
  assert.deepEqual(
    workflows[0].inputs.map(({ id }) => id),
    [
      "previousChallan",
      "currentAmount",
      "paymentDate",
      "filingBuyerPan",
      "supportingCertificate"
    ]
  );
});

test("unknown workflows fail closed", () => {
  assert.throws(() => getWorkflow("missing"), /Unknown workflow/);
});
