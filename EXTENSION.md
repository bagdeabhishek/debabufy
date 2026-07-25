# 26QB Next Instalment Assistant

This is a local Manifest V3 extension for Chrome and Firefox. It reads the
previous Form 26QB challan statement, asks for the current payment amount and
date, proposes the next instalment, and fills matching fields on the currently
open Income Tax portal page.

It never uploads the statement, stores portal credentials, clicks Continue,
creates a challan, submits the form, or authorizes payment.

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/extension` directory.
5. Pin **26QB Next Instalment Assistant**.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist/extension/manifest.json`.

Firefox removes temporary extensions when it restarts. A signed permanent
Firefox package can be produced after the selector behavior has been proven on
the live form.

## Use

1. Open and log in to the official Income Tax portal yourself.
2. Open the extension.
3. Select the previous challan statement PDF.
4. Enter only the current amount. The date defaults to today and remains editable.
5. Click **Analyze locally**.
6. Review the carried and proposed fields. In particular, confirm:
   - parties and shares;
   - property and consideration;
   - previous acknowledgement and cumulative instalments;
   - payment and deduction dates;
   - rate, TDS, interest, fee, and total.
7. Check the review confirmation.
8. Navigate to the relevant Form 26QB page.
9. Use **Preview matches** before **Fill blank fields**.
10. Continue through the portal manually, reopening the extension on each page
    that needs filling.

The reviewed proposal is held in browser session storage for at most two hours
so it survives portal navigation. **Clear** removes it immediately.

## Current safety and implementation boundaries

- Autofill is label-based and only changes visible input, textarea, and native
  select controls.
- Angular/custom dropdowns are reported as matched but remain manual in this MVP.
- Existing values are skipped unless **Overwrite fields that already contain
  values** is explicitly enabled.
- The content script is restricted to `www.incometax.gov.in` and
  `eportal.incometax.gov.in`.
- No submission or payment buttons are queried or clicked.
- Browser-session storage is used when available. Older Firefox versions may
  fall back to local storage with the same two-hour expiry.

## Build and test

```bash
npm install
npm test
npm run package
```

Outputs:

- unpacked extension: `dist/extension`
- ZIP package: `dist/tds-26qb-assistant.zip`

## Next live-test loop

The statement parser has been tested against the supplied three-page challan
statement. Portal field selectors cannot be fully verified without a live,
authenticated form page. Use **Preview matches** on each Form 26QB step; the
result counts will show which page labels need a selector alias. Do not enable
overwrite during the first live test.
