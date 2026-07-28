# Getting started

This guide covers a safe installation, a synthetic dry run, and the first live
test. The extension is alpha software and is not yet distributed through a
browser store.

## What you need

- Chrome/Chromium 102 or newer, or Firefox 142 or newer;
- Node.js 22.13 or newer and npm if building from source;
- the previous Form 26QB challan statement for a real filing; and
- the amount paid or credited in the new instalment.

The extension does not log in, solve a CAPTCHA, request an OTP, navigate,
submit, create a challan, or authorize payment.

## Option A: build from source

```bash
git clone https://github.com/bagdeabhishek/tds-26qb-assistant.git
cd tds-26qb-assistant
npm ci
npm run check
npm test
npm run build
```

The unpacked extensions are now in `dist/chrome` and `dist/firefox`.

## Option B: use an automated main build

Every successful push to `main` creates a GitHub prerelease containing the
browser-targeted packages and checksums.

1. Open [Releases](https://github.com/bagdeabhishek/tds-26qb-assistant/releases).
2. Choose the newest `Main build #…` prerelease.
3. Download the Chrome or Firefox ZIP and its matching `.sha256` file.
4. Verify the checksum before extracting the extension package.

Linux or macOS:

```bash
sha256sum -c tds-26qb-assistant-chrome.zip.sha256
sha256sum -c tds-26qb-assistant-firefox.zip.sha256
```

PowerShell example for Chrome:

```powershell
$expected = (Get-Content .\tds-26qb-assistant-chrome.zip.sha256).Split()[0]
$actual = (Get-FileHash .\tds-26qb-assistant-chrome.zip -Algorithm SHA256).Hash.ToLower()
$actual -eq $expected
```

The PowerShell command should return `True`; `sha256sum` should report `OK`.
Extract the browser ZIP before loading it locally.

The same files are uploaded as separate Chrome and Firefox artifacts on the
corresponding
[main-branch CI run](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush)
and retained for 30 days. GitHub requires sign-in for workflow-artifact
downloads.

## Load the extension

### Chrome / Chromium

1. Enter `chrome://extensions` in the address bar.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/chrome` if you built from source, or the extracted Chrome
   package if you downloaded a main build.
5. Pin **26QB Next Instalment Assistant** from the extensions menu.

If an Income Tax portal tab was open during installation, reload it before
using preview or fill.

### Firefox

1. Enter `about:debugging#/runtime/this-firefox` in the address bar.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json` or `manifest.json` in the extracted
   Firefox package.

This temporary installation disappears when Firefox restarts.

## Run the synthetic test

Do this before using a real statement.

1. Open the extension.
2. Choose `examples/synthetic-statement.json` from the repository.
3. Enter `500000` as the current amount and choose a date.
4. Select **Analyze locally**.
5. Confirm that the proposal includes:
   - previous instalments total: ₹3,00,000;
   - this payment: ₹5,00,000;
   - proposed rate: 1%; and
   - proposed TDS and total: ₹5,000.
6. Expand **Edit complete filing JSON** and inspect the carried values.
7. Confirm the review and verify that the preview button becomes available.
8. Select **Clear** and confirm that the proposal disappears.

Do not use the synthetic proposal on the Income Tax portal. The placeholder
identifiers are intentionally invalid.

## First live test

Use a fresh browser profile if practical.

1. Log in to the official Income Tax portal manually.
2. Open the extension and choose the previous challan statement PDF.
3. Enter the current payment amount and date.
4. Select **Analyze locally**.
5. Compare every proposed value with the statement and your intended filing.
6. Correct any value in the complete JSON before confirming the review.
7. Navigate manually to the relevant Form 26QB page.
8. Leave overwrite disabled.
9. Select **Preview matches** and inspect the counts and unresolved field paths.
10. Only if preview is correct, select **Fill blank fields**.
11. Review every visible portal value after filling.
12. Continue, submit, and pay manually.
13. Select **Clear** when finished.

Stop if the previous statement is marked as a last instalment, the carried tax
year looks wrong, shares do not total 100%, the proposed rate differs from what
you expect, or prior plus current payments exceed the consideration value.

## Remove the extension

- Chrome: open `chrome://extensions` and select **Remove**.
- Firefox: restart the browser, or remove it from `about:debugging`.

The reviewed proposal is held only in extension session memory and is also
cleared on restart, extension reload/update/disable, or after two hours.

If anything differs from this guide, see
[Troubleshooting](TROUBLESHOOTING.md).
