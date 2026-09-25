import assert from "node:assert/strict";
import test from "node:test";
import { localDate, parseCliArgs } from "../cli/args.js";
import {
  acceptValidPopulatedControls,
  diagnosticEmptyPaths,
  diagnosticResponseSignals
} from "../cli.js";

test("parses statement CLI arguments", () => {
  const result = parseCliArgs([
    "--statement", "previous.pdf",
    "--amount", "500000",
    "--date", "2026-07-28",
    "--cdp", "http://localhost:9222",
    "--dry-run"
  ]);
  assert.match(result.statement, /previous\.pdf$/);
  assert.equal(result.amount, "500000");
  assert.equal(result.date, "2026-07-28");
  assert.equal(result.cdp, "http://localhost:9222");
  assert.equal(result.dryRun, true);
});

test("only attaches to a local Chrome debugging endpoint", () => {
  assert.throws(
    () => parseCliArgs([
      "--candidate", "candidate.json",
      "--cdp", "http://192.0.2.1:9222"
    ]),
    /loopback/
  );
});

test("supports a read-only connection probe without filing input", () => {
  const result = parseCliArgs(["--probe"]);
  assert.equal(result.probe, true);
  assert.equal(result.cdp, "http://127.0.0.1:9222");
  assert.throws(
    () => parseCliArgs(["--probe", "--candidate", "candidate.json"]),
    /cannot be combined/
  );
});

test("requires one input source and an amount for statements", () => {
  assert.throws(() => parseCliArgs([]), /exactly one/);
  assert.throws(
    () => parseCliArgs(["--statement", "previous.pdf"]),
    /--amount is required/
  );
  assert.throws(
    () => parseCliArgs(["--candidate", "candidate.json", "--statement", "previous.pdf", "--amount", "1"]),
    /exactly one/
  );
});

test("formats the local default date", () => {
  assert.equal(localDate(new Date("2026-07-28T12:00:00.000Z")), "2026-07-28");
});

test("accepts a manually populated valid month control", () => {
  const result = acceptValidPopulatedControls(
    {
      details: [{
        path: "portal.month_of_deduction",
        outcome: "missing"
      }]
    },
    {
      visibleControls: [{
        keys: ["monthOfDeduction", "mat-input-4"],
        populated: true,
        ariaInvalid: "false"
      }]
    }
  );
  assert.equal(result.details[0].outcome, "already-populated");
  assert.equal(result.details[0].acceptedFromLiveDiagnostics, true);
  assert.equal(result.missing, 0);
  assert.equal(result.skipped, 1);
});

test("does not accept an invalid manually populated control", () => {
  const result = acceptValidPopulatedControls(
    {
      details: [{
        path: "portal.month_of_deduction",
        outcome: "unsupported"
      }]
    },
    {
      visibleControls: [{
        keys: ["monthOfDeduction"],
        populated: true,
        ariaInvalid: "true"
      }]
    }
  );
  assert.equal(result.details[0].outcome, "unsupported");
  assert.equal(result.unsupported, 1);
});

test("captures response error signals without copying unrelated values", () => {
  const signals = diagnosticResponseSignals({
    header: { status: "failure", requestId: "secret-request" },
    errors: [{ code: "FORM_INVALID", message: "Month is invalid" }],
    taxpayerName: "Private Name"
  });
  assert.deepEqual(signals, [
    { path: "header.status", value: "failure" },
    { path: "errors[0].code", value: "FORM_INVALID" },
    { path: "errors[0].message", value: "Month is invalid" }
  ]);
});

test("captures only empty request paths", () => {
  assert.deepEqual(
    diagnosticEmptyPaths({
      taxYear: "2026-27",
      month: "",
      buyer: { pan: null, share: 50 },
      sellers: []
    }),
    ["month", "buyer.pan", "sellers"]
  );
});
