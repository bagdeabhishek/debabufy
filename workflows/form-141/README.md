# Form 141 Schedule B workflow

This is DeBabufy's first bundled workflow. It prepares and fills a subsequent
Form 141 Schedule B property-TDS instalment from a previous challan statement.

## Inputs

- `previousChallan`: previous statement as PDF, JSON, or extracted text
- `currentAmount`: positive rupee amount for the current instalment
- `paymentDate`: payment and deduction date in `YYYY-MM-DD` format
- `filingBuyerPan`: buyer from the previous statement whose portal account is
  being used
- `supportingCertificate`: the selected buyer's previous Form 132 PDF or text,
  required only when that buyer did not file `previousChallan`

The desktop app asks for the payment date explicitly. It lists the buyers parsed
from the Form 141 statement and verifies that a cross-buyer Form 132 certificate
has the selected buyer's PAN, tax year, and previous acknowledgement number.
Every resolved value is shown in the proposal review.

Portal-bound monetary values are rounded upward to whole rupees before review
and validation. Decimal values are never passed to the portal controls.

## Public module interface

```js
import { inspect, manifest, prepare, run } from "./workflows/form-141/index.js";
```

- `manifest` describes the workflow inputs.
- `inspect(input)` reads the statement and returns the available filing buyers.
- `prepare(input)` parses and returns `{ filing, summary }` without changing the
  browser or portal.
- `run(context)` attaches to loopback Chrome, validates the current page, fills
  the form and detail rows, reports progress, and returns a row summary.

## Safety boundary

The workflow does not enter credentials, solve OTP/CAPTCHA, click final
submission, create or authorize payment, or provide tax advice.

## Tests

Synthetic parser, inference, portal, and helper tests live in `test/`.
Do not add real taxpayer data.
