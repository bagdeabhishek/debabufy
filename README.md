# Form 141 Schedule B Next Instalment Assistant

[![CI](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)](#project-status)
[![Privacy: local only](https://img.shields.io/badge/privacy-local--only-146c43.svg)](PRIVACY.md)

An unofficial, local-only CLI for preparing and browser-filling the next
property-TDS instalment in Form 141 Schedule B. A Chrome/Firefox extension is
also included as an optional interface.

Give it the previous challan statement and the amount paid or credited this
time. It extracts the recurring details, proposes the next instalment, shows the
important values for review, and fills matching fields on the currently open
Income Tax portal page.

> [!IMPORTANT]
> This project is not affiliated with, endorsed by, or operated by the Income
> Tax Department, Government of India, or any payment provider. It is not tax,
> legal, or financial advice. The assistant is alpha software: review every
> value and complete submission and payment yourself.

## At a glance

| | |
| --- | --- |
| **You provide** | Previous Form 141 Schedule B challan statement, current payment amount, and date |
| **It proposes** | Carried party/property data, cumulative instalments, TDS, interest, fee, and total |
| **It can fill** | The current Schedule B page or open Buyer, Seller, or Transaction “Add Details” dialog through a separate Chrome/Edge profile |
| **It never does** | Credentials, OTP, CAPTCHA, form submission, challan/payment creation, or payment authorization |
| **Data handling** | Parsing stays local; the CLI uses a separate browser profile and the extension uses two-hour in-memory proposal storage |
| **Current status** | Alpha; CLI dry run passes, live portal selector testing is still required |

## CLI quick start

Requirements: Node.js 22.13 or newer, npm, and installed Google Chrome or
Microsoft Edge.

```bash
git clone https://github.com/bagdeabhishek/tds-26qb-assistant.git
cd tds-26qb-assistant
npm ci
npm run cli -- \
  --statement examples/synthetic-statement.json \
  --amount 500000 \
  --date 2026-07-28 \
  --dry-run
```

For a real filing, use the previous Form 141 Schedule B challan statement:

```bash
npm run cli -- \
  --statement "/path/to/previous-challan-statement.pdf" \
  --amount 500000 \
  --date 2026-07-28
```

The CLI prints no PANs, names, contacts, or addresses. After you type
`REVIEWED`, it opens a separate persistent Chrome profile. Complete login and
CAPTCHA/OTP yourself, open Form 141 Schedule B, then press Enter in the terminal
to fill the current page or dialog. You still click Add, Save, Continue, Submit,
and Pay yourself.

Use an existing candidate JSON with:

```bash
npm run cli -- --candidate "/path/to/form141-next-instalment.json"
```

The separate browser profile contains portal session data. Its location is
printed when the CLI starts; remove that directory when you no longer want the
session retained.

## Optional extension dry run

This checks the popup review flow without using private data or opening the
Income Tax portal.

```bash
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**, select **Load unpacked**, and choose
   `dist/chrome`.
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
4. Choose `dist/chrome`.
5. Pin **Form 141 Schedule B Assistant**.
6. Reload any Income Tax portal tab that was already open.

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on**.
3. Choose `dist/firefox/manifest.json`.

Firefox removes a temporary extension when the browser restarts.

### Download a verified main build

Every successful push to `main` creates an automated GitHub prerelease with
browser packages, a CLI package, and matching checksums:

- `form141-assistant-cli.tgz`
- `form141-assistant-cli.tgz.sha256`
- `tds-26qb-assistant-chrome.zip`
- `tds-26qb-assistant-chrome.zip.sha256`
- `tds-26qb-assistant-firefox.zip`
- `tds-26qb-assistant-firefox.zip.sha256`

Open [Releases](https://github.com/bagdeabhishek/tds-26qb-assistant/releases),
choose the newest `Main build #…` prerelease, and download the CLI or browser
package. Verify its checksum before use.

Install the downloaded CLI archive locally or globally:

```bash
npm install --global ./form141-assistant-cli.tgz
form141-assistant --help
```

The same packages are also available as separate CLI, Chrome, and Firefox
workflow artifacts on the corresponding
[successful `main` run](https://github.com/bagdeabhishek/tds-26qb-assistant/actions/workflows/ci.yml?query=branch%3Amain+event%3Apush)
for 30 days. GitHub requires sign-in to download workflow artifacts.

The ZIPs are unsigned deployment packages: upload the Chrome ZIP to the Chrome
Web Store or the Firefox ZIP to AMO. For local testing, extract the chosen ZIP
and load its root directory/manifest using the browser steps above.

See [Getting started](docs/GETTING_STARTED.md) for checksum commands and a
careful first live-test procedure.

## Use the optional extension for a filing

Before starting, keep the previous challan statement available and log in to the
official Income Tax portal yourself.

1. Open the extension and choose the previous statement PDF.
2. Enter the amount paid or credited this time. The date defaults to today and
   remains editable.
3. Select **Analyze locally**.
4. Review the parties, shares, property, acknowledgement number, cumulative
   instalments, dates, rate, TDS, interest, fee, and total.
5. Correct the complete filing JSON if necessary, then confirm the review.
6. Navigate manually to the Form 141 Schedule B transaction page.
7. Select **Preview matches**. Preview does not modify the page.
8. If the preview is correct, select **Fill blank fields**.
9. Open each Buyer, Seller, or Transaction **Add Details** dialog and repeat
   preview/fill. Review the row, then click the portal's Add/Save action yourself.
10. Review everything again, then submit and pay manually.
11. Select **Clear** when finished.

For the first live test, leave overwrite disabled. The extension attempts
native and Angular dropdowns and reports any option it cannot select.

## Safety and privacy

- PDF, JSON, and text parsing happens locally in the CLI or extension popup.
- There is no analytics, telemetry, advertising, remote API, or backend service.
- The CLI uses a separate persistent Chrome/Edge profile so portal login can
  survive restarts. Delete the printed profile directory to remove that session.
- The reviewed proposal uses in-memory `storage.session`, expires after two
  hours, and is cleared on restart, extension reload/update/disable, or
  **Clear**.
- The content script is restricted to `www.incometax.gov.in` and
  `eportal.incometax.gov.in`.
- Visible blank fields are the default fill target.
- Add, Save, Continue, submission, and payment controls are never clicked.
- The extension does not request cookie, history, download, web-request,
  clipboard, or all-sites access.

Read the complete [privacy policy](PRIVACY.md) and
[security boundaries](SECURITY.md).

## Project status

**Alpha / live-testing required.**

Statement parsing and inference are covered by synthetic tests. The Income Tax
portal is a changing third-party application, so field matching must be checked
through CLI preview or the extension's **Preview matches** mode. Both interfaces
stop before submission, challan creation, and payment.

Known limitations:

- live portal labels and custom controls can change without notice;
- the extension must be rerun inside each Form 141 Add Details dialog;
- a combined property address from the prior statement remains manual because
  splitting it into portal address components would be ambiguous;
- only recurring Form 141 Schedule B property-TDS instalments are in scope;
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

- CLI package and checksum:
  `dist/form141-assistant-cli.tgz` and `.tgz.sha256`
- unpacked Chrome extension: `dist/chrome`
- unpacked Firefox extension: `dist/firefox`
- Chrome deployment package and checksum:
  `dist/tds-26qb-assistant-chrome.zip` and `.zip.sha256`
- Firefox deployment package and checksum:
  `dist/tds-26qb-assistant-firefox.zip` and `.zip.sha256`

Important source areas:

- `bin/form141-assistant.js` — primary guided Playwright CLI
- `src/cli/args.js` — CLI argument validation
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
