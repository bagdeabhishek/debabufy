# DeBabufy

**Your paperwork. Less babu. More done.**

DeBabufy is an unofficial, open-source desktop application for repetitive
Indian administrative workflows. It runs locally, connects to an ordinary
Chrome session, and keeps a human in control of authentication, review,
submission, and payment.

> [!WARNING]
> DeBabufy is not affiliated with or endorsed by the Government of India or the
> Income Tax Department. It does not provide tax or legal advice.

## Current workflow

### Income Tax Form 141 — Schedule B

The first workflow prepares a subsequent property-TDS instalment using:

1. the previous Form 141 challan statement; and
2. the amount and date of the current instalment.

For a jointly purchased property, choose the buyer whose Income Tax account is
currently logged in. If that buyer did not file the selected Form 141 statement,
DeBabufy asks for their previous Form 132 certificate and verifies the buyer PAN
before carrying forward that buyer's acknowledgement number.

The parser carries forward the parties and property, calculates a deterministic
proposal from the previous statement, and shows every important figure for
review. No LLM, cloud API, or probabilistic agent is involved.

All monetary values sent to the portal are rounded upward to whole rupees. This
prevents the portal's integer-only controls from removing decimal points and
turning paise into extra digits.

For transaction payment and deduction dates, DeBabufy first selects the exact
reviewed date. If the portal disables that date, it selects the nearest enabled
date in the same month, preferring the earlier date on a tie, and surfaces the
substitution for review. Property agreement dates are never approximated.

The current desktop flow:

1. reads the previous PDF, JSON, or text statement locally;
2. lets you select the filing buyer and verifies buyer-specific Form 132 evidence
   when necessary;
3. infers the next proposal using deterministic rules;
4. launches a dedicated ordinary Chrome profile;
5. waits for you to log in and open Form 141 Schedule B;
6. fills the main fields;
7. edits the portal-created buyer and assigns the correct ownership share;
8. adds remaining buyers, sellers, and the transaction sequentially; and
9. stops for your review before portal continuation, submission, or payment.

Navigation from the portal home page to Form 141 and onward to the payment
review screen is planned, but is not claimed as complete yet.

## Install a release

Download the Windows installer from
[GitHub Releases](https://github.com/bagdeabhishek/debabufy/releases).
The builds are currently unsigned, so Windows may display a SmartScreen
warning. Verify the release and checksum before running it.

Starting with version 0.2.3, the Windows app checks the project's public
GitHub releases at startup and shows a download button when a newer installer
is available. Updates remain user-controlled and are never installed silently.

## Run from source

Requirements:

- Node.js 22 or newer;
- Google Chrome; and
- Windows, macOS, or Linux.

```sh
git clone https://github.com/bagdeabhishek/debabufy.git
cd debabufy
npm install
npm start
```

Chrome is launched directly by the desktop app with a dedicated non-default
profile and a loopback-only debugging port. Playwright attaches to that ordinary
Chrome process; it does not launch a bundled automation browser.

## Repository layout

```text
apps/
  desktop/                 Electron shell and local UI
workflows/
  registry.js              Explicit bundled-workflow registry
  form-141/                Self-contained Form 141 workflow
    browser/               Income Tax portal helper
    cli/                   Advanced CLI argument handling
    docs/                  Workflow-specific troubleshooting
    examples/              Synthetic fixtures
    src/                   Parser, inference, and portal helpers
    test/                  Workflow tests
    index.js               Desktop-facing workflow API
    workflow.json          Metadata and input definition
```

Everything is bundled in the application for now. A signed plug-in system can
be designed later, after at least two workflows have proven the common
interface.

## Contributing

Contributions are welcome: portal fixes, accessibility improvements, test
fixtures, documentation, and new workflows.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Never
commit a real statement, PAN, Aadhaar number, address, portal response, cookie,
token, screenshot, HAR, or browser profile. Use synthetic fixtures.

Each new workflow belongs in its own `workflows/<workflow-id>/` directory and
must expose the same small `prepare` and `run` interface. See the
[Form 141 module](workflows/form-141/README.md) for the initial example.

## Privacy and safety

- Filing data stays on the device.
- No telemetry is collected.
- Credentials, OTP, and CAPTCHA remain entirely with the user.
- Portal changes fail closed instead of guessing.
- Diagnostics are stored locally and may still contain sensitive page
  structure; review them before sharing.
- DeBabufy never clicks final submission or authorizes payment.

Read [PRIVACY.md](PRIVACY.md), [SECURITY.md](SECURITY.md), and
[SUPPORT.md](SUPPORT.md) for details.

## License

[MIT](LICENSE)
