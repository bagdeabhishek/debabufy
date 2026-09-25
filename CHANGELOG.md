# Changelog

## Unreleased

## 0.2.5 - 2026-09-26

- Save live diagnostics for failures during the particulars and intermediate
  Continue stages, not only failures while adding detail rows.
- Record redacted visible validation messages, portal request statuses, and
  browser warnings/errors when Continue fails to advance.

## 0.2.4 - 2026-09-25

- Recognize the Form 141 particulars screen from its rendered controls even
  when the portal omits its headings from accessible page text.
- Fill and continue through the particulars and deductee-type steps before
  running the buyer, seller, and transaction-row automation.
- Verify that every portal date exactly matches the reviewed date (or an
  explicitly reported transaction-date substitution) and stop on silent date
  reformatting instead of accepting it.
- Publish unsigned macOS DMGs for Intel and Apple Silicon and a Linux x64
  AppImage alongside the Windows installer.
- Offer the correct update download for each supported desktop package.

## 0.2.3 - 2026-09-25

- Added a non-blocking update check against DeBabufy's public GitHub releases.
- Show an in-app download banner when a newer trusted Windows x64 installer is
  available; installation remains explicitly user-controlled.

## 0.2.2 - 2026-09-25

- Select the nearest enabled transaction payment or deduction date when the
  exact reviewed date is unavailable, restricted to the same month and with
  the earlier date preferred on a tie.
- Surface every date substitution prominently for review, while keeping
  property agreement dates exact.

## 0.2.1 - 2026-09-25

- Round every portal-bound monetary value upward to a whole rupee so the
  Income Tax portal cannot remove decimal points and inflate the entered
  amount.

## 0.2.0 - 2026-09-25

- Added an explicit payment and deduction date to the desktop review flow.
- Added filing-buyer selection for jointly purchased property.
- Added local Form 132 verification so a co-buyer's previous acknowledgement
  can be used safely with the shared property details from another buyer's
  Form 141 statement.
- Updated PDF.js to a patched release after the production dependency audit
  identified a malicious-PDF code-execution advisory.

## 0.1.0 - 2026-07-29

- Created the DeBabufy desktop application.
- Added the bundled Form 141 Schedule B workflow.
- Added deterministic proposal review from a previous challan and current
  payment amount.
- Added ordinary-Chrome launch and Playwright CDP attachment.
- Added a contributor-facing workflow module structure.
