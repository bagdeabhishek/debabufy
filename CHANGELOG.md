# Changelog

All notable changes will be documented in this file.

## [Unreleased]

- Added a Playwright-based CLI as the primary interface, using a separate
  persistent Chrome/Edge profile and an explicit review gate.
- Added a deployable CLI `.tgz` and checksum to main-branch artifacts/releases.
- Reoriented the extension around Form 141 Schedule B instead of the legacy
  Form 26QB page model.
- Detects the main Schedule B page and Buyer, Seller, and Transaction Add
  Details dialogs rather than treating every filing field as present at once.
- Distinguishes matched, filled, pre-populated, unsupported, deferred, and
  missing fields.
- Added radio-button and Angular/custom dropdown handling.
- Added a downloadable value-free, pattern-redacted page map for portal selector
  debugging.
- Added an opt-in, session-only diagnostic recorder for redacted page/control
  schemas, API key/type paths, status codes, and runtime errors, plus a remote
  computer-use test runbook.
- Replaced the portal-rejected Playwright-launched profile with an attach-only
  CLI mode for a manually started and authenticated Chrome session. The runner
  accepts loopback CDP endpoints only and refuses pages exposing
  `navigator.webdriver`.
- Rejects Form 132 TDS certificates with a clear prompt for the prior Form 141
  challan statement.
- User-first quick start, synthetic dry-run fixture, troubleshooting, support,
  and pull-request guidance.
- Branded extension icons and explicit minimum browser versions.
- Target-specific Chrome and Firefox deployment packages, workflow artifacts,
  checksums, and automated main-build GitHub prereleases.
- Firefox 115 compatibility floor based on the first version supporting
  in-memory `storage.session`.
- Public-facing documentation and privacy/security policies.
- In-memory-only proposal storage with no local-storage fallback.
- Reduced extension permissions by removing runtime scripting and redundant
  host permissions.
- CI, Dependabot, contribution guidance, and synthetic-data safeguards.

## [0.1.0] - 2026-07-26

- Initial alpha extension.
- Local PDF/JSON/text statement parsing.
- Reviewable next-instalment inference.
- Preview-first, blank-only portal field filling.
- Chrome/Firefox Manifest V3 package.
