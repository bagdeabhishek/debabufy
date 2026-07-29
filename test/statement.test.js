import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { normalizeStatementJson, parseStatementText } from "../src/lib/statement.js";
import { inferNextFiling, validateReviewedFiling } from "../src/lib/infer.js";

const PRIMARY_BUYER_PAN = `${"A".repeat(5)}${"0".repeat(4)}A`;
const SECOND_BUYER_PAN = `${"B".repeat(5)}${"1".repeat(4)}B`;
const SELLER_PAN = `${"C".repeat(5)}${"2".repeat(4)}C`;

const SYNTHETIC_STATEMENT = `
Form No. 141
Acknowledgement Number :\tACK-SYNTHETIC-001
Challan Identification Number (CIN):\tCIN-SYNTHETIC
Date of E-Filing :\t25-Jul-2026
PAN\tName\tContact Details
${PRIMARY_BUYER_PAN}\tSYNTHETIC BUYER\t00000
Payment Details
Tax year of transaction\tMonth of Deduction\tTax Applicable (Major Head)\tType of Payment (Minor Head)
2026-27\tJun-2026\tCorporation Tax (0020)\tSchedule B
Residential Status of the Deductee\tType of Deductee\tPayment Mode\tBank Name
Resident\tCorporate Deductee(s)\tNet Banking\tExample Bank
Transaction Details
Type of immovable property\tAddress of property transferred/to be\tDate of agreement\tTotal stamp duty value of the property
transferred
BUILDING\t04-Jun-2024\t₹ 12,00,000
UNIT 10, EXAMPLE BUILDING
EXAMPLE DISTRICT, EXAMPLE STATE, INDIA, 560000
Total sale consideration in respect of the\tIs the payment being made in Lumpsum or\t(a) If in instalments, whether first, subsequent\t(b) In case of subsequent or last instalment,
property\tInstalments?\tor last instalment\tprevious acknowledgement number
₹ 15,00,000\tInstalments\tSubsequent instalment\tACK-OLDER-001
Details of all buyers
Sl. No.\tPermanent Account Number\tName\tProportion of total sale consideration to be paid/credited by
the buyer (%)
1\t${PRIMARY_BUYER_PAN}\tSYNTHETIC BUYER ONE\t50 %
2\t${SECOND_BUYER_PAN}\tSYNTHETIC BUYER TWO\t50 %
Details of all deductees (sellers)
Sl. No.\tPermanent Account\tName\tContact Number\tEmail id\tProportion of total sale consideration to be received/debited
Number\tby the seller (%)
1\t${SELLER_PAN}\tSYNTHETIC SELLER\t0000000000\tseller@example.invalid\t100 %
Transaction Details
Sl\tPAN of\tName of\tProportionate\tAmount paid\tAmount paid\tAmount on\tDate of\tWhether\tCertificate\tRate at\tAmount of\tDate of
no\tDeductee\tDeductee\tamount of\tor credited in\tor credited in\twhich tax is\tPayment or\tsection\tnumber\twhich tax\ttax deducted\tDeduction
.\tStamp Duty\tprevious\tpresent\tliable to be\tCredit\t395(1) is\tunder\tdeducted\tat source (₹)
value (₹)\tinstalments\tinstalment\tdeducted (₹)\tapplicable\tsection\t(%)
(₹)\t(₹)\t395(1) of
the Act
1\t${SELLER_PAN}\tSELLER\t₹ 12,00,000\t₹ 1,00,000\t₹ 2,00,000\t₹ 2,00,000\t20-Jun-2026\tNO\t1.00 %\t₹ 2,000\t20-Jun-2026
Part C: Summary of Transactions and Details of Tax, Interest and Fee
Nature of\tSection*\tMajor\tMinor\tAmount\tInterest\tFee\tTotal\tMode of\tChallan Identification
Transaction*\tHead\tHead\tdeducted*\tPayments\tPayment\tNumber (CIN)*
Code*\tCode*
Schedule B\tSection\t0020\t800\t₹ 2,000\t₹ 0\t₹ 0\t₹ 2,000\tNet Banking\tCIN-SYNTHETIC
`;

test("parses the official challan statement table layout", () => {
  const result = parseStatementText(SYNTHETIC_STATEMENT);
  assert.equal(result.meta.source_format, "challan-statement-pdf");
  assert.equal(result.meta.form, "141-SCHEDULE-B");
  assert.equal(result.meta.acknowledgement_number, "ACK-SYNTHETIC-001");
  assert.equal(result.meta.tax_year, "2026-27");
  assert.equal(result.buyers.length, 2);
  assert.equal(result.sellers.length, 1);
  assert.equal(result.property.agreement_date, "2024-06-04");
  assert.equal(result.property.consideration_value, 1_500_000);
  assert.equal(result.property.raw_address.pincode, "560000");
  assert.equal(result.property.raw_address.country, "INDIA");
  assert.equal(result.transaction.cumulative_previous_installments, 100_000);
  assert.equal(result.transaction.current_payment_amount, 200_000);
  assert.equal(result.tax_deposit.rate_percent, 1);
  assert.equal(result.tax_deposit.tds_amount, 2_000);
  assert.deepEqual(result.extraction.warnings, []);
});

test("proposes the next instalment without approving it", () => {
  const previous = parseStatementText(SYNTHETIC_STATEMENT);
  const next = inferNextFiling(previous, {
    amount: "500000",
    paymentDate: "2026-07-26"
  });
  assert.equal(next.meta.acknowledgement_number, null);
  assert.equal(next.meta.form, "141-SCHEDULE-B");
  assert.equal(next.meta.previous_acknowledgement_number, "ACK-SYNTHETIC-001");
  assert.equal(next.transaction.cumulative_previous_installments, 300_000);
  assert.equal(next.transaction.current_payment_amount, 500_000);
  assert.equal(next.transaction.tax_liable_amount, 500_000);
  assert.equal(next.tax_deposit.rate_percent, 1);
  assert.equal(next.tax_deposit.tds_amount, 5_000);
  assert.equal(next.tax_deposit.total_amount, 5_000);
  assert.equal(next.portal.form_flow, "FORM_141_SCHEDULE_B");
  assert.equal(next.portal.month_of_deduction, "Jul-2026");
  assert.equal(next.portal.nature_transaction, "Schedule B");
  assert.equal(next.portal.installment_sequence, "Subsequent Instalment");
  assert.equal(next.review.approved, false);
  assert.ok(validateReviewedFiling(next).includes("Review must be explicitly approved."));

  next.review.approved = true;
  assert.deepEqual(validateReviewedFiling(next), []);
});

test("rejects Form 132 certificates with a useful source-file message", () => {
  assert.throws(
    () => parseStatementText(`
      FORM NO. 132
      Certificate under section 395(4) of the Act for tax deducted at source
      Summary of Transaction(s) (as per Form No. 141)
    `),
    /Form 132 TDS certificate.*Form 141 Schedule B challan statement/
  );
});

test("keeps the documented synthetic dry run in sync", () => {
  const fixture = normalizeStatementJson(JSON.parse(
    fs.readFileSync(new URL("../examples/synthetic-statement.json", import.meta.url), "utf8")
  ));
  const next = inferNextFiling(fixture, {
    amount: "500000",
    paymentDate: "2026-07-28"
  });

  assert.equal(next.transaction.cumulative_previous_installments, 300_000);
  assert.equal(next.transaction.current_payment_amount, 500_000);
  assert.equal(next.tax_deposit.rate_percent, 1);
  assert.equal(next.tax_deposit.tds_amount, 5_000);
  assert.equal(next.tax_deposit.total_amount, 5_000);
});
