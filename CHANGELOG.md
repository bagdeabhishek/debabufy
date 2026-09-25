# Changelog

## Unreleased

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
