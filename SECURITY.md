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

The CLI and extension must not:

- collect telemetry or send filing data to a remote service;
- persist the parsed filing proposal to disk unless the user explicitly exports
  it;
- access cookies, browsing history, downloads, or unrelated sites;
- automate credentials, CAPTCHA, OTP, QR, UPI, or bank authorization;
- click navigation, submission, challan creation, or payment controls; or
- bypass portal authentication, validation, or anti-automation mechanisms.

The opt-in diagnostic recorder may observe Form 141 payment-API request and
response shapes, but must store only endpoint paths, HTTP status codes, and JSON
key/type paths. It must never store headers, cookies, tokens, or request/response
values.

The CLI deliberately uses a separate persistent browser profile so the user can
complete portal login. That directory may contain authentication/session data:
do not share or back it up, and delete it when persistence is no longer wanted.
The CLI must never target the user's ordinary Chrome/Edge profile.

Changes affecting these boundaries require explicit security and privacy review.
