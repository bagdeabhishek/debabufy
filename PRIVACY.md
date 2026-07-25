# Privacy policy

Effective date: 26 July 2026

26QB Next Instalment Assistant is designed to process filing information
locally. The project does not operate a backend service and does not collect,
sell, transmit, or monetize personal information.

## Data processed

When directed by the user, the extension may process a prior Form 26QB challan
statement and a proposed filing containing information such as PAN-formatted
identifiers, names, contact details, addresses, property information, filing
references, dates, and monetary values.

## Processing and storage

- PDF, JSON, and text parsing happens within the extension popup.
- The extension makes no analytics, telemetry, advertising, or remote API request.
- A reviewed proposal is held in the browser's in-memory extension session
  storage so it can survive portal navigation.
- The proposal expires after two hours and is cleared on browser restart,
  extension reload/update, extension disable, or the user's **Clear** action.
- There is no disk-backed storage fallback.
- The content script receives the reviewed proposal only when the user invokes
  preview or fill on an official Income Tax portal page.

## Third-party processing

The Income Tax portal is a third-party service with its own terms and privacy
practices. When the user asks the extension to fill a page, the values become
part of that page in the same way as manually entered values. The extension does
not control how the portal subsequently processes them.

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
