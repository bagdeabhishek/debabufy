<p align="center">
  <img src="assets/brand/debabufy-mark.png" width="180" alt="DeBabufy logo — paperwork breaking free from red tape">
</p>

<h1 align="center">DeBabufy</h1>

<p align="center">
  <strong>India runs on forms. DeBabufy handles the repetitive bits.</strong><br>
  A local-first desktop app for turning tedious government workflows into<br>
  deterministic, reviewable automations.
</p>

<p align="center">
  <a href="https://github.com/bagdeabhishek/debabufy/actions/workflows/ci.yml"><img alt="CI status" src="https://github.com/bagdeabhishek/debabufy/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/bagdeabhishek/debabufy/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/bagdeabhishek/debabufy?include_prereleases&label=release&color=0aa69a"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-e06f39"></a>
  <a href="CONTRIBUTING.md"><img alt="Contributions welcome" src="https://img.shields.io/badge/contributions-welcome-24372a"></a>
</p>

<p align="center">
  <a href="https://github.com/bagdeabhishek/debabufy/releases"><strong>Download for Windows, macOS, or Linux</strong></a>
  ·
  <a href="#see-it-in-30-seconds">See how it works</a>
  ·
  <a href="#contributing">Build the next workflow</a>
</p>

> [!IMPORTANT]
> DeBabufy is unofficial alpha software. It is not affiliated with or endorsed
> by the Government of India or the Income Tax Department, and it does not
> provide tax or legal advice. Always review the portal before continuing.

## Less babu. More done.

Government portals often ask for information you already supplied last time.
DeBabufy reads the previous document locally, carries forward the stable facts,
calculates the new values with deterministic rules, and fills the repetitive
parts in a normal Chrome session.

| Local by default | Deterministic | Human-controlled |
|:---:|:---:|:---:|
| No filing backend or telemetry | No runtime LLM or probabilistic guessing | You handle login, OTP, review, submission, and payment |

## See it in 30 seconds

```text
Previous statement  +  This instalment
             │
             ▼
      Review the proposal
             │
             ▼
       Log in normally
             │
             ▼
   DeBabufy fills the portal
             │
             ▼
        You review again
```

For the first bundled workflow:

1. Drop in the previous **Form 141 challan statement**.
2. Enter the current amount and date.
3. Choose the buyer filing from the currently logged-in account.
4. Review parties, property, dates, TDS, interest, fee, and total.
5. Log into the Income Tax portal in the ordinary Chrome window DeBabufy opens.
6. Watch DeBabufy fill the particulars and detail dialogs, then review the result.

It stops before final submission or payment authorization.

## Available today

### Form 141 · Schedule B

Property-TDS instalments under section 393(1), including joint buyers and a
corporate or non-corporate seller.

- Reads the previous Form 141 statement from PDF, JSON, or text.
- Uses buyer-specific Form 132 evidence when a different joint buyer is filing.
- Carries forward the property, buyers, seller, and previous acknowledgement.
- Rounds portal-bound monetary values upward to whole rupees.
- Selects and verifies agreement, payment, and deduction dates.
- Edits the portal-created buyer before adding the remaining details.
- Adds buyers, sellers, and the transaction sequentially.
- Saves local diagnostics and fails closed when the portal changes.

Navigation from the portal dashboard to Form 141—and onward to the final
payment-review screen—is the next milestone. The current release expects you to
open Form 141 after logging in.

## Why it uses your normal Chrome

Some government portals reject browser profiles launched as automation. So
DeBabufy takes a different route:

```text
DeBabufy desktop app
      └── opens an ordinary, dedicated Chrome profile
              ├── you authenticate normally
              └── DeBabufy attaches locally over a loopback-only port
```

Playwright is used as a precise UI driver, not as a hosted bot. Credentials,
OTP, and CAPTCHA remain between you and the portal.

## Install

Get the latest unsigned alpha package from
[GitHub Releases](https://github.com/bagdeabhishek/debabufy/releases):

| Platform | Package | First launch |
|---|---|---|
| Windows x64 | `.exe` installer | SmartScreen may ask for confirmation |
| macOS Apple Silicon | `arm64.dmg` | Control-click → **Open** |
| macOS Intel | `x64.dmg` | Control-click → **Open** |
| Linux x64 | `.AppImage` | Mark the file executable |

Every package is built from `main` by GitHub Actions and published with a
SHA-256 checksum. The app checks public releases for updates but never installs
one silently.

## Run from source

Requirements: Node.js 22+, Google Chrome, and Windows, macOS, or Linux.

```sh
git clone https://github.com/bagdeabhishek/debabufy.git
cd debabufy
npm install
npm test
npm start
```

## Trust, not magic

- Filing data stays on your device.
- No analytics or telemetry is collected.
- No runtime LLM sees your documents.
- DeBabufy never enters credentials or solves CAPTCHA/OTP.
- Unknown screens and invalid values stop the workflow instead of guessing.
- Final submission and payment authorization remain manual.
- Diagnostics stay local until you choose to share them.

Read the [privacy policy](PRIVACY.md), [security policy](SECURITY.md), and
[support guide](SUPPORT.md) before using real filing data.

## Contributing

DeBabufy is meant to grow one boring workflow at a time. Contributions are
welcome for portal fixes, accessibility, tests, documentation, design, and new
Indian administrative workflows.

```text
workflows/
  registry.js             Explicit bundled-workflow registry
  form-141/               One self-contained workflow
    browser/              Portal interaction helper
    docs/                 Workflow-specific support
    examples/             Synthetic fixtures only
    src/                  Parsing and deterministic inference
    test/                 Workflow tests
    workflow.json         Metadata and input definition
```

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and use only synthetic or fully
redacted fixtures. Never commit a real statement, PAN, Aadhaar number, address,
portal response, cookie, token, HAR, screenshot, or browser profile.

Good first contributions include:

- making an existing selector more resilient;
- improving keyboard and screen-reader support;
- adding synthetic parser fixtures;
- documenting a reproducible portal change; or
- proposing the next small, deterministic workflow.

## Roadmap

- [x] Local-first desktop shell
- [x] Form 141 Schedule B workflow
- [x] Windows, macOS, and Linux release artifacts
- [x] Joint-buyer and buyer-specific acknowledgement support
- [ ] Dashboard-to-payment-review navigation
- [ ] Signed release packages
- [ ] A stable, reviewed workflow plug-in interface
- [ ] More useful Indian administrative workflows

## License

[MIT](LICENSE) · Built in the open, for fewer unnecessary `chakkar`.
