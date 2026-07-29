# Form 141 Schedule B workflow

This is DeBabufy's first bundled workflow. It prepares and fills a subsequent
Form 141 Schedule B property-TDS instalment from a previous challan statement.

## Inputs

- `previousChallan`: previous statement as PDF, JSON, or extracted text
- `currentAmount`: positive rupee amount for the current instalment

The payment and deduction date default to the user's current local date and are
shown in the proposal review.

## Public module interface

```js
import { manifest, prepare, run } from "./workflows/form-141/index.js";
```

- `manifest` describes the workflow and its two inputs.
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
