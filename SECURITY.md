# Security policy

## Supported versions

This project is currently alpha software. Security fixes are applied to the
latest release and the `main` branch.

## Report a vulnerability privately

Do not open a public issue for a vulnerability.

Use GitHub's private vulnerability reporting:

<https://github.com/bagdeabhishek/tds-26qb-assistant/security/advisories/new>

Include:

- the affected version or commit;
- clear reproduction steps using synthetic data;
- the expected and actual behavior;
- the potential impact; and
- a suggested mitigation, if known.

Never include a real challan statement, HAR, PAN, Aadhaar number, contact detail,
address, credential, OTP, payment reference, bank data, or unredacted portal
screenshot.

## Security boundaries

The extension must not:

- collect telemetry or send filing data to a remote service;
- persist filing data to disk;
- access cookies, browsing history, downloads, or unrelated sites;
- automate credentials, CAPTCHA, OTP, QR, UPI, or bank authorization;
- click navigation, submission, challan creation, or payment controls; or
- bypass portal authentication, validation, or anti-automation mechanisms.

Changes affecting these boundaries require explicit security and privacy review.
