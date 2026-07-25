# 26QB Next Instalment Assistant

[![CI](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)

An unofficial, local-only Chrome and Firefox extension for preparing recurring
Form 26QB instalment filings.

Provide the previous challan statement and the new payment amount. The extension
extracts the recurring details, proposes the next instalment, shows every
important value for review, and fills matching fields on the currently open
Income Tax portal page.

> [!IMPORTANT]
> This project is not affiliated with, endorsed by, or operated by the Income
> Tax Department, Government of India, HDFC Bank, PayU, or any payment provider.
> It is not tax, legal, or financial advice. Review every value before filing.

## Project status

**Alpha / live-testing required.**

Statement parsing and inference are covered by synthetic tests. The Income Tax
portal is a changing third-party application, so field matching must be
validated through the extension's non-mutating **Preview matches** mode before
each release. The extension intentionally stops before navigation, submission,
challan creation, and payment.

## What it does

- Parses prior Form 26QB challan statements locally from PDF, JSON, or text.
- Supports multiple buyers and sellers.
- Carries forward party, property, acknowledgement, and instalment information.
- Proposes the cumulative prior instalment, rate-based TDS, interest, fee, and
  total with visible source/confidence information.
- Requires explicit review before page filling is enabled.
- Previews field matches without changing the portal.
- Fills only visible blank fields by default.
- Keeps the reviewed proposal in memory for at most two hours.
- Restricts its content script to the two official Income Tax portal origins.
- Never clicks Continue, Submit, Pay, or any payment authorization control.

## What it does not do

- Store or submit portal passwords, OTPs, CAPTCHAs, QR approvals, or bank credentials.
- Decide tax treatment or guarantee that a proposed rate, interest, fee, or
  amount is correct.
- Create a challan, submit a filing, or authorize a payment.
- Bypass portal validation, authentication, anti-automation, or payment controls.
- Send statement or filing data to a server.

## Privacy model

All statement parsing and inference happens inside the extension popup.

- No analytics, telemetry, advertising, remote API, or network request is used.
- Reviewed filing data is stored only in `storage.session`, which browsers keep
  in memory and clear on restart, extension reload/update, or disable.
- The proposal expires after two hours and can be removed immediately with
  **Clear**.
- Content-script messages contain the reviewed proposal only while the user is
  actively filling an official portal page.
- The repository and release package contain no real statements, PANs, contact
  details, payment data, HAR files, or browser profiles.

See [PRIVACY.md](PRIVACY.md) for the complete policy.

## Permissions

| Permission/access | Why it is needed |
| --- | --- |
| `activeTab` | Communicate with the official portal tab only after the user opens the extension. |
| `storage` | Hold the reviewed proposal in memory across portal navigation. |
| `https://www.incometax.gov.in/*` | Run the guarded field matcher on the public portal origin. |
| `https://eportal.incometax.gov.in/*` | Run the guarded field matcher on the authenticated portal origin. |

The extension does not request cookie, history, download, web-request, clipboard,
or broad all-sites access.

## Install from source

Requirements: Node.js 22.13 or newer and npm.

```bash
git clone https://github.com/bagdeabhishek/tds-26qb-assistant.git
cd tds-26qb-assistant
npm ci
npm run build
```

### Chrome

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `dist/extension`.
5. Reload any Income Tax portal tab that was open during installation.

### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on**.
3. Select `dist/extension/manifest.json`.

Temporary Firefox extensions are removed when Firefox restarts.

## Usage

1. Log in to the official Income Tax portal yourself.
2. Open the extension and select the previous challan statement.
3. Enter the current payment amount. The date defaults to today and is editable.
4. Review the parties, shares, property, acknowledgement, cumulative
   instalments, dates, rate, TDS, interest, fee, and total.
5. Confirm the review.
6. Navigate to the relevant Form 26QB step.
7. Click **Preview matches**.
8. If the preview is correct, click **Fill blank fields**.
9. Continue through the portal manually. Repeat preview/fill on later pages.
10. Review, submit, and complete payment yourself.
11. Click **Clear** when finished.

Do not enable overwrite during the first live test.

## Development

```bash
npm ci
npm run check
npm test
npm run package
npm run verify:package
```

Outputs:

- unpacked extension: `dist/extension`
- ZIP package: `dist/tds-26qb-assistant.zip`
- SHA-256 checksum: `dist/tds-26qb-assistant.zip.sha256`

Every push or merged pull request to `main` runs CI and uploads the ZIP and
checksum as a GitHub Actions artifact retained for 30 days. Open the successful
workflow run and download the `tds-26qb-assistant-main-*` artifact.

Before changing repository visibility or publishing a browser-store package,
complete the [public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md).

Important source areas:

- `src/lib/statement.js` — statement parsing and normalization
- `src/lib/infer.js` — next-instalment proposal and review decisions
- `extension/content.js` — guarded portal matching and field filling
- `extension/popup.js` — local PDF workflow and review interface
- `test/statement.test.js` — synthetic statement/inference coverage

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.
Never attach a real statement, HAR, PAN, address, email, phone number, challan
reference, bank reference, or portal screenshot containing personal data.

Security issues should be reported privately according to
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)

Bundled third-party software retains its original license; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
