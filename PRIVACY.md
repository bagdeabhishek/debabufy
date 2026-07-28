# Privacy policy

Effective date: 26 July 2026

Form 141 Schedule B Assistant is designed to process filing information
locally. The project does not operate a backend service and does not collect,
sell, transmit, or monetize personal information.

## Data processed

When directed by the user, the extension may process a prior Form 141 Schedule
B challan statement and a proposed filing containing information such as PAN-formatted
identifiers, names, contact details, addresses, property information, filing
references, dates, and monetary values.

## Processing and storage

- PDF, JSON, and text parsing happens locally within the CLI or extension popup.
- The project makes no analytics, telemetry, advertising, or remote API request.
- The CLI launches an installed Chrome/Edge browser with a separate persistent
  profile. That profile is stored on the user's computer and may contain Income
  Tax portal cookies and session data until the user deletes it.
- A reviewed proposal is held in the browser's in-memory extension session
  storage so it can survive portal navigation.
- The proposal expires after two hours and is cleared on browser restart,
  extension reload/update, extension disable, or the user's **Clear** action.
- There is no disk-backed storage fallback.
- The content script receives the reviewed proposal only when the user invokes
  preview or fill on an official Income Tax portal page.
- The CLI passes the reviewed proposal only to the official portal page opened
  in its Playwright-controlled browser context.
- The optional diagnostic recorder stores only value-redacted page/control
  schemas, Income Tax payment-API endpoint paths, JSON key/type paths, HTTP
  status codes, and redacted runtime errors in extension session memory.
- Diagnostic recording is opt-in. It never records request or response values,
  headers, cookies, tokens, PANs, amounts, names, contacts, or addresses. The
  user must explicitly download or clear the report.

## Third-party processing

The Income Tax portal is a third-party service with its own terms and privacy
practices. When the user asks the CLI or extension to fill a page, the values
become part of that page in the same way as manually entered values. The project
does not control how the portal subsequently processes them.

PDF parsing is performed by a copy of PDF.js packaged inside the extension. It
is not loaded from a CDN.

## Permissions

The extension requests only:

- `activeTab` to communicate with the user-invoked official portal tab;
- `storage` for in-memory session state; and
- content-script access limited to `www.incometax.gov.in` and
  `eportal.incometax.gov.in`.

It does not request cookie, history, download, clipboard, web-request, or
all-sites access.

## Source repository and issue reports

The source repository contains synthetic fixtures only. Contributors and users
must not attach real statements, HAR files, PANs, contact details, addresses,
payment references, credentials, OTPs, or unredacted portal screenshots to
issues or pull requests.

## Changes

Material privacy changes will be documented in the changelog and release notes.
Changes requiring new permissions will not be treated as silent updates.

## Contact

For privacy questions that do not contain personal filing data, open a regular
repository issue. Report vulnerabilities privately as described in
[SECURITY.md](SECURITY.md).
