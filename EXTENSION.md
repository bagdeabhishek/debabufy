# Form 141 Schedule B Next Instalment Assistant

This is a local Manifest V3 extension for Chrome and Firefox. It reads the
previous Form 141 Schedule B challan statement, asks for the current payment
amount and date, proposes the next instalment, and fills matching fields on the
current Schedule B page or open Add Details dialog.

It never uploads the statement, stores portal credentials, clicks Continue,
creates a challan, submits the form, or authorizes payment.

## Install in Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `dist/chrome` directory.
5. Pin **Form 141 Schedule B Assistant**.

## Install temporarily in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist/firefox/manifest.json`.

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
8. Navigate to the Form 141 Schedule B transaction page.
9. Use **Preview matches** before **Fill blank fields**.
10. Open each Buyer, Seller, or Transaction **Add Details** dialog and rerun
    Preview/Fill. Review and save each row yourself.

The reviewed proposal is held only in in-memory browser session storage for at
most two hours so it survives portal navigation. **Clear** removes it
immediately, and the browser clears it on restart.

## Current safety and implementation boundaries

- Autofill is label-based and only changes visible controls on the current page
  or dialog.
- Native and Angular dropdown options are matched locally. Unmatched custom
  controls are reported for manual selection.
- Form 141 table rows require the user to open the relevant Add Details dialog.
- A combined property address is left manual because the previous statement
  does not reliably preserve the portal's individual address fields.
- Existing values are skipped unless **Overwrite fields that already contain
  values** is explicitly enabled.
- The content script is restricted to `www.incometax.gov.in` and
  `eportal.incometax.gov.in`.
- No Add, Save, Continue, submission, or payment buttons are queried or clicked.
- No submission or payment buttons are queried or clicked.
- In-memory browser-session storage is required; there is no disk-backed storage
  fallback.

## Build and test

```bash
npm ci
npm run check
npm test
npm run package
npm run verify:package
```

Outputs:

- unpacked Chrome extension: `dist/chrome`
- unpacked Firefox extension: `dist/firefox`
- Chrome deployment ZIP and checksum:
  `dist/tds-26qb-assistant-chrome.zip` and `.zip.sha256`
- Firefox deployment ZIP and checksum:
  `dist/tds-26qb-assistant-firefox.zip` and `.zip.sha256`

Successful pushes to `main` upload separate Chrome and Firefox workflow
artifacts retained for 30 days and publish both packages on an automated GitHub
prerelease.

## Next live-test loop

The statement parser is covered by a synthetic fixture matching the observed
three-page challan layout. Portal field selectors cannot be fully verified
without a live, authenticated form page. Use **Preview matches** on each Form
Form 141 section; the result counts show which page labels need a selector alias. Never
include real statements, PANs, contact details, or payment data in an issue.
