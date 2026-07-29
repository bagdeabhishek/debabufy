# Public release checklist

Complete this checklist before changing repository visibility or publishing a
browser-store package.

## Repository

- [ ] Merge the public-facing hardening pull request.
- [ ] Require the `CI / test` check on the default branch.
- [ ] Enable GitHub private vulnerability reporting.
- [ ] Confirm GitGuardian and GitHub secret scanning report no exposed secret.
- [ ] Confirm the repository contains no real statement, HAR, PAN, contact,
      address, acknowledgement, challan, payment, or bank data.
- [ ] Add repository topics such as `form-141`, `playwright`,
      `browser-extension`, and `privacy`.
- [ ] Change visibility only after the checks above pass.

## Functional validation

- [ ] Install the CLI `.tgz` into an empty temporary directory and run
      `form141-assistant --help`.
- [ ] Run the synthetic CLI dry run.
- [ ] Confirm the CLI attaches only to a loopback Chrome debugging endpoint,
      observes `navigator.webdriver === false`, and stops before Add, Save,
      Continue, submission, and payment.
- [ ] Install the unpacked extension in a fresh Chrome profile.
- [ ] Install the temporary extension in a fresh Firefox profile.
- [ ] Parse synthetic PDF, JSON, and text fixtures.
- [ ] Verify state disappears after browser restart.
- [ ] Verify **Clear** removes the current proposal immediately.
- [ ] Verify **Preview matches** does not change portal fields.
- [ ] Verify filling skips populated fields by default.
- [ ] Verify the extension never clicks navigation, submission, challan, or
      payment controls.
- [ ] Test the current portal flow with private data locally; publish only
      field-path diagnostics and synthetic reproductions.

## Release package

- [ ] Run `npm ci`.
- [ ] Run `npm run check`.
- [ ] Run `npm test`.
- [ ] Run `npm audit --omit=dev`.
- [ ] Run `npm run package`.
- [ ] Run `npm run verify:package`.
- [ ] Inspect `dist/tds-26qb-assistant-chrome.zip`.
- [ ] Inspect `dist/tds-26qb-assistant-firefox.zip`.
- [ ] Inspect `dist/form141-assistant-cli.tgz`.
- [ ] Verify all package checksum files.
- [ ] Confirm both ZIPs include `LICENSE`, `PRIVACY.md`,
      `THIRD_PARTY_NOTICES.md`, and `vendor/PDFJS_LICENSE`.
- [ ] Confirm neither ZIP contains a source statement, HAR, browser profile,
      build cache, or dependency directory.
- [ ] Confirm the CLI archive contains no statement, HAR, browser profile,
      dependency directory, or private research artifact.
- [ ] Confirm the Chrome manifest excludes Firefox-only settings.
- [ ] Confirm the Firefox manifest excludes Chrome-only settings and declares
      no data collection.
- [ ] Confirm a push to `main` uploads separate CLI, Chrome, and Firefox
      artifacts.
- [ ] Confirm the push creates a GitHub prerelease with all packages and
      checksums.

## Store listing

- [ ] Use only synthetic data in screenshots and demo videos.
- [ ] Link to `PRIVACY.md`.
- [ ] Describe every requested permission accurately.
- [ ] State that the extension is unofficial and unaffiliated.
- [ ] State that submission and payment remain human-controlled.
- [ ] Publish an alpha/pre-release until live selector coverage is proven.
