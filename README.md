# 26QB Next Instalment Assistant

A local, review-first Chrome/Firefox extension for recurring Form 26QB
instalment filings.

The extension reads a previous challan statement PDF inside the browser, carries
forward the recurring buyer, seller, and property information, and asks for the
new payment amount and date. It proposes the next filing, makes every inferred
value reviewable, and fills matching fields on the currently open Income Tax
portal page.

It does **not** upload statements, store portal credentials, click Continue or
Submit, create a challan, or authorize payment.

## Features

- Local PDF, JSON, and text statement parsing.
- Support for multiple buyers and sellers.
- Carries forward property, party, acknowledgement, and instalment information.
- Proposes cumulative instalments, TDS, interest, fee, and total with explicit
  source/confidence information.
- Requires a review acknowledgement before autofill.
- Preview mode reports page matches without changing the portal.
- Blank-only filling by default; overwriting requires an explicit opt-in.
- Session-scoped state with a two-hour expiry.
- Content-script access restricted to official Income Tax portal domains.
- No submission or payment automation.

## Install in Chrome

```bash
npm install
npm run build
```

Then:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `dist/extension`.

## Install temporarily in Firefox

1. Run `npm install && npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on**.
4. Select `dist/extension/manifest.json`.

## Use

1. Log in to the official Income Tax portal yourself.
2. Open the extension and select the previous challan statement.
3. Enter the new amount. The date defaults to today and is editable.
4. Review the complete proposal, especially the parties, shares, dates, rate,
   TDS, interest, fee, and total.
5. Confirm the review.
6. On each relevant Form 26QB page, use **Preview matches** and then **Fill blank
   fields**.
7. Continue, submit, and complete payment manually.

## Development

```bash
npm install
npm test
npm run package
```

Outputs:

- unpacked extension: `dist/extension`
- ZIP package: `dist/tds-26qb-assistant.zip`

The statement parser has been tested against a real three-page challan statement
without embedding its captured values in source or tests. Portal matching is
label-based and must be tuned through preview-mode feedback on the authenticated
form.

## Safety

This tool reproduces user-supplied and previously filed information; it does not
determine tax treatment. Confirm all inferred financial values against the
portal or a qualified tax professional.

Never commit challan statements, HAR files, browser profiles, receipts, or live
filing data. The repository `.gitignore` excludes those paths and formats.
