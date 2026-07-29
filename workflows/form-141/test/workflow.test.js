import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { manifest, prepare } from "../index.js";

test("desktop workflow prepares a deterministic proposal from two inputs", async () => {
  const previousChallan = fileURLToPath(
    new URL("../examples/synthetic-statement.json", import.meta.url)
  );
  const result = await prepare({
    previousChallan,
    currentAmount: 500_000
  });

  assert.equal(manifest.inputs.length, 2);
  assert.equal(result.summary.currentPayment, 500_000);
  assert.equal(result.summary.tdsAmount, 5_000);
  assert.equal(result.filing.review.approved, false);
  assert.match(result.summary.paymentDate, /^\d{4}-\d{2}-\d{2}$/);
});
