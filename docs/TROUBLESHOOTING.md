# Troubleshooting

Start by confirming that the latest build passed CI and that the Income Tax
portal tab was reloaded after installing or updating the extension.

## The CLI cannot launch Chrome or Edge

Install the selected browser and confirm it opens normally. The CLI uses
Playwright's `chrome` channel by default; pass `--browser msedge` to use
Microsoft Edge. It intentionally does not reuse your normal browser profile.

## The CLI fills the wrong section or finds too few fields

Run `p` in the CLI to preview the current page/dialog without changing it.
Buyer, seller, and transaction rows live behind separate **Add Details**
dialogs. Open the relevant dialog in the browser, return to the terminal, and
press Enter again. Stop with `q` if the preview is unexpected.

## The extension is missing after Firefox restarts

Firefox's **Load Temporary Add-on** installation lasts only until the browser
restarts. Load `manifest.json` again from
`about:debugging#/runtime/this-firefox`.

## The popup says in-memory session storage is unavailable

Use Chrome/Chromium 102 or newer or Firefox 115 or newer. The project does not
fall back to persistent disk storage because the filing proposal can contain
sensitive data.

## “Choose the previous statement”

Select a PDF, JSON, or text file before choosing **Analyze locally**. For a
privacy-safe test, use `examples/synthetic-statement.json`.

## Analysis fails or important details are missing

The official challan statement layout may have changed, or the PDF may not
contain extractable text.

- Confirm that the file is a Form 141 Schedule B challan statement rather than
  a payment receipt, screenshot, or Form 132 TDS certificate.
- Try the synthetic JSON to distinguish an installation problem from a
  statement-layout problem.
- Do not upload the real PDF to an issue.
- Report only the missing normalized field path and a rewritten,
  non-identifying version of the nearby label.

## “The portal helper is not loaded”

1. Confirm the active tab is on `www.incometax.gov.in` or
   `eportal.incometax.gov.in`.
2. Reload the portal tab after installing or updating the extension.
3. Navigate back to the relevant Form 141 Schedule B page or Add Details dialog.
4. Open the extension and try **Preview matches** again.

The content script intentionally does not run on other websites.

## Preview finds zero or too few fields

Portal steps expose different fields, and labels can change.

- Confirm that the relevant Form 141 section or Add Details dialog is visible in
  the active tab.
- Buyer, seller, and transaction rows are not ordinary page inputs. Open the
  matching **Add Details** dialog before running Preview/Fill.
- Use **Download value-free page map** if a current portal control is still not
  recognized. The export redacts PAN-like, email, and long-number text and never
  includes entered control values. Review labels and identifiers yourself
  before attaching it to a bug report.
- Open a bug report with browser/version, extension commit or artifact name, the
  unresolved field paths, and rewritten synthetic labels only.

## Fields were skipped

Blank-only filling is the default. Existing values are reported as skipped.
Review them manually. Do not enable overwrite during the first live test.

## Preview changed a field

Stop immediately, select **Clear**, and report this as a bug using synthetic
reproduction steps. Preview is intended to be non-mutating.

## I found a security issue

Do not open a public issue. Follow [SECURITY.md](../SECURITY.md) and use GitHub
private vulnerability reporting.

## What to include in a public bug report

- browser and version;
- operating system;
- extension version, commit, or CI artifact name;
- whether the synthetic dry run passes;
- the relevant normalized field paths;
- expected versus actual behavior; and
- synthetic reproduction steps.

Never include a real statement, HAR, taxpayer identifier, name, contact detail,
address, acknowledgement number, credential, OTP, payment reference, bank
detail, or unredacted portal screenshot.
