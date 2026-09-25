import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { manifest, prepare } from "../index.js";

test("desktop workflow prepares a deterministic proposal from reviewed inputs", async () => {
  const previousChallan = fileURLToPath(
    new URL("../examples/synthetic-statement.json", import.meta.url)
  );
  const result = await prepare({
    previousChallan,
    currentAmount: 500_000,
    paymentDate: "2026-08-05"
  });

  assert.deepEqual(
    manifest.inputs.map(({ id }) => id),
    [
      "previousChallan",
      "currentAmount",
      "paymentDate",
      "filingBuyerPan",
      "supportingCertificate"
    ]
  );
  assert.equal(result.summary.currentPayment, 500_000);
  assert.equal(result.summary.tdsAmount, 5_000);
  assert.equal(result.summary.paymentDate, "2026-08-05");
  assert.equal(result.summary.filingBuyer, "SYNTHETIC BUYER");
  assert.equal(result.filing.review.approved, false);
});
