import assert from "node:assert/strict";
import test from "node:test";
import { parseForm132CertificateText } from "../src/certificate.js";
import { selectFilingBuyer } from "../src/filer.js";

const FIRST_PAN = "AAAAA0000A";
const SECOND_PAN = "BBBBB1111B";

const CERTIFICATE_TEXT = `
FORM NO. 132
Certificate under section 395(4) of the Act for tax deducted at source
PART A
Name
SECOND BUYER
Permanent Account Number
${SECOND_PAN}
Tax Year
2026-27
PART B
Summary of Transaction(s) (as per Form No. 141)
1 BSA7654321 4,26,007.00 1.00 % 10/06/2026 4,260.00
`;

test("extracts buyer evidence from a Form 132 certificate", () => {
  assert.deepEqual(parseForm132CertificateText(CERTIFICATE_TEXT), {
    buyerPan: SECOND_PAN,
    acknowledgementNumber: "BSA7654321",
    taxYear: "2026-27"
  });
});

test("uses Form 132 acknowledgement when another listed buyer is filing", () => {
  const previous = {
    meta: {
      acknowledgement_number: "BSA7000001",
      tax_year: "2026-27",
      taxpayer: { pan: FIRST_PAN }
    }
  };
  const filing = {
    meta: {},
    buyers: [
      { pan: FIRST_PAN, name: "FIRST BUYER" },
      { pan: SECOND_PAN, name: "SECOND BUYER" }
    ],
    review: { approved: false, warnings: [], decisions: [] }
  };

  selectFilingBuyer(filing, previous, {
    filingBuyerPan: SECOND_PAN,
    certificate: parseForm132CertificateText(CERTIFICATE_TEXT)
  });

  assert.equal(filing.meta.filing_buyer_pan, SECOND_PAN);
  assert.equal(filing.meta.filing_buyer_name, "SECOND BUYER");
  assert.equal(filing.meta.previous_acknowledgement_number, "BSA7654321");
});

test("refuses a cross-buyer filing without buyer-specific evidence", () => {
  const previous = {
    meta: {
      acknowledgement_number: "BSA7000001",
      taxpayer: { pan: FIRST_PAN }
    }
  };
  const filing = {
    meta: {},
    buyers: [
      { pan: FIRST_PAN, name: "FIRST BUYER" },
      { pan: SECOND_PAN, name: "SECOND BUYER" }
    ],
    review: { approved: false, warnings: [], decisions: [] }
  };

  assert.throws(
    () => selectFilingBuyer(filing, previous, { filingBuyerPan: SECOND_PAN }),
    /Form 132 certificate/
  );
});
