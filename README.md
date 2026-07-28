# 26QB Next Instalment Assistant

[![CI](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)
[![Privacy: local only](https://img.shields.io/badge/privacy-local--only-146c43.svg)](PRIVACY.md)

An unofficial, local-only Chrome and Firefox extension for preparing the next
instalment in a recurring Form 26QB filing.

Give it the previous challan statement and the amount paid or credited this
time. It extracts the recurring details, proposes the next instalment, shows the
important values for review, and fills matching fields on the currently open
Income Tax portal page.

> [!IMPORTANT]
> This project is not affiliated with, endorsed by, or operated by the Income
> Tax Department, Government of India, or any payment provider. It is not tax,
> legal, or financial advice. The extension is alpha software: review every
> value and complete submission and payment yourself.

## At a glance

| | |
| --- | --- |
| **You provide** | Previous Form 26QB challan statement, current payment amount, and date |
| **It proposes** | Carried party/property data, cumulative instalments, TDS, interest, fee, and total |
| **It can fill** | Visible matching fields on the two official Income Tax portal origins |
| **It never does** | Login, OTP, CAPTCHA, navigation, submission, challan creation, or payment |
| **Data handling** | Parsing stays in the extension; reviewed data is held in memory for at most two hours |
| **Current status** | Alpha; source installation and live testing are required |

## Five-minute dry run

This checks the parser and review flow without using private data or opening the
Income Tax portal.

Requirements: Node.js 22.13 or newer, npm, and Chrome/Chromium.

```bash
git clone https://github.com/bagdeabhishek/tds-26qb-assistant.git
cd tds-26qb-assistant
npm ci
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**, select **Load unpacked**, and choose
   `dist/extension`.
3. Open the extension from the browser toolbar.
4. Choose `examples/synthetic-statement.json`.
5. Enter `500000` as the current amount and select a date.
6. Select **Analyze locally**.
7. Confirm that the proposal shows:
   - previous instalments total: ₹3,00,000;
   - this payment: ₹5,00,000; and
   - proposed TDS and total: ₹5,000 at the carried 1% rate.
8. Inspect the warnings and the complete JSON. Do not use the synthetic proposal
   on the real portal.

The sample contains invented placeholders only. It is safe to inspect, modify,
and use in public bug reports.

## Install

There is no Chrome Web Store or Firefox Add-ons release yet. Install the alpha
from source, or download a CI build if you are signed in to GitHub.

### Build from source

```bash
npm ci
npm run build
```

#### Chrome / Chromium

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose `dist/extension`.
5. Pin **26QB Next Instalment Assistant**.
6. Reload any Income Tax portal tab that was already open.

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/extension/manifest.json`.

Firefox removes a temporary extension when the browser restarts.

### Download a verified CI build

Every merge to `main` creates a ZIP and SHA-256 checksum retained for 30 days.
You must be signed in to GitHub to download workflow artifacts.

1. Open the latest successful
   [CI run for `main`](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush).
2. Download the `tds-26qb-assistant-main-*` artifact.
3. Extract the downloaded artifact, then verify
   `tds-26qb-assistant.zip.sha256`.
4. Extract `tds-26qb-assistant.zip` and load the extracted directory as an
   unpacked/temporary extension using the browser steps above.

See [Getting started](docs/GETTING_STARTED.md) for checksum commands and a
careful first live-test procedure.

## Use it for a filing

Before starting, keep the previous challan statement available and log in to the
official Income Tax portal yourself.

1. Open the extension and choose the previous statement PDF.
2. Enter the amount paid or credited this time. The date defaults to today and
   remains editable.
3. Select **Analyze locally**.
4. Review the parties, shares, property, acknowledgement number, cumulative
   instalments, dates, rate, TDS, interest, fee, and total.
5. Correct the complete filing JSON if necessary, then confirm the review.
6. Navigate manually to the relevant Form 26QB step.
7. Select **Preview matches**. Preview does not modify the page.
8. If the preview is correct, select **Fill blank fields**.
9. Repeat preview/fill on later pages as needed.
10. Review everything again, then submit and pay manually.
11. Select **Clear** when finished.

For the first live test, leave overwrite disabled. Custom Angular dropdowns may
still require manual selection.

## Safety and privacy

- PDF, JSON, and text parsing happens inside the extension popup.
- There is no analytics, telemetry, advertising, remote API, or backend service.
- The reviewed proposal uses in-memory `storage.session`, expires after two
  hours, and is cleared on restart, extension reload/update/disable, or
  **Clear**.
- The content script is restricted to `www.incometax.gov.in` and
  `eportal.incometax.gov.in`.
- Visible blank fields are the default fill target.
- Submission and payment controls are never queried or clicked.
- The extension does not request cookie, history, download, web-request,
  clipboard, or all-sites access.

Read the complete [privacy policy](PRIVACY.md) and
[security boundaries](SECURITY.md).

## Project status

**Alpha / live-testing required.**

Statement parsing and inference are covered by synthetic tests. The Income Tax
portal is a changing third-party application, so field matching must be checked
through the non-mutating **Preview matches** mode. The extension intentionally
stops before navigation, submission, challan creation, and payment.

Known limitations:

- live portal labels and custom controls can change without notice;
- Angular/custom dropdowns are reported but remain manual in this MVP;
- only recurring Form 26QB Schedule B-style instalments are in scope;
- Firefox installation is temporary until a signed package is published; and
- there is no one-click browser-store installation yet.

If something does not work, start with
[Troubleshooting](docs/TROUBLESHOOTING.md).

## Documentation

| Guide | Purpose |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | Installation, checksum verification, dry run, and first live test |
| [Extension guide](EXTENSION.md) | Detailed workflow and implementation boundaries |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common errors and privacy-safe bug reporting |
| [Privacy policy](PRIVACY.md) | What data is processed and how it is held |
| [Security policy](SECURITY.md) | Security boundaries and private reporting |
| [Support](SUPPORT.md) | Where to ask questions or report problems |
| [Contributing](CONTRIBUTING.md) | Local setup and pull-request expectations |

## Development

```bash
npm ci
npm run check
npm test
npm run package
npm run verify:package
npm audit --omit=dev
```

Outputs:

- unpacked extension: `dist/extension`
- ZIP package: `dist/tds-26qb-assistant.zip`
- SHA-256 checksum: `dist/tds-26qb-assistant.zip.sha256`

Important source areas:

- `src/lib/statement.js` — statement parsing and normalization
- `src/lib/infer.js` — next-instalment proposal and review decisions
- `extension/content.js` — guarded portal matching and field filling
- `extension/popup.js` — local PDF workflow and review interface
- `test/statement.test.js` — synthetic statement/inference coverage

Before changing repository visibility or publishing a browser-store package,
complete the [public release checklist](docs/PUBLIC_RELEASE_CHECKLIST.md).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening an issue or pull request.

Never attach a real statement, HAR, PAN, address, email, phone number,
acknowledgement number, bank reference, payment data, or unredacted portal
screenshot. Use synthetic data and field paths only.

Security issues must be reported privately according to
[SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Bundled third-party software retains its original license; see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
