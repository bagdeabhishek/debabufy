# Troubleshooting

Start by confirming that the latest build passed CI and that the Income Tax
portal tab was reloaded after installing or updating the extension.

## The extension is missing after Firefox restarts

Firefox's **Load Temporary Add-on** installation lasts only until the browser
restarts. Load `manifest.json` again from
`about:debugging#/runtime/this-firefox`.

## The popup says in-memory session storage is unavailable

Use Chrome/Chromium 102 or newer or Firefox 142 or newer. The project does not
fall back to persistent disk storage because the filing proposal can contain
sensitive data.

## “Choose the previous statement”

Select a PDF, JSON, or text file before choosing **Analyze locally**. For a
privacy-safe test, use `examples/synthetic-statement.json`.

## Analysis fails or important details are missing

The official challan statement layout may have changed, or the PDF may not
contain extractable text.

- Confirm that the file is a Form 26QB challan statement rather than a payment
  receipt or screenshot.
- Try the synthetic JSON to distinguish an installation problem from a
  statement-layout problem.
- Do not upload the real PDF to an issue.
- Report only the missing normalized field path and a rewritten,
  non-identifying version of the nearby label.

## “The portal helper is not loaded”

1. Confirm the active tab is on `www.incometax.gov.in` or
   `eportal.incometax.gov.in`.
2. Reload the portal tab after installing or updating the extension.
3. Navigate back to the relevant Form 26QB step.
4. Open the extension and try **Preview matches** again.

The content script intentionally does not run on other websites.

## Preview finds zero or too few fields

Portal steps expose different fields, and labels can change.

- Confirm that the relevant 26QB step is visible in the active tab.
- Repeat preview on each page rather than expecting one page to contain the
  whole filing.
- Custom Angular dropdowns can be reported as unresolved and must be selected
  manually in this version.
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
